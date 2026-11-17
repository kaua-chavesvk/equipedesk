'use client';

import { useContext, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { AccountAppearance } from '@/features/account-settings/appearance-context';
import { useLocale } from './context';
import type { Locale } from './translate';
const subscribe = () => () => {};

export function rememberLocale(locale: Locale) {
  document.cookie = `desk_locale=${locale}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
}

export function LanguageSelect() {
  const locale = useLocale();
  const preferences = useContext(AccountAppearance);
  const [busy, setBusy] = useState(false);
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const router = useRouter();

  async function change(value: Locale) {
    setBusy(true);
    try {
      if (preferences) {
        const response = await fetch('/api/conta/preferencias', {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ patch: { locale: value }, version: preferences.version }),
        });
        if (!response.ok) throw new Error();
      }
      rememberLocale(value);
      router.refresh();
    } catch {
      toast.error(locale === 'en' ? 'Could not change the language. Reload and try again.' : 'Não foi possível alterar o idioma. Recarregue e tente novamente.');
    } finally {
      setBusy(false);
    }
  }

  return <label className="theme-select">{locale === 'en' ? 'Language' : 'Idioma'}
    <select aria-label={locale === 'en' ? 'Language' : 'Idioma'} value={locale} disabled={busy || !mounted} onChange={event => void change(event.target.value as Locale)}>
      <option value="pt-BR">Português do Brasil</option><option value="en">English</option>
    </select>
  </label>;
}
