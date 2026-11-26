import { NextResponse } from 'next/server';
import { failure, HttpError } from '@/lib/http/api';
import { observeApi } from '@/lib/http/observe-api';
import { accountFlags, accountPreferences, requireAccount } from '@/lib/server/account-settings';

export const GET = observeApi('/api/conta/configuracoes', async () => {
  try {
    const { db, user } = await requireAccount();
    const flags = await accountFlags();
    if (!flags.settings) throw new HttpError(404, 'Configurações indisponíveis.');
    const [preferences, profile] = await Promise.all([
      accountPreferences(),
      db
        .from('profiles')
        .select('display_name,version,avatar_path,avatar_version')
        .eq('user_id', user.id)
        .single(),
    ]);
    if (!preferences || profile.error)
      throw new HttpError(503, 'Não foi possível carregar suas configurações.');
    return NextResponse.json({
      preferences,
      profile: {
        display_name: profile.data.display_name,
        version: profile.data.version,
        avatar_version: profile.data.avatar_version,
        hasAvatar: !!profile.data.avatar_path,
      },
      avatars: flags.avatars,
    });
  } catch (error) {
    return failure(error);
  }
});
