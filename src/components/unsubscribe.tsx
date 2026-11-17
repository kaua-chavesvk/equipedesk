'use client';
import { useTranslations } from '@/features/i18n/context';


import { useState } from 'react';
import { toast } from 'sonner';
import { Entrance } from './entrance';

export function Unsubscribe({ token }: { token: string }) {
  const t = useTranslations();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function unsubscribe() {
    setBusy(true);
    try {
      const response = await fetch('/api/privacidade/descadastro', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(typeof result.error === 'string' ? result.error : t("Tente novamente."));
      setDone(true);
      toast.success(t(result.message));
    } catch (error) {
      toast.error(error instanceof Error ? t(error.message) : t("Tente novamente."));
    } finally {
      setBusy(false);
    }
  }

  return <Entrance>
    <p>{t("Confirme para revogar o consentimento de marketing deste link. Não é necessário entrar na conta.")}</p>
    <button className="button primary" disabled={busy || done} onClick={unsubscribe}>
      {done ? t("Solicitação concluída") : busy ? 'Confirmando…' : t("Confirmar descadastro")}
    </button>
  </Entrance>;
}
