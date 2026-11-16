import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { LegalFooter } from '@/components/cookie-consent';
import { UiProviders } from '@/components/ui-providers';
import { accountPreferences } from '@/lib/server/account-settings';
import './globals.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'EquipeDesk · Atendimento interno',
  description: 'Gerencie chamados e acompanhe o atendimento da sua equipe.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [requestHeaders, preferences] = await Promise.all([headers(), accountPreferences().catch(() => null)]);
  const nonce = requestHeaders.get('x-nonce') ?? undefined;
  return <html lang="pt-BR" suppressHydrationWarning
    data-text-scale={preferences?.text_scale} data-density={preferences?.density}
    data-contrast={preferences?.contrast} data-motion={preferences?.motion}><body>
    <UiProviders nonce={nonce} preferences={preferences}>{children}<LegalFooter /></UiProviders>
  </body></html>;
}
