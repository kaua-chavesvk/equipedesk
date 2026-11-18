import { notFound, redirect } from 'next/navigation';
import { accountScope } from '@/lib/server/account-settings';
import { adminMfaStatus } from '@/lib/server/admin-mfa';
import { AdminMfa } from '@/components/admin-mfa';

export default async function Page() {
  const scope = await accountScope();
  if (!scope) redirect('/login');
  const { data, error } = await scope.db
    .from('platform_admins')
    .select('user_id')
    .eq('user_id', scope.user.id)
    .maybeSingle();
  if (error) throw new Error('Não foi possível verificar sua permissão.');
  if (!data) notFound();
  return <AdminMfa initial={await adminMfaStatus(scope.db.auth, scope.user.id)} />;
}
