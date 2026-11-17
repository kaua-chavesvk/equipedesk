'use client';

import { ThemeProvider, useTheme } from 'next-themes';
import { MotionConfig } from 'motion/react';
import { Toaster, toast } from 'sonner';
import { AccountCommands } from './account-commands';
import { useContext, useEffect, useRef, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import type { UserPreferences } from '@/lib/supabase/database.types';

import { AccountAppearance } from '@/features/account-settings/appearance-context';
import { LocaleContext, useLocale, useTranslations } from '@/features/i18n/context';
import type { Locale } from '@/features/i18n/translate';

const subscribe = () => () => {};

function Notifications() {
  const { resolvedTheme, forcedTheme } = useTheme();
  return <Toaster theme={(forcedTheme ?? resolvedTheme) === 'dark' ? 'dark' : 'light'}
    position="bottom-right" closeButton richColors
    offset={{ bottom: '24px', right: '24px' }}
    mobileOffset={{ bottom: 'calc(84px + env(safe-area-inset-bottom))', left: '12px', right: '12px' }} />;
}

export function UiProviders({ children, nonce, preferences, locale }: {
  children: React.ReactNode; nonce?: string; preferences: UserPreferences | null; locale: Locale;
}) {
  const explicit = preferences?.theme_explicit ? preferences.theme : undefined;
  return <LocaleContext.Provider value={locale}><AccountAppearance.Provider value={preferences}>
    <ThemeProvider key={explicit === 'system' ? 'account-system' : 'theme'} attribute="class"
      defaultTheme="system" enableSystem nonce={nonce} storageKey={explicit === 'system' ? 'desk-system-theme' : 'theme'}
      forcedTheme={explicit === 'system' ? undefined : explicit}>
      <MotionConfig reducedMotion={preferences?.motion === 'reduce' ? 'always' : 'user'}>{children}</MotionConfig>
      <Notifications /><AccountCommands />
    </ThemeProvider>
  </AccountAppearance.Provider></LocaleContext.Provider>;
}

export function ThemeSelect() {
  const t = useTranslations();
  const { theme, setTheme, forcedTheme } = useTheme();
  const preferences = useContext(AccountAppearance);
  const router = useRouter();
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const imported = useRef<string>(undefined);
  useEffect(() => {
    if (!preferences || preferences.theme_explicit || imported.current === preferences.user_id) return;
    let previous: string | null;
    try { previous = localStorage.getItem('theme'); } catch { return; }
    if (previous !== 'light' && previous !== 'dark' && previous !== 'system') return;
    imported.current = preferences.user_id;
    void fetch('/api/conta/preferencias', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patch: { theme: previous }, version: preferences.version }),
    }).then(response => {
      if (response.ok || response.status === 409) router.refresh();
    }).catch(() => { /* Keep the existing browser preference if import fails. */ });
  }, [preferences, router]);
  async function change(value: string) {
    if (!preferences) { setTheme(value); return; }
    try {
      const response = await fetch('/api/conta/preferencias', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patch: { theme: value }, version: preferences.version }),
      });
      if (!response.ok) throw new Error();
      router.refresh();
    } catch {
      toast.error(t('Não foi possível salvar o tema. Atualize a página e tente novamente.'));
    }
  }
  const english = useLocale() === 'en';
  return <label className="theme-select" lang={english ? 'en' : undefined}>{english ? 'Theme' : 'Tema'}
    <select aria-label={english ? 'Theme' : 'Tema'} disabled={!mounted} value={mounted ? (preferences?.theme_explicit ? preferences.theme : forcedTheme ?? theme ?? 'system') : 'system'} onChange={event => void change(event.target.value)}>
      <option value="system">{english ? 'System' : 'Sistema'}</option><option value="light">{english ? 'Light' : 'Claro'}</option><option value="dark">{english ? 'Dark' : 'Escuro'}</option>
    </select>
  </label>;
}
