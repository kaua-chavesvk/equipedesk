'use client';
import { useTranslations } from '@/features/i18n/context';


import * as Dialog from '@radix-ui/react-dialog';
import { motion, useReducedMotion } from 'motion/react';
import { X } from 'lucide-react';
import { useContext } from 'react';
import { AccountAppearance } from '@/features/account-settings/appearance-context';

export function DeskDialog({ title, description, open, onOpenChange, children, onCloseAutoFocus, lang }: {
  title: string; description: string; open: boolean; onOpenChange: (open: boolean) => void;
  children: React.ReactNode; onCloseAutoFocus?: (event: Event) => void;
  lang?: string;
}) {
  const t = useTranslations();
  const preferences = useContext(AccountAppearance);
  const systemReduction = useReducedMotion();
  const reducedMotion = preferences?.motion === 'reduce' || systemReduction;
  return <Dialog.Root open={open} onOpenChange={onOpenChange}>
    <Dialog.Portal>
      <Dialog.Overlay className="desk-dialog-overlay" />
      <Dialog.Content className="desk-dialog" lang={lang} onCloseAutoFocus={onCloseAutoFocus}>
        <motion.div initial={reducedMotion ? false : { opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }} transition={{ duration: reducedMotion ? 0 : 0.16 }}>
          <Dialog.Title>{title}</Dialog.Title>
          <Dialog.Description className="muted">{description}</Dialog.Description>
          <Dialog.Close className="icon-button desk-dialog-close" aria-label={lang === 'en' ? 'Close' : t("Fechar")}><X size={20}/></Dialog.Close>
          {children}
        </motion.div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
