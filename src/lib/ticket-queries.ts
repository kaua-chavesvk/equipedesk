import { createClient } from '@supabase/supabase-js';
import type { Database } from './supabase/database.types';
import { boundedSupabaseFetch } from './supabase/fetch';
import { cachedTickets } from './ticket-cache';
import { z } from 'zod';
import { demoEnabled, type Workspace } from './data';
import { supabaseServer } from './supabase/server';

export const queueInput = z.object({
  q: z.string().trim().max(200).default(''),
  status: z.enum(['all','open','in_progress','resolved']).default('all'),
  priority: z.enum(['all','low','medium','high','urgent']).default('all'),
  page: z.coerce.number().int().min(1).max(1000000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(6),
});
export type QueueInput = z.infer<typeof queueInput>;

export async function queryTickets(workspace: Workspace, input: QueueInput) {
  const { q, status, priority, page, pageSize } = input;
  if (demoEnabled()) {
    const tickets = workspace.tickets.filter(t =>
      (status === 'all' || t.status === status) && (priority === 'all' || t.priority === priority) &&
      `${t.title} ${t.description}`.toLowerCase().includes(q.toLowerCase()))
      .sort((a,b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id));
    return { data: tickets.slice((page-1)*pageSize,page*pageSize), total: tickets.length, page, pageSize };
  }
  const db = await supabaseServer();
  const { id: organizationId, role } = workspace.organization;
  const load = async (client: Pick<typeof db, 'from'>) => {
    let query = client.from('tickets').select('*', { count: 'exact' }).eq('organization_id',workspace.organization.id);
    if (status !== 'all') query = query.eq('status',status);
    if (priority !== 'all') query = query.eq('priority',priority);
    // Quote the complete pattern for PostgREST and escape LIKE wildcards.
    if (q) {
      const pattern = JSON.stringify(`%${q.replace(/[\\%_]/g,'\\$&')}%`);
      query = query.or(`title.ilike.${pattern},description.ilike.${pattern}`);
    }
    const { data, count, error } = await query.order('created_at',{ascending:false}).order('id',{ascending:false})
      .range((page-1)*pageSize,page*pageSize-1);
    if (error) throw error;
    return { data: data ?? [], total: count ?? 0, page, pageSize };
  };
  // Keep free-text searches and deep pages out of the persistent cache.
  if (process.env.TICKET_CACHE_ENABLED !== 'true' || q || page > 3) return load(db);
  // The workspace was authorized for this request. On a cache miss, the
  // stateless client executes the query under the current user’s RLS.
  const { data: { session }, error } = await db.auth.getSession();
  if (error || !session || session.user.id !== workspace.user.id) return load(db);

  const client = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      accessToken: async () => session.access_token,
      global: { fetch: (input, init) => boundedSupabaseFetch(input, { ...init, cache: 'no-store' }) },
    });
  return cachedTickets(organizationId, workspace.user.id, role,
    JSON.stringify([status, priority, page, pageSize]), () => load(client));
}

export async function ticketCounts(workspace: Workspace) {
  const states = ['open','in_progress','resolved'] as const;
  const values = await Promise.all(states.map(async status => {
    if (demoEnabled()) return workspace.tickets.filter(t => t.status === status).length;
    const db = await supabaseServer();
    const { count, error } = await db.from('tickets').select('id',{count:'exact',head:true})
      .eq('organization_id',workspace.organization.id).eq('status',status);
    if (error) throw error;
    return count ?? 0;
  }));
  return { open: values[0], in_progress: values[1], resolved: values[2], total: values.reduce((a,b)=>a+b,0) };
}

export async function ticketById(workspace: Workspace, id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  if (demoEnabled()) return workspace.tickets.find(t => t.id === id) ?? null;
  const db = await supabaseServer();
  const { data, error } = await db.from('tickets').select('*').eq('organization_id',workspace.organization.id).eq('id',id).maybeSingle();
  if (error) throw error;
  return data;
}
