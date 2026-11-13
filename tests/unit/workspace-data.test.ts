import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('../../src/lib/supabase/server', () => ({
  configured: () => true,
  supabaseServer: async () => ({
    from: mocks.from,
    auth: { getUser: async () => ({ data: { user: { id: 'marina', email: 'marina@example.com', user_metadata: {} } } }) },
  }),
}));

import { getWorkspace } from '../../src/lib/data';

describe('carregamento de membros no workspace', () => {
  let memberError: { message: string } | null;
  let globalAdmin: boolean;

  beforeEach(() => {
    memberError = null;
    globalAdmin = false;
    mocks.from.mockImplementation((table: string) => ({
      select: (columns: string) => {
        const result = table === 'platform_admins'
          ? {data:globalAdmin?[{user_id:'marina'}]:[],error:null}
          : table === 'organizations'
          ? { data: [{ id: 'org', name: 'Aurora', slug: 'aurora' },{id:'other',name:'Outra empresa',slug:'outra'}], error: null }
          : table === 'tickets' ? { data: [], error: null }
          : columns === '*' ? { data: [], error: memberError }
          : { data: [{ organization_id: 'org', role: 'admin' }], error: null };
        const query = {
          eq: () => query,
          order: () => query,
          then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
        };
        return query;
      },
    }));
  });

  it('propaga erro da consulta em vez de mostrar equipe vazia', async () => {
    memberError = { message: 'Consulta indisponível' };
    await expect(getWorkspace('aurora')).rejects.toBe(memberError);
  });

  it('aceita uma consulta bem-sucedida sem membros retornados', async () => {
    await expect(getWorkspace('aurora')).resolves.toMatchObject({
      organization: { slug: 'aurora', role: 'admin' }, members: [], demo: false,
    });
  });

  it('permite administrador geral em empresa sem associação local',async()=>{
    globalAdmin=true;
    await expect(getWorkspace('outra')).resolves.toMatchObject({organization:{slug:'outra',role:'admin',platform_admin:true}});
  });

  it('não transforma acesso sem vínculo em acesso administrativo',async()=>{
    await expect(getWorkspace('outra')).rejects.toThrow('Empresa não encontrada.');
  });
});
