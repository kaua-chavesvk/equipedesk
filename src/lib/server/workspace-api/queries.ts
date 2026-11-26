import { queryTickets, ticketCounts, ticketById, queueInput } from '@/lib/ticket-queries';
import { NextResponse } from 'next/server';
import { demoEnabled, demoStore } from '@/lib/data';
import { supabaseServer } from '@/lib/supabase/server';
import { HttpError } from '@/lib/http/api';

import type { Workspace } from '@/lib/data';
export async function handleQuery(
  workspace: Workspace,
  section: string | undefined,
  id: string | undefined,
  url: URL,
) {
  if (section === 'painel') return NextResponse.json(await ticketCounts(workspace));
  if (section === 'membros') {
    if (workspace.organization.role !== 'admin')
      throw new HttpError(403, 'Apenas administradores podem gerenciar a equipe.');
    return NextResponse.json({ data: workspace.members });
  }
  if (section === 'chamados') {
    if (id) {
      const ticket = await ticketById(workspace, id);
      if (!ticket) throw new HttpError(404, 'Chamado não encontrado.');
      if (demoEnabled()) {
        const data = await demoStore();
        return NextResponse.json({
          ticket,
          comments: data.comments[id] ?? [],
          events: data.events[id] ?? [],
        });
      }
      const db = await supabaseServer();
      const [{ data: comments, error: commentError }, { data: events, error: eventError }] =
        await Promise.all([
          db
            .from('comments')
            .select('*')
            .eq('ticket_id', id)
            .eq('organization_id', workspace.organization.id)
            .order('created_at'),
          db
            .from('ticket_events')
            .select('*')
            .eq('ticket_id', id)
            .eq('organization_id', workspace.organization.id)
            .order('created_at'),
        ]);
      if (commentError || eventError) throw commentError ?? eventError;
      return NextResponse.json({ ticket, comments: comments ?? [], events: events ?? [] });
    }
    return NextResponse.json(
      await queryTickets(
        workspace,
        queueInput.parse({ pageSize: 10, ...Object.fromEntries(url.searchParams) }),
      ),
    );
  }
  throw new HttpError(404, 'Recurso não encontrado.');
}
