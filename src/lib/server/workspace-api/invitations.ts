import { NextResponse } from 'next/server';
import { z } from 'zod';
import { demoEnabled } from '@/lib/data';
import { supabaseServer } from '@/lib/supabase/server';
import { HttpError } from '@/lib/http/api';

import type { Workspace } from '@/lib/data';
export async function handleInvitations(
  workspace: Workspace,
  slug: string,
  id: string | undefined,
  method: string,
  payload: unknown,
  url: URL,
) {
  if (workspace.organization.role !== 'admin')
    throw new HttpError(403, 'Apenas administradores podem gerenciar a equipe.');
  if (demoEnabled()) {
    if (method === 'POST')
      throw new HttpError(422, 'Conecte o Supabase para emitir convites com aceite seguro.');
    return NextResponse.json({ data: [], hasNext: false });
  }
  const db = await supabaseServer();
  if (method === 'POST') {
    z.object({}).strict().parse(payload);
    const { data, error } = await db.rpc('renew_invitation', {
      p_slug: slug,
      p_id: z.uuid().parse(id),
    });
    if (error) throw new Error(error.message);
    return NextResponse.json(data, { status: 201 });
  }
  const filter = z.enum(['pending', 'expired']).parse(url.searchParams.get('status') ?? 'pending');
  const page = z.coerce
    .number()
    .int()
    .min(1)
    .max(1000)
    .parse(url.searchParams.get('page') ?? 1);
  const start = (page - 1) * 25;
  const now = new Date().toISOString();
  const query = db
    .from('invitations')
    .select('id,email,role,expires_at')
    .eq('organization_id', workspace.organization.id)
    .is('accepted_at', null)
    .is('revoked_at', null)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(start, start + 25);
  const { data, error } = await (filter === 'expired'
    ? query.lte('expires_at', now)
    : query.gt('expires_at', now));
  if (error) throw error;
  return NextResponse.json({ data: data.slice(0, 25), hasNext: data.length > 25 });
}
