import { beforeEach, expect, it, vi } from 'vitest';
import { cachedTickets, invalidateTickets } from '../../src/lib/ticket-cache';

const next = vi.hoisted(() => ({ cache: vi.fn(), invalidate: vi.fn() }));
vi.mock('next/cache', () => ({ unstable_cache: next.cache, revalidateTag: next.invalidate }));

beforeEach(() => {
  vi.resetAllMocks();
  const entries = new Map<string, unknown>();
  next.cache.mockImplementation((load: () => Promise<unknown>, key: string[]) => async () => {
    const id = JSON.stringify(key);
    if (!entries.has(id)) entries.set(id, await load());
    return entries.get(id);
  });
});

it('separa empresas, usuários, papéis e filtros, e reaproveita a mesma combinação', async () => {
  const load = vi.fn(async () => 'primeira página');
  await cachedTickets('a', 'maria', 'admin', 'abertos', load);
  await cachedTickets('a', 'maria', 'admin', 'abertos', load);
  expect(load).toHaveBeenCalledTimes(1);

  for (const [org, viewer, role, filter] of [
    ['b', 'maria', 'admin', 'abertos'],
    ['a', 'joao', 'admin', 'abertos'],
    ['a', 'maria', 'requester', 'abertos'],
    ['a', 'maria', 'admin', 'resolvidos'],
  ]) {
    expect(await cachedTickets(org, viewer, role, filter, async () => 'outra visão')).toBe('outra visão');
  }
});

it('expira as listas da empresa imediatamente após uma mudança', () => {
  invalidateTickets('a');
  expect(next.invalidate).toHaveBeenCalledWith('tickets:a', { expire: 0 });
});
