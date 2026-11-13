import { beforeEach, expect, it, vi } from 'vitest';
import { POST } from '../../src/app/api/convites/aceitar/route';

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn() }));
vi.mock('@/lib/data', () => ({ demoEnabled: () => false }));
vi.mock('@/lib/supabase/server', () => ({
  supabaseServer: async () => ({ auth: { getUser: mocks.getUser }, rpc: mocks.rpc }),
}));

function accept() {
  return POST(new Request('https://desk.example/api/convites/aceitar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: 'a'.repeat(64) }),
  }));
}

beforeEach(() => vi.resetAllMocks());

it('orienta a entrar na conta antes de chamar o comando de aceite', async () => {
  mocks.getUser.mockResolvedValue({ data: { user: null }, error: { name: 'AuthSessionMissingError' } });
  const response = await accept();
  expect(response.status).toBe(401);
  expect((await response.json()).error).toContain('Entre com o e-mail');
  expect(mocks.rpc).not.toHaveBeenCalled();
});

it('preserva a recusa por e-mail diferente', async () => {
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'test-user' } }, error: null });
  mocks.rpc.mockResolvedValue({ error: { code: 'P0001', message: '403:Confirme o e-mail correspondente ao convite.' } });
  const response = await accept();
  expect(response.status).toBe(403);
  expect((await response.json()).error).toBe('Confirme o e-mail correspondente ao convite.');
});

it('informa indisponibilidade sem exibir detalhes internos do banco', async () => {
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'test-user' } }, error: null });
  mocks.rpc.mockResolvedValue({ error: { code: '42501', message: 'detalhe interno' } });
  const response = await accept();
  expect(response.status).toBe(503);
  expect((await response.json()).error).not.toContain('detalhe interno');
});
