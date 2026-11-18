'use client';
import { useTranslations } from '@/features/i18n/context';

import { useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';

const subscribe = () => () => {};

export function InviteAcceptance({
  token,
  company,
  role,
  loginRequired,
  unavailable,
}: {
  token: string;
  company?: string;
  role?: string;
  loginRequired?: boolean;
  unavailable?: string;
}) {
  const t = useTranslations();
  const router = useRouter();
  const ready = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function accept() {
    setMessage('');
    setBusy(true);
    try {
      const response = await fetch('/api/convites/aceitar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(
          typeof result.error === 'string'
            ? result.error
            : t('Não foi possível aceitar o convite.'),
        );
      }
      if (typeof result.slug !== 'string' || !/^[a-z0-9][a-z0-9-]{1,59}$/.test(result.slug)) {
        throw new Error(t('Não foi possível abrir a empresa. Acesse seus espaços de trabalho.'));
      }
      toast.success(t('Convite aceito.'));
      router.replace(`/e/${result.slug}`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? t(error.message) : t('Tente novamente.'));
    } finally {
      setBusy(false);
    }
  }

  const roles: Record<string, string> = {
    admin: t('Administrador'),
    agent: t('Atendente'),
    requester: t('Solicitante'),
  };
  return (
    <main className="auth-page">
      <section className="auth-card">
        <span className="eyebrow">{t('VOCÊ FOI CONVIDADO')}</span>
        <h1>{t('Convite para uma empresa')}</h1>
        <p className="muted">
          {t(
            'Entre com o mesmo e-mail verificado que recebeu o convite para fazer parte desta empresa.',
          )}
        </p>
        {company && role && (
          <p className="muted">
            <strong>{company}</strong> · {roles[role]}
          </p>
        )}
        {unavailable && (
          <p className="form-error" role="alert">
            {t(unavailable)}
          </p>
        )}
        {!loginRequired && !unavailable && (
          <button className="button primary" disabled={!ready || busy} onClick={accept}>
            {busy ? t('Aceitando convite…') : t('Aceitar convite')}
          </button>
        )}
        {message && (
          <p className="form-error" role="alert" tabIndex={-1} ref={(element) => element?.focus()}>
            {t(message)}
          </p>
        )}
        <Link className="demo-link" href={`/login?next=${encodeURIComponent(`/convite/${token}`)}`}>
          {t('Entrar na minha conta →')}
        </Link>
      </section>
    </main>
  );
}
