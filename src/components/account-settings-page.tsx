import { notFound, redirect } from 'next/navigation';
import { accountFlags, accountPreferences, accountScope } from '@/lib/server/account-settings';
import { getWorkspace } from '@/lib/data';
import { AccountSettings } from './account-settings';
import { avatarUrl } from '@/lib/server/avatar-url';

export async function AccountSettingsPage({ slug }: { slug?: string }) {
  const scope = await accountScope();
  if (!scope) redirect('/login');
  const { settings, avatars } = await accountFlags();
  if (!settings) notFound();
  if (slug) {
    try { await getWorkspace(slug); }
    catch (error) {
      if (error instanceof Error && error.message === 'Empresa não encontrada.') notFound();
      throw error;
    }
  }
  const [preferences, profile, admin] = await Promise.all([
    accountPreferences(),
    scope.db.from('profiles').select('display_name,version,avatar_version,avatar_path').eq('user_id', scope.user.id).single(),
    scope.db.from('platform_admins').select('user_id').eq('user_id', scope.user.id).maybeSingle(),
  ]);
  if (!preferences || profile.error) throw new Error('Não foi possível carregar suas configurações.');
  return <AccountSettings key={preferences.version + ':' + profile.data.version} preferences={preferences}
    profile={{ display_name: profile.data.display_name, version: profile.data.version,
      avatar_version: profile.data.avatar_version, hasAvatar: !!profile.data.avatar_path }}
    platformAdmin={!admin.error && !!admin.data} avatars={avatars} photoUrl={avatars && profile.data.avatar_path ? avatarUrl(scope.user.id, scope.user.id, profile.data.avatar_version) : null}
    email={scope.user.email ?? ''} back={slug ? '/e/' + slug : undefined} />;
}
