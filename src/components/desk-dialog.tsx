'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { motion, useReducedMotion } from 'motion/react';
import { X } from 'lucide-react';

export function DeskDialog({ title, description, open, onOpenChange, children, onCloseAutoFocus }: {
  title: string; description: string; open: boolean; onOpenChange: (open: boolean) => void;
  children: React.ReactNode; onCloseAutoFocus?: (event: Event) => void;
}) {
  const reducedMotion = useReducedMotion();
  return <Dialog.Root open={open} onOpenChange={onOpenChange}>
    <Dialog.Portal>
      <Dialog.Overlay className="desk-dialog-overlay" />
      <Dialog.Content className="desk-dialog" onCloseAutoFocus={onCloseAutoFocus}>
        <motion.div initial={reducedMotion ? false : { opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }} transition={{ duration: reducedMotion ? 0 : 0.16 }}>
          <Dialog.Title>{title}</Dialog.Title>
          <Dialog.Description className="muted">{description}</Dialog.Description>
          <Dialog.Close className="icon-button desk-dialog-close" aria-label="Fechar"><X size={20}/></Dialog.Close>
          {children}
        </motion.div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
