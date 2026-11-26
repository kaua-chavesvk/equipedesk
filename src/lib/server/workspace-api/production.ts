import { securityEvent } from '@/lib/security';
import { invalidateTickets } from '@/lib/ticket-cache';
import { NextResponse } from 'next/server';
import type { Json } from '@/lib/supabase/database.types';
import { supabaseServer } from '@/lib/supabase/server';

import type { Workspace } from '@/lib/data';
export async function executeProduction(
  workspace: Workspace,
  slug: string,
  action: string,
  validated: Record<string, unknown>,
  request: Request,
) {
  const db = await supabaseServer();
  const { data, error } = await db.rpc('desk_command', {
    p_slug: slug,
    p_action: action,
    p_payload: validated as Json,
  });
  if (error) throw new Error(error.message);
  if (
    process.env.TICKET_CACHE_ENABLED === 'true' &&
    ['create_ticket', 'transition'].includes(action)
  ) {
    try {
      invalidateTickets(workspace.organization.id);
    } catch {
      securityEvent(
        'ticket_cache_invalidation_failed',
        500,
        request.headers.get('x-request-id') ?? undefined,
      );
    }
  }
  return NextResponse.json(data, {
    status: ['create_ticket', 'comment', 'invite'].includes(action) ? 201 : 200,
  });
}
