import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { allowedMutation, contentSecurityPolicy, environmentProblems } from '../../src/lib/security';
import { safeRedirect } from '../../src/lib/safe-redirect';
import { readJson } from '../../src/lib/http/read-json';
import { localLimit } from '../../src/lib/rate-limit';

afterEach(()=>vi.unstubAllEnvs());
it.each(['//evil.example','/\\evil.example','/\n/evil.example','https://evil.example'])('bloqueia redirecionamento externo %s',value=>{
 expect(safeRedirect(value)).toBe('/onboarding');
});
it('permite rota local e query',()=>expect(safeRedirect('/convite/abc?next=1')).toBe('/convite/abc?next=1'));
it('bloqueia CSRF sem origem e com origem externa em produção',()=>{
 const cases:Record<string,string>[]=[{},{origin:'https://evil.example'},{origin:'null'},{origin:'https://desk.example','sec-fetch-site':'cross-site'}];
 for(const headers of cases){
  expect(allowedMutation(new Request('https://desk.example/api/auth',{headers}),'https://desk.example',true)).toBe(false);
 }
 expect(allowedMutation(new Request('https://desk.example/api/auth',{headers:{origin:'https://desk.example'}}),'https://desk.example',true)).toBe(true);
});
it('nega configuração insegura sem revelar os valores',()=>{
 const problems=environmentProblems({NODE_ENV:'production',NEXT_PUBLIC_SITE_URL:'http://example.com',NEXT_PUBLIC_SECRET:'do-not-log',NEXT_PUBLIC_SUPABASE_ANON_KEY:'sb_secret_do-not-log'});
 expect(problems.length).toBeGreaterThan(3);expect(problems.join()).not.toContain('do-not-log');
});
it('CSP de produção exige nonce e não permite eval ou scripts inline genéricos',()=>{
 const csp=contentSecurityPolicy('random-nonce',true);
 expect(csp).toContain("'nonce-random-nonce'");expect(csp).not.toContain('unsafe-eval');
 expect(csp.split('style-src')[0]).not.toContain('unsafe-inline');expect(csp).toContain("frame-ancestors 'none'");
});
it('limita requisições e libera após a janela',()=>{
 const key=crypto.randomUUID();expect(localLimit(key,2,0)).toBe(true);expect(localLimit(key,2,0)).toBe(true);
 expect(localLimit(key,2,0)).toBe(false);expect(localLimit(key,2,60001)).toBe(true);
});
it('recusa multipart, JSON inválido e corpo excessivo sem depender de Content-Length',async()=>{
 await expect(readJson(new Request('http://local',{method:'POST',headers:{'content-type':'multipart/form-data'},body:'file'}))).rejects.toMatchObject({status:415});
 await expect(readJson(new Request('http://local',{method:'POST',headers:{'content-type':'application/json'},body:'{'}))).rejects.toMatchObject({status:400});
 await expect(readJson(new Request('http://local',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:'x'.repeat(33000)})}))).rejects.toMatchObject({status:413});
});

const mocks=vi.hoisted(()=>({rate:vi.fn(async()=>true)}));
vi.mock('../../src/lib/rate-limit',async importOriginal=>({...await importOriginal<typeof import('../../src/lib/rate-limit')>(),rateLimit:mocks.rate}));
import { proxy } from '../../src/proxy';
beforeEach(()=>{mocks.rate.mockResolvedValue(true);vi.spyOn(console,'warn').mockImplementation(()=>{});});
afterEach(()=>vi.restoreAllMocks());
function productionEnv(){
 vi.stubEnv('NODE_ENV','production');vi.stubEnv('DEMO_MODE','true');vi.stubEnv('NEXT_PUBLIC_SITE_URL','https://desk.example');
 vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','');vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY','');
 vi.stubEnv('RATE_LIMIT_REDIS_URL','https://redis.example');vi.stubEnv('RATE_LIMIT_REDIS_TOKEN','test-only');
}
it('redireciona HTTP para a origem HTTPS configurada',async()=>{
 productionEnv();const result=await proxy(new NextRequest('http://evil.example/login'));
 expect(result.status).toBe(308);expect(result.headers.get('location')).toBe('https://desk.example/login');
});
it('rejeita CSRF antes de executar a API',async()=>{
 productionEnv();const result=await proxy(new NextRequest('https://desk.example/api/auth',{method:'POST',headers:{'content-type':'application/json'}}));
 expect(result.status).toBe(403);
});
it('retorna 429 com Retry-After e registra evento sem conteúdo sensível',async()=>{
 productionEnv();mocks.rate.mockResolvedValue(false);
 const result=await proxy(new NextRequest('https://desk.example/api/auth',{method:'POST',headers:{origin:'https://desk.example','content-type':'application/json'},body:'{"password":"secret-value"}'}));
 expect(result.status).toBe(429);expect(result.headers.get('retry-after')).toBe('60');
 expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toContain('secret-value');
});
it('falha fechado quando o limitador estiver indisponível',async()=>{
 productionEnv();mocks.rate.mockRejectedValueOnce(new Error('backend failed'));
 expect((await proxy(new NextRequest('https://desk.example/api/empresas',{method:'POST',headers:{origin:'https://desk.example','content-type':'application/json'}}))).status).toBe(503);
});
it('limita retorno 429 sem depender de cabeçalhos IP não confiáveis',async()=>{
 productionEnv();mocks.rate.mockResolvedValue(false);
 const response=await proxy(new NextRequest('https://desk.example/api/empresas',{headers:{'x-forwarded-for':'invented-ip'}}));
 expect(response.status).toBe(429);
});
it('cookie de demonstração em produção é Secure, HttpOnly e SameSite=Lax',async()=>{
 productionEnv();const response=await proxy(new NextRequest('https://desk.example/login'));
 const cookie=response.cookies.get('desk_demo');expect(cookie).toMatchObject({httpOnly:true,secure:true,sameSite:'lax'});
 expect(response.headers.get('cache-control')).toContain('no-store');
});

it.each([null, 'invalid-url'])('preserva páginas com Redis ausente ou inválido (%s)', async url => {
  productionEnv();
  vi.stubEnv('RATE_LIMIT_REDIS_URL', url ?? '');
  expect((await proxy(new NextRequest('https://desk.example/login'))).status).toBe(200);
  expect(environmentProblems()).not.toHaveLength(0);
});

it('preserva a leitura de chamados quando o Redis falha', async () => {
  productionEnv();
  mocks.rate.mockRejectedValueOnce(new Error('backend failed'));
  const result = await proxy(new NextRequest('https://desk.example/api/empresas/aurora/chamados'));
  expect(result.status).toBe(200);
  expect(result.headers.get('cache-control')).toContain('no-store');
});

it.each(['/%2fexemplo.com', '/%255cexemplo.com', '/%250a/exemplo.com', '/%2G'])('rejeita caminho codificado inválido %s', value => {
  expect(safeRedirect(value)).toBe('/onboarding');
});
