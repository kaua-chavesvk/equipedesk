'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { useTranslations } from '@/features/i18n/context';
import type { MfaEnrollment, MfaInput, MfaStatus } from '@/features/security/mfa';

export function AdminMfa({ initial }: { initial: MfaStatus }) {
  const t = useTranslations();
  const router = useRouter();
  const [status, setStatus] = useState(initial);
  const [enrollment, setEnrollment] = useState<MfaEnrollment | null>(null);
  const [factorId, setFactorId] = useState(initial.factors[0]?.id ?? '');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function send(input: MfaInput) {
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/conta/mfa', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input), cache: 'no-store',
      });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error ?? 'Não foi possível concluir a operação. Tente novamente.');
      }
      if (input.action === 'enroll') {
        const data: MfaEnrollment = await response.json();
        setEnrollment(data); setFactorId(data.factorId);
        setStatus(current => ({ ...current, factors: [{ id: data.factorId, status: 'unverified' }] }));
      } else {
        const data: MfaStatus = await response.json();
        setStatus(data); setEnrollment(null); setCode(''); setFactorId(data.factors[0]?.id ?? '');
        setNotice(input.action === 'verify' ? 'Segundo fator confirmado nesta sessão.' : 'Cadastro do autenticador cancelado.');
        router.refresh();
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível concluir a operação. Tente novamente.');
    } finally { setBusy(false); }
  }

  function verify(event: FormEvent) {
    event.preventDefault();
    void send({ action: 'verify', factorId, code });
  }

  return <main className="settings-page">
    <Link className="text-link" href="/onboarding">{t('Seus espaços de trabalho')}</Link>
    <h1>{t('Segurança da administração')}</h1>
    <section className="panel mfa-panel" aria-labelledby="mfa-heading" aria-busy={busy}>
      <h2 id="mfa-heading">{t('Autenticação em dois fatores')}</h2>
      <p>{t('Use um aplicativo autenticador para proteger as operações de administrador geral.')}</p>
      <p role="status">{status.verified ? t('Segundo fator confirmado nesta sessão.') : t('Confirme um código para elevar a segurança desta sessão.')}</p>
      {error && <div><p className="form-error" role="alert">{t(error)}</p><button type="button" className="button secondary" disabled={busy} onClick={() => window.location.reload()}>{t('Recarregar')}</button></div>}
      {notice && <p role="status">{t(notice)}</p>}
      {!status.factors.length && <button className="button primary" disabled={busy} onClick={() => void send({ action: 'enroll' })}>{t('Cadastrar autenticador')}</button>}
      {enrollment && <div className="mfa-enrollment">
        <p>{t('Escaneie o QR code no autenticador ou informe a chave manualmente. A configuração só termina após confirmar um código.')}</p>
        <Image unoptimized width={220} height={220} src={enrollment.qrCode} alt={t('QR code para configurar o autenticador')} />
        <label>{t('Chave de configuração')}<input readOnly value={enrollment.secret} autoComplete="off" spellCheck={false} onFocus={event => event.target.select()} /></label>
        <p>{t('Não compartilhe esta chave. Ela não será exibida novamente após sair desta página.')}</p>
      </div>}
      {status.factors.filter(factor => factor.status === 'unverified').map(factor => <div key={factor.id} className="settings-actions">
        <button type="button" className="button secondary" disabled={busy} onClick={() => {
          if (window.confirm(t('Cancelar este cadastro pendente? Será necessário configurar uma nova chave.'))) void send({ action: 'cancel', factorId: factor.id });
        }}>{t('Cancelar cadastro pendente')}</button>
      </div>)}
      {!!status.factors.length && !status.verified && <form onSubmit={verify}>
        <fieldset disabled={busy} className="mfa-fields">
          <label>{t('Autenticador')}<select value={factorId} onChange={event => setFactorId(event.target.value)}>
            {status.factors.map((factor, index) => <option key={factor.id} value={factor.id}>{t('Autenticador')} {index + 1} · {factor.status === 'verified' ? t('Configurado') : t('Cadastro pendente')}</option>)}
          </select></label>
          <label>{t('Código de seis dígitos')}<input required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} /></label>
          <div className="settings-actions"><button className="button primary">{busy ? t('Confirmando…') : t('Confirmar código')}</button></div>
        </fieldset>
      </form>}
      <p>{t('Se perdeu acesso ao autenticador configurado, contate o responsável pela plataforma para recuperar o acesso após verificar sua identidade.')}</p>
      {status.verified && <Link className="text-link" href="/admin/privacidade">{t('Ir para a administração')}</Link>}
    </section>
  </main>;
}
