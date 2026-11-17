import { beforeEach, expect, it, vi } from 'vitest';
import { GET, PUT } from '@/app/api/empresas/[slug]/filtros-salvos/route';
import { requireAccount } from '@/lib/server/account-settings';
import { HttpError } from '@/lib/http/api';
vi.mock('server-only', () => ({}));
vi.mock('@/lib/server/account-settings', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/server/account-settings')>(), requireAccount: vi.fn(),
}));
const context = { params: Promise.resolve({ slug: 'aurora' }) };
const read = () => new Request('http://localhost/api/empresas/aurora/filtros-salvos');
const write = (body: unknown) => new Request(read(), {
  method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});
let rpc: ReturnType<typeof vi.fn>, from: ReturnType<typeof vi.fn>, eq: ReturnType<typeof vi.fn>;
let organization: { data: { id: string } | null; error: unknown };
let stored: { data: { filters: unknown[]; version: number } | null; error: unknown };
beforeEach(() => {
  vi.resetAllMocks();
  organization = { data: { id: 'org' }, error: null }; stored = { data: null, error: null };
  eq = vi.fn();
  from = vi.fn(table => {
    const chain = { select: vi.fn(), eq, maybeSingle: vi.fn(async () => table === 'organizations' ? organization : stored) };
    chain.select.mockReturnValue(chain); eq.mockReturnValue(chain);
    return chain;
  });
  rpc = vi.fn().mockResolvedValue({ data: { filters: [], version: 1 }, error: null });
  vi.mocked(requireAccount).mockResolvedValue({ user: { id: 'viewer' }, db: { from, rpc } } as unknown as Awaited<ReturnType<typeof requireAccount>>);
});
it('retorna versão inicial para usuário autorizado sem atalhos', async () => {
  const response = await GET(read(), context);
  expect(await response.json()).toEqual({ filters: [], version: 0 });
  expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  expect(eq).toHaveBeenCalledWith('user_id', 'viewer');
  expect(eq).toHaveBeenCalledWith('organization_id', 'org');
});
it('não transforma falha de banco em lista vazia', async () => {
  stored.error = new Error('sensitive database detail');
  const response = await GET(read(), context);
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ error: 'Não foi possível carregar os filtros salvos.' });
});
it('recusa empresa não visível pela RLS', async () => {
  organization.data = null;
  expect((await GET(read(), context)).status).toBe(404);
  expect(from).not.toHaveBeenCalledWith('user_ticket_filters');
});
it('exige sessão antes da leitura ou gravação', async () => {
  vi.mocked(requireAccount).mockRejectedValue(new HttpError(401, 'Entre na sua conta.'));
  expect((await GET(read(), context)).status).toBe(401);
  expect((await PUT(write({ filters: [], version: 0 }), context)).status).toBe(401);
  expect(rpc).not.toHaveBeenCalled();
});
it('não aceita dono externo na gravação', async () => {
  expect((await PUT(write({ filters: [], version: 0, user_id: 'other' }), context)).status).toBe(422);
  expect(rpc).not.toHaveBeenCalled();
});
it('envia somente slug, filtros validados e versão ao comando transacional', async () => {
  expect((await PUT(write({ filters: [], version: 0 }), context)).status).toBe(200);
  expect(rpc).toHaveBeenCalledWith('ticket_filters_update', { p_slug: 'aurora', p_filters: [], p_version: 0 });
});
it('propaga conflito de versão sem retornar erro interno', async () => {
  rpc.mockResolvedValue({ data: null, error: { code: 'P0001', message: '409: Os filtros mudaram em outra sessão. Recarregue antes de salvar.' } });
  expect((await PUT(write({ filters: [], version: 0 }), context)).status).toBe(409);
});
