'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { WorkspaceCommands } from './workspace-commands';

export function AccountCommands() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (pathname.startsWith('/e/')) return;
    function keyboard(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'k') return;
      if (!open && document.querySelector('[role="dialog"]')) return;
      event.preventDefault();
      if (!open) trigger.current = document.activeElement as HTMLElement | null;
      setOpen(value => !value);
    }
    document.addEventListener('keydown', keyboard);
    return () => document.removeEventListener('keydown', keyboard);
  }, [pathname, open]);

  return open && <WorkspaceCommands open onOpenChange={setOpen} organizations={[]} tickets={[]}
    restoreFocus={() => trigger.current?.focus()} />;
}
