import { AccountSettingsPage } from '@/components/account-settings-page';

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  return <AccountSettingsPage slug={(await params).slug} />;
}
