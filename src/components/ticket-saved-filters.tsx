'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useTranslations } from '@/features/i18n/context';
import {
  filtersState,
  savedFilter,
  savedFilters,
  type SavedFiltersState,
  type TicketFilter,
} from '@/features/tickets/saved-filters';

export function TicketSavedFilters({
  slug,
  demo,
  current,
  onApply,
}: {
  slug: string;
  demo: boolean;
  current: TicketFilter;
  onApply: (filter: TicketFilter) => void;
}) {
  const t = useTranslations();
  const endpoint = '/api/empresas/' + encodeURIComponent(slug) + '/filtros-salvos';
  const [state, setState] = useState<SavedFiltersState | null>(null);
  const [loading, setLoading] = useState(!demo);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [notice, setNotice] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (demo) return;
    const controller = new AbortController();
    fetch(endpoint, {
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]),
      cache: 'no-store',
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('Não foi possível carregar os filtros salvos.');
        setState(filtersState.parse(await response.json()));
      })
      .catch(() => {
        if (!controller.signal.aborted) setError('Não foi possível carregar os filtros salvos.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [endpoint, demo, retry]);

  async function update(filters: SavedFiltersState['filters']) {
    if (!state || busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(12000),
        body: JSON.stringify({ filters, version: state.version }),
      });
      if (!response.ok)
        throw new Error(
          response.status === 409
            ? 'Os filtros mudaram em outra sessão. Recarregue antes de salvar.'
            : 'Não foi possível salvar os filtros. Tente novamente.',
        );
      setState(filtersState.parse(await response.json()));
      setName('');
      setNotice('Filtros salvos atualizados.');
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Não foi possível salvar os filtros. Tente novamente.',
      );
      // Reload before any next write: a timeout can also occur after a committed write.
      setState(null);
    } finally {
      setBusy(false);
    }
  }

  function save(event: FormEvent) {
    event.preventDefault();
    if (!state) return;
    const item = savedFilter.safeParse({ ...current, id: crypto.randomUUID(), name });
    if (!item.success) {
      setError('Informe um nome de até 40 caracteres.');
      return;
    }
    const next = savedFilters.safeParse([...state.filters, item.data]);
    if (!next.success) {
      setError(
        state.filters.length >= 10
          ? 'Salve no máximo dez filtros por empresa.'
          : 'Use nomes diferentes para os filtros salvos.',
      );
      return;
    }
    void update(next.data);
  }

  function reload() {
    setLoading(true);
    setState(null);
    setError('');
    setRetry((value) => value + 1);
  }

  return (
    <section
      className="saved-filters"
      aria-labelledby="saved-filters-title"
      aria-busy={busy || loading}
    >
      <h3 id="saved-filters-title">{t('Filtros salvos')}</h3>
      <p className="muted">
        {t('Atalhos pessoais desta empresa, disponíveis nos seus dispositivos.')}
      </p>
      <div className="saved-filter-shortcuts" role="group" aria-label={t('Atalhos da fila')}>
        <button
          type="button"
          className="button secondary"
          onClick={() =>
            onApply({
              q: '',
              status: 'all',
              priority: 'urgent',
              assignee: 'me',
              view: current.view,
            })
          }
        >
          {t('Meus urgentes')}
        </button>
        {state?.filters.map((filter) => (
          <div className="saved-filter-item" key={filter.id}>
            <button
              type="button"
              className="button secondary"
              onClick={() =>
                onApply({
                  q: filter.q,
                  status: filter.status,
                  priority: filter.priority,
                  assignee: filter.assignee,
                  view: filter.view,
                })
              }
            >
              {filter.name}
            </button>
            <button
              type="button"
              className="saved-filter-remove"
              disabled={busy}
              aria-label={t('Remover filtro {name}', { name: filter.name })}
              onClick={() => {
                if (window.confirm(t('Remover o filtro {name}?', { name: filter.name })))
                  void update(state.filters.filter((item) => item.id !== filter.id));
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      {demo ? (
        <p className="muted">{t('Conecte sua conta para salvar filtros entre dispositivos.')}</p>
      ) : (
        <>
          {loading && <p role="status">{t('Carregando filtros salvos…')}</p>}
          {state && !state.filters.length && (
            <p className="muted">
              {t('Nenhum filtro salvo. Escolha os filtros da fila e salve um atalho.')}
            </p>
          )}
          {state && (
            <form onSubmit={save} className="saved-filter-form">
              <label>
                {t('Nome do filtro')}
                <input
                  required
                  maxLength={40}
                  value={name}
                  disabled={busy}
                  onChange={(event) => setName(event.target.value)}
                />
              </label>
              <button className="button secondary" disabled={busy || state.filters.length >= 10}>
                {busy ? t('Salvando…') : t('Salvar filtro atual')}
              </button>
            </form>
          )}
          {error && (
            <div>
              <p className="form-error" role="alert">
                {t(error)}
              </p>
              {!state && (
                <button
                  type="button"
                  className="button secondary"
                  disabled={busy || loading}
                  onClick={reload}
                >
                  {t('Recarregar filtros')}
                </button>
              )}
            </div>
          )}
          {notice && <p role="status">{t(notice)}</p>}
        </>
      )}
    </section>
  );
}
