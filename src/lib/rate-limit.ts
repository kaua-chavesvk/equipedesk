import { createHmac } from 'node:crypto';
import { trustedClientIp } from './security';

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
  const ip = trustedClientIp(request.headers);
  if (auth) {
    if (!await rateLimitBucket('auth-global', 'global', prod ? 600 : 1000)) return false;
    return !ip || rateLimitBucket('auth-ip', ip, prod ? 60 : 1000);
  }
  return rateLimitBucket('api', ip ?? 'global', prod ? (ip ? 120 : 600) : 1000);
}

export function rateLimitLogin(request: Request, email: string) {
  const ip = trustedClientIp(request.headers) ?? 'unattributed';
  const identity = JSON.stringify([ip, email.trim().toLowerCase()]);
  return rateLimitBucket('login', identity, process.env.NODE_ENV === 'production' ? 10 : 1000);
}

export async function rateLimitBucket(namespace: 'auth-global' | 'auth-ip' | 'login' | 'api' | 'avatar-upload' | 'admin-mfa', identity: string, limit: number) {
  const prod = process.env.NODE_ENV === 'production';
  const url = process.env.RATE_LIMIT_REDIS_URL, token = process.env.RATE_LIMIT_REDIS_TOKEN;
  const key = `equipedesk:${namespace}:${createHmac('sha256', token || 'local-development').update(namespace).update('\0').update(identity).digest('hex')}`;
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
