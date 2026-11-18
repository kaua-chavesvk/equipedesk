import { z } from 'zod';
import { failure, HttpError } from '@/lib/http/api';
import { observeApi } from '@/lib/http/observe-api';
import { accountFlags, requireAccount } from '@/lib/server/account-settings';
import { validAvatarUrl } from '@/lib/server/avatar-url';

export const GET = observeApi(
  '/api/perfis/[userId]/foto',
  async (request, context: { params: Promise<{ userId: string }> }) => {
    try {
      const { db, user } = await requireAccount();
      const id = z.uuid().safeParse((await context.params).userId);
      if (!id.success || !(await accountFlags()).avatars)
        throw new HttpError(404, 'Foto indisponível.');
      const version = validAvatarUrl(user.id, id.data, new URL(request.url).searchParams);
      if (!version) throw new HttpError(404, 'Foto indisponível.');
      const profile = await db
        .from('profiles')
        .select('avatar_path')
        .eq('user_id', id.data)
        .eq('avatar_version', version)
        .maybeSingle();
      if (profile.error) throw new HttpError(503, 'Não foi possível consultar a foto.');
      if (!profile.data?.avatar_path) throw new HttpError(404, 'Foto indisponível.');
      const result = await db.storage.from('profile-avatars').download(profile.data.avatar_path);
      if (result.error) {
        if (['401', '403', '404'].includes(String(result.error.status)))
          throw new HttpError(404, 'Foto indisponível.');
        throw new HttpError(503, 'Não foi possível carregar a foto.');
      }
      return new Response(result.data, {
        headers: {
          'Content-Type': 'image/webp',
          'Cache-Control': 'private, no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    } catch (error) {
      return failure(error);
    }
  },
);
