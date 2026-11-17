import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { LegalFooter } from '@/components/cookie-consent';
import { UiProviders } from '@/components/ui-providers';
import { accountPreferences } from '@/lib/server/account-settings';
import { requestLocale, serverTranslations } from '@/features/i18n/server';
import './globals.css';

export const dynamic = 'force-dynamic';
export async function generateMetadata(): Promise<Metadata> {
  const t = await serverTranslations();
  return { title: t('EquipeDesk · Atendimento interno'),
    description: t('Gerencie chamados e acompanhe o atendimento da sua equipe.') };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [requestHeaders, preferences, locale] = await Promise.all([headers(), accountPreferences().catch(() => null), requestLocale()]);
  const nonce = requestHeaders.get('x-nonce') ?? undefined;
  return <html lang={locale} suppressHydrationWarning
    data-text-scale={preferences?.text_scale} data-density={preferences?.density}
    data-contrast={preferences?.contrast} data-motion={preferences?.motion}><body>
    <UiProviders nonce={nonce} preferences={preferences} locale={locale}>{children}<LegalFooter /></UiProviders>
  </body></html>;
}
