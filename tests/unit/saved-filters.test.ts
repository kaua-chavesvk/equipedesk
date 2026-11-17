import { expect, it } from 'vitest';
import { filterLocation, filtersUpdate, savedFilters, ticketFilter } from '@/features/tickets/saved-filters';
const filter = { id: 'a1000000-0000-4000-8000-000000000001', name: 'Meus urgentes',
  q: '', status: 'all', priority: 'urgent', assignee: 'me', view: 'kanban' };
it('preenche valores padrão e preserva nomes e busca normalizados', () => {
  expect(ticketFilter.parse({})).toEqual({ q: '', status: 'all', priority: 'all', assignee: 'all', view: 'list' });
  expect(savedFilters.parse([{ ...filter, name: ' Minha fila ', q: ' VPN ' }])[0]).toMatchObject({ name: 'Minha fila', q: 'VPN' });
});
it.each([
  [{ ...filter, name: ' ' }], [{ ...filter, name: 'a'.repeat(41) }],
  [{ ...filter, q: 'a'.repeat(201) }], [{ ...filter, assignee: 'someone-else' }],
  [{ ...filter, status: 'deleted' }], [{ ...filter, view: 'script' }],
  [{ ...filter, organization_id: 'other' }], [{ ...filter, id: 'invalid' }],
  [filter, { ...filter, name: 'Other' }],
  [filter, { ...filter, id: 'a1000000-0000-4000-8000-000000000002', name: 'MEUS URGENTES' }],
].map(input => ({ input })))('recusa filtro inválido ou duplicado', ({ input }) => {
  expect(savedFilters.safeParse(input).success).toBe(false);
});
it('limita dez atalhos por empresa', () => {
  const items = Array.from({ length: 11 }, (_, i) => ({ ...filter, id: 'a1000000-0000-4000-8000-' + String(i).padStart(12, '0'), name: String(i) }));
  expect(savedFilters.safeParse(items.slice(0, 10)).success).toBe(true);
  expect(savedFilters.safeParse(items).success).toBe(false);
});
it.each([-1, 0.5, 2147483647, null])('recusa versão inválida', version => {
  expect(filtersUpdate.safeParse({ filters: [], version }).success).toBe(false);
});
it('não aceita dono ou empresa no corpo da gravação', () => {
  expect(filtersUpdate.safeParse({ filters: [], version: 0, userId: 'other' }).success).toBe(false);
});
it('gera URL de fila na primeira página com valores codificados, sem copiar campos do banco', () => {
  const url = filterLocation('/e/aurora', { ...savedFilters.parse([filter])[0], q: 'a&status=resolved#x' });
  const parsed = new URL(url, 'https://desk.example');
  expect(parsed.pathname).toBe('/e/aurora/chamados');
  expect(parsed.searchParams.get('q')).toBe('a&status=resolved#x');
  expect(parsed.searchParams.get('status')).toBeNull();
  expect(parsed.searchParams.get('assignee')).toBe('me');
  expect(parsed.searchParams.get('view')).toBe('kanban');
  expect(parsed.searchParams.has('page')).toBe(false);
  expect(parsed.searchParams.has('id')).toBe(false);
});
