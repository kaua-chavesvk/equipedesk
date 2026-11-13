'use client';
import { useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const subscribe = () => () => {};

export function InviteAcceptance({ token, company, role, loginRequired, unavailable }: { token: string; company?: string; role?: string; loginRequired?: boolean; unavailable?: string }) {
  const router = useRouter();
  const ready = useSyncExternalStore(subscribe, () => true, () => false);
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
        throw new Error(typeof result.error === 'string' ? result.error : 'Não foi possível aceitar o convite.');
      }
      if (typeof result.slug !== 'string' || !/^[a-z0-9][a-z0-9-]{1,59}$/.test(result.slug)) {
        throw new Error('Não foi possível abrir a empresa. Acesse seus espaços de trabalho.');
      }
      router.replace(`/e/${result.slug}`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Tente novamente.');
    } finally {
      setBusy(false);
    }
  }

  const roles: Record<string, string> = { admin: "Administrador", agent: "Atendente", requester: "Solicitante" };
  return <main className="auth-page"><section className="auth-card">
    <span className="eyebrow">VOCÊ FOI CONVIDADO</span>
    <h1>Convite para uma empresa</h1>
    <p className="muted">Entre com o mesmo e-mail verificado que recebeu o convite para fazer parte desta empresa.</p>
    {company && role && <p className="muted"><strong>{company}</strong> · {roles[role]}</p>}
    {unavailable && <p className="form-error" role="alert">{unavailable}</p>}
    {!loginRequired && !unavailable && <button className="button primary" disabled={!ready || busy} onClick={accept}>{busy ? 'Aceitando convite…' : 'Aceitar convite'}</button>}
    {message && <p className="form-error" role="alert" tabIndex={-1} ref={element => element?.focus()}>{message}</p>}
    <Link className="demo-link" href={`/login?next=${encodeURIComponent(`/convite/${token}`)}`}>Entrar na minha conta →</Link>
  </section></main>;
}
