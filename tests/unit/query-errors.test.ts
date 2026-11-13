import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getWorkspace: vi.fn(),
  demoEnabled: vi.fn(() => false),
  from: vi.fn(),
}));

vi.mock('@/lib/data', () => ({
  getWorkspace: mocks.getWorkspace,
  demoEnabled: mocks.demoEnabled,
  demoStore: vi.fn(),
}));
vi.mock('@/lib/supabase/server', () => ({ supabaseServer: async () => ({ from: mocks.from }) }));

vi.mock('@/lib/ticket-queries', () => ({ ticketById: async (workspace: {tickets: {id:string}[]}, id:string) => workspace.tickets.find(t=>t.id===id) }));

import { GET } from '../../src/app/api/empresas/[slug]/[[...resource]]/route';

const ticketId = '00000000-0000-4000-8000-000000000001';

describe('falhas no carregamento da conversa', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getWorkspace.mockResolvedValue({
      organization: { id: 'organization', role: 'admin' },
      tickets: [{ id: ticketId }],
    });
  });

  it.each(['comments', 'ticket_events'])('retorna 500 quando a consulta %s falha', async failingTable => {
    mocks.from.mockImplementation((table: string) => ({
      select: () => ({ eq: () => ({ eq: () => ({ order: async () => table === failingTable
        ? { data: null, error: { message: 'Falha interna confidencial' } }
        : { data: [], error: null } }) }) }),
    }));
    const response = await GET(new Request(`http://localhost/api/empresas/aurora/chamados/${ticketId}`), {
      params: Promise.resolve({ slug: 'aurora', resource: ['chamados', ticketId] }),
    });
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Não foi possível concluir a operação. Tente novamente.' });
  });

  it('preserva conversa realmente vazia como sucesso', async () => {
    mocks.from.mockImplementation(() => ({
      select: () => ({ eq: () => ({ eq: () => ({ order: async () => ({ data: [], error: null }) }) }) }),
    }));
    const response = await GET(new Request(`http://localhost/api/empresas/aurora/chamados/${ticketId}`), {
      params: Promise.resolve({ slug: 'aurora', resource: ['chamados', ticketId] }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ticket: { id: ticketId }, comments: [], events: [] });
  });
});
