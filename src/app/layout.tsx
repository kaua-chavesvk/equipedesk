import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { LegalFooter } from '@/components/cookie-consent';
import { UiProviders } from '@/components/ui-providers';
import './globals.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'EquipeDesk · Atendimento interno',
  description: 'Gerencie chamados e acompanhe o atendimento da sua equipe.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  return <html lang="pt-BR" suppressHydrationWarning><body>
    <UiProviders nonce={nonce}>{children}<LegalFooter /></UiProviders>
  </body></html>;
}
