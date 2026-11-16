'use client';

import { ThemeProvider, useTheme } from 'next-themes';
import { MotionConfig } from 'motion/react';
import { Toaster, toast } from 'sonner';
import { AccountCommands } from './account-commands';
import { useContext, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import type { UserPreferences } from '@/lib/supabase/database.types';

import { AccountAppearance } from '@/features/account-settings/appearance-context';

const subscribe = () => () => {};

function Notifications() {
  const { resolvedTheme } = useTheme();
  return <Toaster theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
    position="bottom-right" closeButton richColors
    offset={{ bottom: '24px', right: '24px' }}
    mobileOffset={{ bottom: 'calc(84px + env(safe-area-inset-bottom))', left: '12px', right: '12px' }} />;
}

export function UiProviders({ children, nonce, preferences }: {
  children: React.ReactNode; nonce?: string; preferences: UserPreferences | null;
}) {
  return <AccountAppearance.Provider value={preferences}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem nonce={nonce}
      forcedTheme={preferences?.theme_explicit ? preferences.theme : undefined}>
      <MotionConfig reducedMotion={preferences?.motion === 'reduce' ? 'always' : 'user'}>{children}</MotionConfig>
      <Notifications /><AccountCommands />
    </ThemeProvider>
  </AccountAppearance.Provider>;
}

export function ThemeSelect() {
  const { theme, setTheme, forcedTheme } = useTheme();
  const preferences = useContext(AccountAppearance);
  const router = useRouter();
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
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
      toast.error('Não foi possível salvar o tema. Atualize a página e tente novamente.');
    }
  }
  return <label className="theme-select">Tema
    <select aria-label="Tema" disabled={!mounted} value={mounted ? forcedTheme ?? theme ?? 'system' : 'system'} onChange={event => void change(event.target.value)}>
      <option value="system">Sistema</option><option value="light">Claro</option><option value="dark">Escuro</option>
    </select>
  </label>;
}
