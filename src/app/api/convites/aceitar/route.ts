import { NextResponse } from 'next/server';
import { z } from 'zod';
import { demoEnabled } from '@/lib/data';
import { failure, HttpError } from '@/lib/http/api';
import { readJson } from '@/lib/http/read-json';
import { securityEvent } from '@/lib/security';
import { supabaseServer } from '@/lib/supabase/server';

const inviteInput = z.object({ token: z.string().min(32).max(256) }).strict();

export async function POST(request: Request) {
  try {
    const input = inviteInput.parse(await readJson(request));
    if (demoEnabled()) throw new HttpError(422, 'Conecte o Supabase para aceitar convites.');

    const db = await supabaseServer();
    const { data: { user }, error: authError } = await db.auth.getUser();
    if (!user) {
      if (authError && authError.name !== 'AuthSessionMissingError' && ![400, 401, 403].includes(authError.status ?? 0)) {
        throw new HttpError(503, 'Não foi possível verificar sua sessão agora. Tente novamente.');
      }
      throw new HttpError(401, 'Entre com o e-mail que recebeu o convite e tente novamente.');
    }

    const { data, error } = await db.rpc('desk_command', {
      p_slug: '', p_action: 'accept_invite', p_payload: input,
    });
    if (error?.code === 'P0001') throw new Error(error.message);
    if (error) {
      securityEvent('invite_accept_backend_error', 503, request.headers.get('x-request-id') ?? undefined);
      throw new HttpError(503, 'Não foi possível verificar o convite agora. Tente novamente.');
    }
    return NextResponse.json(data);
  } catch (error) {
    return failure(error);
  }
}
