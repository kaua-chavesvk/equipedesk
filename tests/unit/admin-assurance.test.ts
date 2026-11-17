import { afterEach, expect, it, vi } from 'vitest';
import { hasAdminAssurance, requireAdminAssurance } from '../../src/lib/server/admin-assurance';

vi.mock('server-only', () => ({}));
afterEach(() => vi.unstubAllEnvs());

it('preserva acesso enquanto o segundo fator não está habilitado', async () => {
  vi.stubEnv('ENFORCE_PLATFORM_ADMIN_AAL2', 'false');
  const auth = { getClaims: vi.fn() };
  await expect(hasAdminAssurance(auth, 'admin')).resolves.toBe(true);
  expect(auth.getClaims).not.toHaveBeenCalled();
});

it.each([
  [{ claims: { sub: 'admin', aal: 'aal1' } }, null],
  [{ claims: { sub: 'other', aal: 'aal2' } }, null],
  [null, new Error('invalid session')],
])('recusa sessão sem AAL2 válido do administrador', async (data, error) => {
  vi.stubEnv('ENFORCE_PLATFORM_ADMIN_AAL2', 'true');
  const auth = { getClaims: vi.fn().mockResolvedValue({ data, error }) };
  await expect(requireAdminAssurance(auth, 'admin')).rejects.toMatchObject({ status: 403 });
});

it('aceita AAL2 validado para o mesmo administrador', async () => {
  vi.stubEnv('ENFORCE_PLATFORM_ADMIN_AAL2', 'true');
  const auth = { getClaims: vi.fn().mockResolvedValue({ data: { claims: { sub: 'admin', aal: 'aal2' } }, error: null }) };
  await expect(hasAdminAssurance(auth, 'admin')).resolves.toBe(true);
});
