import { createHash } from 'node:crypto';

const memory = new Map<string,{count:number;expires:number}>();
export function localLimit(key: string, limit: number, now = Date.now()) {
  for (const [id,entry] of memory) if (entry.expires <= now) memory.delete(id);
  let entry = memory.get(key);
  if (!entry) {
    if (memory.size >= 10000) return false;
    entry = {count:0,expires:now+60000};memory.set(key,entry);
  }
  return ++entry.count <= limit;
}

export async function rateLimit(request: Request) {
  const prod = process.env.NODE_ENV === 'production';
  const auth = new URL(request.url).pathname === '/api/auth';
  const limit = prod ? (auth ? 10 : 120) : 1000;
  // Forwarded IPs are only accepted when a trusted ingress overwrites them.
  const identity = process.env.TRUST_PROXY === 'true' ? request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'shared' : 'shared';
  const key = `equipedesk:${auth?'auth':'api'}:${createHash('sha256').update(identity).digest('hex')}`;
  const url = process.env.RATE_LIMIT_REDIS_URL, token = process.env.RATE_LIMIT_REDIS_TOKEN;
  if (!url || !token) {
    if (prod) throw new Error('Rate limiter unavailable');
    return localLimit(key,limit);
  }
  const endpoint = new URL(url);
  if (endpoint.username || endpoint.password || (prod ? endpoint.protocol !== 'https:' : !['http:', 'https:'].includes(endpoint.protocol))) {
    throw new Error('Rate limiter unavailable');
  }
  const script = "local n=redis.call('INCR',KEYS[1]);if n==1 then redis.call('EXPIRE',KEYS[1],60) end;return n";
  const response = await fetch(endpoint,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
    body:JSON.stringify(['EVAL',script,1,key]),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(3000)});
  if (!response.ok) throw new Error('Rate limiter unavailable');
  const result = await response.json();
  if (result.error || !Number.isInteger(result.result)) throw new Error('Rate limiter unavailable');
  return result.result <= limit;
}
