import { NextResponse } from 'next/server';
import { z } from 'zod';
import { failure, HttpError } from '@/lib/http/api';
import { observeApi } from '@/lib/http/observe-api';
import { accountFlags, requireAccount } from '@/lib/server/account-settings';
import { avatarUrl } from '@/lib/server/avatar-url';

export const GET = observeApi(
  '/api/perfis/[userId]/foto-url',
  async (_request, context: { params: Promise<{ userId: string }> }) => {
    try {
      const { db, user } = await requireAccount();
      const id = z.uuid().safeParse((await context.params).userId);
      if (!id.success || !(await accountFlags()).avatars)
        throw new HttpError(404, 'Foto indisponível.');
      const profile = await db
        .from('profiles')
        .select('avatar_path,avatar_version')
        .eq('user_id', id.data)
        .maybeSingle();
      if (profile.error) throw new HttpError(503, 'Não foi possível consultar a foto.');
      if (!profile.data) throw new HttpError(404, 'Foto indisponível.');
      return NextResponse.json({
        url: profile.data.avatar_path
          ? avatarUrl(user.id, id.data, profile.data.avatar_version)
          : null,
      });
    } catch (error) {
      return failure(error);
    }
  },
);
