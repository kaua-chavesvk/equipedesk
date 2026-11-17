'use client';
import { useTranslations } from '@/features/i18n/context';

import Link from 'next/link';
import { ThemeSelect } from './ui-providers';
import { LanguageSelect } from '@/features/i18n/language-select';

export function LegalFooter() {
  const t = useTranslations();
  return <footer className="legal-footer">
    <Link href="/privacidade">{t("Privacidade")}</Link>
    <Link href="/termos">{t("Termos de uso")}</Link>
    <Link href="/meus-dados">{t("Meus dados")}</Link>
    <Link href="/licencas">{t("Licenças")}</Link>
    <ThemeSelect />
    <LanguageSelect />
  </footer>;
}
