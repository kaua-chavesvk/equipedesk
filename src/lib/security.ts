export const production = () => process.env.NODE_ENV === 'production';

export function environmentProblems(env: NodeJS.ProcessEnv = process.env, options = { requireRedis: true }) {
  const problems: string[] = [];
  const prod = env.NODE_ENV === 'production';
  for (const name of Object.keys(env)) {
    if (name.startsWith('NEXT_PUBLIC_') && name !== 'NEXT_PUBLIC_SUPABASE_ANON_KEY' && /SECRET|SERVICE_ROLE|PASSWORD|PRIVATE|TOKEN|API_KEY/i.test(name) && env[name]) problems.push(`Variável privada com prefixo público: ${name}`);
  }
  const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
  let role = '';
  try { role = JSON.parse(Buffer.from(key.split('.')[1] ?? '', 'base64url').toString()).role ?? ''; } catch {}
  if (key.startsWith('sb_secret_') || role === 'service_role') problems.push('Chave privilegiada configurada como chave pública.');
  if (Boolean(env.NEXT_PUBLIC_SUPABASE_URL) !== Boolean(key)) problems.push('Configuração Supabase incompleta.');
  for (const name of ['NEXT_PUBLIC_SITE_URL','NEXT_PUBLIC_SUPABASE_URL', ...(options.requireRedis ? ['RATE_LIMIT_REDIS_URL'] : [])]) {
    const value = env[name];
    if (!value) continue;
    try {
      const url = new URL(value);
      if (url.username || url.password || !['http:','https:'].includes(url.protocol) || (prod && url.protocol !== 'https:')) problems.push(`URL inválida ou sem HTTPS: ${name}`);
      if (name === 'NEXT_PUBLIC_SITE_URL' && (url.pathname !== '/' || url.search || url.hash)) problems.push('SITE_URL deve conter apenas a origem.');
    } catch { problems.push(`URL inválida: ${name}`); }
  }
  if (prod && !env.NEXT_PUBLIC_SITE_URL) problems.push('SITE_URL obrigatório em produção.');
  if (prod && env.SUPABASE_SERVICE_ROLE_KEY) problems.push('Chave administrativa não deve estar no processo web.');
  if (prod && (!env.NEXT_PUBLIC_SUPABASE_URL || !key) && env.DEMO_MODE !== 'true') problems.push('Supabase obrigatório em produção.');
  if (options.requireRedis && prod && (!env.RATE_LIMIT_REDIS_URL || !env.RATE_LIMIT_REDIS_TOKEN)) problems.push('Limitador distribuído obrigatório em produção.');
  return problems;
}

export function allowedMutation(request: Request, expectedOrigin: string, prod: boolean) {
  if (request.headers.get('sec-fetch-site') === 'cross-site') return false;
  const origin = request.headers.get('origin');
  if (!origin) return !prod && !request.headers.has('sec-fetch-site');
  if (origin === expectedOrigin) return true;
  if (prod) return false;
  try {
    const source = new URL(origin), target = new URL(expectedOrigin);
    return ['localhost','127.0.0.1','[::1]'].includes(source.hostname) &&
      ['localhost','127.0.0.1','[::1]','0.0.0.0'].includes(target.hostname) && source.port === target.port;
  } catch { return false; }
}

export function securityEvent(event: string, status: number, requestId?: string) {
  // Deliberately exclude URLs, request bodies, cookies, email, IP and tokens.
  console.warn(JSON.stringify({type:'security',event,status,requestId,time:new Date().toISOString()}));
}

export function contentSecurityPolicy(nonce: string, prod: boolean) {
  let supabase = '';
  try { supabase = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').origin; } catch {}
  return `default-src 'self'; script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${prod ? '' : " 'unsafe-eval'"}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' ${supabase} ${prod ? '' : 'ws: wss:'}; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';${prod ? ' upgrade-insecure-requests;' : ''}`;
}
