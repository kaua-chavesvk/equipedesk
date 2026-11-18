import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { rateLimit, rateLimitLogin } from '../../src/lib/rate-limit';
import { requestProtocol, trustedClientIp } from '../../src/lib/security';

const makeRequest = (headers?: HeadersInit) =>
  new Request('https://desk.example/api/auth', { headers });
const fetchRedis = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('VERCEL', '');
  vi.stubEnv('TRUST_PROXY', 'false');
  vi.stubEnv('RATE_LIMIT_REDIS_URL', 'https://redis.example');
  vi.stubEnv('RATE_LIMIT_REDIS_TOKEN', 'unit-test');
  fetchRedis.mockReset();
  fetchRedis.mockImplementation(async () => Response.json({ result: 1 }));
  vi.stubGlobal('fetch', fetchRedis);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const keys = () =>
  fetchRedis.mock.calls.map(([, options]) => JSON.parse(String(options?.body))[3] as string);

describe('ingresso e limite de autenticação', () => {
  it('aceita o IP único da Vercel e ignora listas e cabeçalhos sem ingresso confiável', () => {
    const headers = new Headers({
      'x-forwarded-for': '192.0.2.9',
      'x-real-ip': '192.0.2.8',
      'x-vercel-forwarded-for': '2001:0db8::1',
    });
    expect(trustedClientIp(headers)).toBeNull();
    vi.stubEnv('VERCEL', '1');
    expect(trustedClientIp(headers)).toBe('2001:db8::1');
    headers.set('x-vercel-forwarded-for', '192.0.2.8, 192.0.2.9');
    expect(trustedClientIp(headers)).toBeNull();
  });

  it('aceita protocolo encaminhado somente em ingresso confiável e com valor único', () => {
    const headers = new Headers({ 'x-forwarded-proto': 'https' });
    expect(requestProtocol('http:', headers)).toBe('http');
    vi.stubEnv('TRUST_PROXY', 'true');
    expect(requestProtocol('http:', headers)).toBe('https');
    headers.set('x-forwarded-proto', 'https, http');
    expect(requestProtocol('http:', headers)).toBe('http');
  });

  it('aplica teto global mesmo sem IP e separa o limite por IP quando conhecido', async () => {
    fetchRedis.mockImplementation(async () => Response.json({ result: 61 }));
    expect(await rateLimit(makeRequest())).toBe(true);
    expect(keys()).toEqual([expect.stringMatching(/^equipedesk:auth-global:/)]);
    vi.stubEnv('VERCEL', '1');
    expect(await rateLimit(makeRequest({ 'x-vercel-forwarded-for': '192.0.2.8' }))).toBe(false);
    expect(keys()[2]).toMatch(/^equipedesk:auth-ip:/);
    fetchRedis.mockResolvedValueOnce(Response.json({ result: 601 }));
    expect(await rateLimit(makeRequest())).toBe(false);
  });

  it('normaliza o e-mail, separa as combinações e rejeita a 11ª tentativa', async () => {
    vi.stubEnv('VERCEL', '1');
    const request = makeRequest({ 'x-vercel-forwarded-for': '192.0.2.8' });
    await rateLimitLogin(request, ' Pessoa@example.test ');
    await rateLimitLogin(request, 'pessoa@example.test');
    await rateLimitLogin(request, 'outra@example.test');
    fetchRedis.mockResolvedValueOnce(Response.json({ result: 11 }));
    expect(
      await rateLimitLogin(
        makeRequest({ 'x-vercel-forwarded-for': '192.0.2.9' }),
        'pessoa@example.test',
      ),
    ).toBe(false);
    const [first, normalized, otherEmail, otherIp] = keys();
    expect(first).toMatch(/^equipedesk:login:[a-f0-9]{64}$/);
    expect(first).toBe(normalized);
    expect(new Set([first, otherEmail, otherIp]).size).toBe(3);
  });
});
