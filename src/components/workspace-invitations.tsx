'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from '@/features/i18n/context';
import { invitationLink, type ManagedInvitation } from '@/features/invitations/management';

type InvitationPage = { data: ManagedInvitation[]; hasNext: boolean };
const roles = { admin: 'Administrador', agent: 'Atendente', requester: 'Solicitante' };

export function WorkspaceInvitations({ slug, revision }: { slug: string; revision: string }) {
  const t = useTranslations();
  const locale = useLocale();
  const [filter, setFilter] = useState<'pending' | 'expired'>('pending');
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [result, setResult] = useState<InvitationPage>();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [link, setLink] = useState<string>();
  const base = '/api/empresas/' + encodeURIComponent(slug) + '/convites';

  useEffect(() => {
    const controller = new AbortController();
    fetch(base + '?' + new URLSearchParams({ status: filter, page: String(page) }), {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const next: InvitationPage = await response.json();
        if (controller.signal.aborted) return;
        if (next.data.length === 0 && page > 1) {
          setPage(page - 1);
          return;
        }
        setResult(next);
        setLoading(false);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setResult(undefined);
        setError('Não foi possível consultar os convites.');
        setLoading(false);
      });
    return () => controller.abort();
  }, [base, filter, page, revision, reload]);

  async function change(id: string, renew: boolean) {
    if (
      !window.confirm(
        t(renew ? 'Renovar este convite e invalidar o link anterior?' : 'Revogar este convite?'),
      )
    )
      return;
    setBusy(true);
    setLink(undefined);
    setError('');
    setMessage('');
    try {
      const response = await fetch(
        base + '/' + id + (renew ? '/renovar' : ''),
        renew
          ? {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: '{}',
            }
          : { method: 'DELETE' },
      );
      if (!response.ok) {
        const problem = await response.json();
        throw new Error(
          typeof problem.error === 'string'
            ? problem.error
            : 'Não foi possível atualizar o convite.',
        );
      }
      if (renew) {
        const issued = await response.json();
        const url = invitationLink(issued.token, window.location.origin);
        if (!url || typeof issued.id !== 'string')
          throw new Error('Não foi possível obter o novo link.');
        setLink(url);
      }
      setMessage(renew ? 'Novo link gerado para compartilhar.' : 'Convite revogado.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível atualizar o convite.');
    } finally {
      setBusy(false);
      setLoading(true);
      setReload((value) => value + 1);
    }
  }

  return (
    <section
      className="panel invitations-panel"
      aria-labelledby="invitations-heading"
      aria-busy={loading || busy}
    >
      <h2 id="invitations-heading">{t('Convites da empresa')}</h2>
      <div className="tabs" role="group" aria-label={t('Estado dos convites')}>
        {(['pending', 'expired'] as const).map((value) => (
          <button
            key={value}
            type="button"
            disabled={busy}
            aria-pressed={filter === value}
            className={filter === value ? 'selected' : ''}
            onClick={() => {
              if (filter === value) return;
              setLoading(true);
              setError('');
              setFilter(value);
              setPage(1);
            }}
          >
            {t(value === 'pending' ? 'Pendentes' : 'Expirados')}
          </button>
        ))}
      </div>
      {loading && <p role="status">{t('Carregando convites…')}</p>}
      {error && (
        <p className="form-error" role="alert">
          {t(error)}
        </p>
      )}
      {!loading && !result && (
        <button
          className="button secondary"
          type="button"
          onClick={() => {
            setLoading(true);
            setReload((value) => value + 1);
          }}
        >
          {t('Tentar novamente')}
        </button>
      )}
      {message && <p role="status">{t(message)}</p>}
      {link && (
        <div className="invite-result">
          <label>
            {t('Link de convite')}
            <input readOnly value={link} onFocus={(event) => event.currentTarget.select()} />
          </label>
          <button
            className="button secondary"
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(link);
                setMessage('Link copiado.');
              } catch {
                setMessage('Não foi possível copiar. Selecione o link e copie manualmente.');
              }
            }}
          >
            {t('Copiar link')}
          </button>
        </div>
      )}
      {!loading && result?.data.length === 0 && (
        <p>{t(filter === 'pending' ? 'Nenhum convite pendente.' : 'Nenhum convite expirado.')}</p>
      )}
      {!loading && result && (
        <ul className="members-list">
          {result.data.map((invite) => (
            <li className="member-row" key={invite.id}>
              <div className="member-info">
                <strong>{invite.email}</strong>
                <span>
                  {t(roles[invite.role])} ·{' '}
                  {new Intl.DateTimeFormat(locale, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }).format(new Date(invite.expires_at))}
                </span>
              </div>
              <button
                type="button"
                className="button secondary"
                disabled={busy}
                onClick={() => void change(invite.id, true)}
              >
                {t('Gerar novo link')}
              </button>
              <button
                type="button"
                className="button secondary"
                disabled={busy}
                onClick={() => void change(invite.id, false)}
              >
                {t('Revogar convite')}
              </button>
            </li>
          ))}
        </ul>
      )}
      {!loading && result && (page > 1 || result.hasNext) && (
        <div className="pagination">
          <button
            type="button"
            disabled={busy || page <= 1}
            onClick={() => {
              setLoading(true);
              setPage(page - 1);
            }}
          >
            {t('Página anterior')}
          </button>
          <button
            type="button"
            disabled={busy || !result.hasNext || page >= 1000}
            onClick={() => {
              setLoading(true);
              setPage(page + 1);
            }}
          >
            {t('Próxima página')}
          </button>
        </div>
      )}
    </section>
  );
}
