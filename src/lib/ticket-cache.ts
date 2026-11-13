import { unstable_cache, revalidateTag } from 'next/cache';

export function ticketsTag(organizationId: string) {
  return 'tickets:' + organizationId;
}

export function cachedTickets<T>(
  organizationId: string,
  viewerId: string,
  role: string,
  queryKey: string,
  load: () => Promise<T>,
) {
  return unstable_cache(load, ['ticket-read-v1', organizationId, viewerId, role, queryKey], {
    revalidate: 20,
    tags: [ticketsTag(organizationId)],
  })();
}

export function invalidateTickets(organizationId: string) {
  revalidateTag(ticketsTag(organizationId), { expire: 0 });
}
