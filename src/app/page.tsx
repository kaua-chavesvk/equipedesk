import { workspaceStart } from '@/lib/server/account-settings';
import { redirect } from 'next/navigation';
import { demoEnabled, listOrganizations } from '@/lib/data';
export const dynamic = 'force-dynamic';
export default async function Home() {
  if (demoEnabled()) redirect('/e/aurora');
  const organizations = await listOrganizations();
  redirect(
    organizations.length
      ? await workspaceStart(organizations[0].slug, organizations[0].id)
      : '/onboarding',
  );
}
