import { z } from 'zod';

export const ticketFilter = z
  .object({
    q: z.string().trim().max(200).default(''),
    status: z.enum(['all', 'open', 'in_progress', 'resolved']).default('all'),
    priority: z.enum(['all', 'low', 'medium', 'high', 'urgent']).default('all'),
    assignee: z.enum(['all', 'me']).default('all'),
    view: z.enum(['list', 'kanban']).default('list'),
  })
  .strict();

export type TicketFilter = z.infer<typeof ticketFilter>;
export const savedFilter = ticketFilter.extend({
  id: z.uuid(),
  name: z.string().trim().min(1).max(40),
});
export type SavedFilter = z.infer<typeof savedFilter>;
export const savedFilters = z
  .array(savedFilter)
  .max(10)
  .superRefine((items, ctx) => {
    if (
      new Set(items.map((item) => item.id)).size !== items.length ||
      new Set(items.map((item) => item.name.toLowerCase())).size !== items.length
    ) {
      ctx.addIssue({ code: 'custom', message: 'Use nomes diferentes para os filtros salvos.' });
    }
  });
export const filtersUpdate = z
  .object({
    filters: savedFilters,
    version: z.number().int().min(0).max(2147483646),
  })
  .strict();
export type SavedFiltersState = { filters: SavedFilter[]; version: number };
export const filtersState = z.object({
  filters: savedFilters,
  version: z.number().int().nonnegative(),
});

export function filterLocation(base: string, filter: TicketFilter) {
  const { q, status, priority, assignee, view } = filter;
  const input = ticketFilter.parse({ q, status, priority, assignee, view });
  const params = new URLSearchParams();
  if (input.q) params.set('q', input.q);
  if (input.status !== 'all') params.set('status', input.status);
  if (input.priority !== 'all') params.set('priority', input.priority);
  if (input.assignee !== 'all') params.set('assignee', input.assignee);
  params.set('view', input.view);
  return base + '/chamados?' + params.toString();
}
