import { beforeEach, expect, it, vi } from 'vitest';
import { GET, POST } from '@/app/api/conta/mfa/route';
import { requirePlatformAdmin, adminMfaStatus, changeAdminMfa } from '@/lib/server/admin-mfa';
import { rateLimitBucket } from '@/lib/rate-limit';
import { HttpError } from '@/lib/http/api';

vi.mock('@/lib/server/admin-mfa', () => ({
  requirePlatformAdmin: vi.fn(),
  adminMfaStatus: vi.fn(),
  changeAdminMfa: vi.fn(),
}));
vi.mock('@/lib/rate-limit', () => ({ rateLimitBucket: vi.fn() }));
const request = (body: unknown) =>
  new Request('http://localhost/api/conta/mfa', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(requirePlatformAdmin).mockResolvedValue({
    user: { id: 'admin' },
    db: { auth: {} },
  } as unknown as Awaited<ReturnType<typeof requirePlatformAdmin>>);
  vi.mocked(rateLimitBucket).mockResolvedValue(true);
});
it('retorna status sem cache', async () => {
  vi.mocked(adminMfaStatus).mockResolvedValue({ verified: false, factors: [] });
  const response = await GET(new Request('http://localhost/api/conta/mfa'));
  expect(response.status).toBe(200);
  expect(response.headers.get('Cache-Control')).toBe('private, no-store');
});
it.each([401, 403])('recusa identidade não autorizada: %s', async (status) => {
  vi.mocked(requirePlatformAdmin).mockRejectedValue(new HttpError(status, 'Sem acesso.'));
  expect((await POST(request({ action: 'enroll' }))).status).toBe(status);
  expect(changeAdminMfa).not.toHaveBeenCalled();
});
it('valida payload antes de chamar o provedor', async () => {
  expect((await POST(request({ action: 'verify', factorId: 'invalid', code: '1' }))).status).toBe(
    422,
  );
  expect(changeAdminMfa).not.toHaveBeenCalled();
});
it('impõe limite de dez mutações por administrador, independente do IP', async () => {
  vi.mocked(rateLimitBucket).mockResolvedValue(false);
  const response = await POST(request({ action: 'enroll' }));
  expect(rateLimitBucket).toHaveBeenCalledWith('admin-mfa', 'admin', 10);
  expect(response.status).toBe(429);
  expect(response.headers.get('Retry-After')).toBe('60');
  expect(changeAdminMfa).not.toHaveBeenCalled();
});
it('falha fechada quando o limitador está indisponível', async () => {
  vi.mocked(rateLimitBucket).mockRejectedValue(new Error('provider detail'));
  const response = await POST(request({ action: 'enroll' }));
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ error: 'Serviço temporariamente indisponível.' });
  expect(changeAdminMfa).not.toHaveBeenCalled();
});
it('delega confirmação ao serviço autenticado e impede cache da resposta', async () => {
  vi.mocked(changeAdminMfa).mockResolvedValue({ verified: true, factors: [] });
  const response = await POST(
    request({ action: 'verify', factorId: 'bc2e733b-3b12-4df1-8c76-80420fa8f924', code: '001234' }),
  );
  expect(response.status).toBe(200);
  expect(response.headers.get('Cache-Control')).toContain('no-store');
  expect(changeAdminMfa).toHaveBeenCalledWith(
    {},
    'admin',
    expect.objectContaining({ code: '001234' }),
  );
});
