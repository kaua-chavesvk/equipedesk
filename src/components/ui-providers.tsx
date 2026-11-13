'use client';

import { ThemeProvider, useTheme } from 'next-themes';
import { MotionConfig } from 'motion/react';
import { Toaster } from 'sonner';
import { AccountCommands } from './account-commands';
import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

function Notifications() {
  const { resolvedTheme } = useTheme();
  return <Toaster theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
    position="bottom-right" closeButton richColors
    offset={{ bottom: '24px', right: '24px' }}
    mobileOffset={{ bottom: 'calc(84px + env(safe-area-inset-bottom))', left: '12px', right: '12px' }} />;
}

export function UiProviders({ children, nonce }: { children: React.ReactNode; nonce?: string }) {
  return <ThemeProvider attribute="class" defaultTheme="system" enableSystem nonce={nonce}>
    <MotionConfig reducedMotion="user">{children}</MotionConfig>
    <Notifications /><AccountCommands />
  </ThemeProvider>;
}

export function ThemeSelect() {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  return <label className="theme-select">Tema
    <select aria-label="Tema" disabled={!mounted} value={mounted ? theme ?? 'system' : 'system'} onChange={event => setTheme(event.target.value)}>
      <option value="system">Sistema</option><option value="light">Claro</option><option value="dark">Escuro</option>
    </select>
  </label>;
}
