import type { Metadata } from 'next';
import { LegalFooter } from '@/components/cookie-consent';
import './globals.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'EquipeDesk · Atendimento interno',
  description: 'Gerencie chamados e acompanhe o atendimento da sua equipe.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="pt-BR"><body>{children}<LegalFooter /></body></html>;
}
