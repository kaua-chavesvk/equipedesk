'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { WorkspaceCommands } from './workspace-commands';

export function AccountCommands() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (pathname.startsWith('/e/') && !pathname.endsWith('/configuracoes')) return;
    function keyboard(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'k') return;
      if (!open && document.querySelector('[role="dialog"]')) return;
      event.preventDefault();
      if (!open) trigger.current = document.activeElement as HTMLElement | null;
      setOpen((value) => !value);
    }
    document.addEventListener('keydown', keyboard);
    return () => document.removeEventListener('keydown', keyboard);
  }, [pathname, open]);

  const base = pathname.startsWith('/e/') ? pathname.split('/').slice(0, 3).join('/') : undefined;
  return (
    open && (
      <WorkspaceCommands
        open
        onOpenChange={setOpen}
        base={base}
        organizations={[]}
        tickets={[]}
        restoreFocus={() => trigger.current?.focus()}
      />
    )
  );
}
