'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useSyncExternalStore, type FormEvent } from 'react';
import { toast } from 'sonner';
import { DEFAULT_ACCOUNT_PREFERENCES, preferencesSchema, type AccountPreferences } from '@/features/account-settings/contracts';
import type { UserPreferences } from '@/lib/supabase/database.types';
import { AvatarSettings } from './avatar-settings';
import { rememberLocale } from '@/features/i18n/language-select';
const subscribe = () => () => {};

const copy = {
  'pt-BR': {
    title: 'Configurações', appearance: 'Aparência e idioma', account: 'Minha conta',
    theme: 'Tema', light: 'Claro', dark: 'Escuro', system: 'Sistema', text: 'Tamanho do texto',
    density: 'Densidade', comfortable: 'Confortável', compact: 'Compacta', contrast: 'Contraste',
    standard: 'Padrão', high: 'Alto', motion: 'Movimento', reduce: 'Reduzir', language: 'Idioma',
    timezone: 'Fuso horário', auto: 'Automático', manual: 'Manual', zone: 'Identificador do fuso',
    home: 'Página inicial do workspace', queue: 'Visualização da fila', list: 'Lista',
    last: 'Última visualização', save: 'Salvar preferências', saving: 'Salvando…', cancel: 'Cancelar',
    name: 'Nome de exibição', saveName: 'Salvar nome', email: 'E-mail da conta',
    password: 'Alterar senha', privacy: 'Meus dados e marketing', cookies: 'Cookies e rastreamento',
    saved: 'Configurações salvas.', error: 'Não foi possível salvar. Confira os dados e tente novamente.',
    conflict: 'As configurações mudaram em outra sessão. Recarregue para continuar.', reload: 'Recarregar',
    back: 'Voltar ao workspace', spaces: 'Seus espaços de trabalho', preview: 'Prévia', sample: 'Seu texto aparecerá assim.',
  },
  en: {
    title: 'Settings', appearance: 'Appearance and language', account: 'My account',
    theme: 'Theme', light: 'Light', dark: 'Dark', system: 'System', text: 'Text size',
    density: 'Density', comfortable: 'Comfortable', compact: 'Compact', contrast: 'Contrast',
    standard: 'Standard', high: 'High', motion: 'Motion', reduce: 'Reduce', language: 'Language',
    timezone: 'Time zone', auto: 'Automatic', manual: 'Manual', zone: 'Time zone identifier',
    home: 'Workspace start page', queue: 'Queue view', list: 'List',
    last: 'Last view', save: 'Save preferences', saving: 'Saving…', cancel: 'Cancel',
    name: 'Display name', saveName: 'Save name', email: 'Account email',
    password: 'Change password', privacy: 'My data and marketing', cookies: 'Cookies and tracking',
    saved: 'Settings saved.', error: 'Could not save. Check the fields and try again.',
    conflict: 'Settings changed in another session. Reload to continue.', reload: 'Reload',
    back: 'Back to workspace', spaces: 'Your workspaces', preview: 'Preview', sample: 'This is how your text will appear.',
  },
} as const;

export function AccountSettings({ preferences, profile, email, back, avatars, photoUrl, platformAdmin }: {
  preferences: UserPreferences;
  profile: { display_name: string; version: number; avatar_version: number; hasAvatar: boolean };
  email: string; back?: string; avatars: boolean; photoUrl?: string | null;
  platformAdmin?: boolean;
}) {
  const router = useRouter();
  const t = copy[preferences.locale];
  const [saved, setSaved] = useState(preferences);
  const [draft, setDraft] = useState<AccountPreferences>(preferences);
  const [name, setName] = useState(profile.display_name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);

  async function submit(event: FormEvent, path: string, body: unknown) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setConflict(false);
    try {
      const response = await fetch(path, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      if (!response.ok) {
        setConflict(response.status === 409);
        throw new Error(response.status === 409 ? t.conflict : t.error);
      }
      if (path.endsWith('/preferencias')) {
        const updated = await response.json() as UserPreferences;
        setSaved(updated);
        setDraft(updated);
        rememberLocale(updated.locale);
      }
      toast.success(t.saved);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t.error);
    } finally {
      setBusy(false);
    }
  }

  function field<K extends keyof AccountPreferences>(key: K, value: AccountPreferences[K]) {
    setDraft(current => ({ ...current, [key]: value }));
  }

  function savePreferences(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = Object.keys(DEFAULT_ACCOUNT_PREFERENCES) as (keyof AccountPreferences)[];
    const values = Object.fromEntries(fields.map(key => [key, draft[key]]));
    const input = preferencesSchema.safeParse(values);
    if (!input.success) { setError(t.error); return; }
    const patch = Object.fromEntries(Object.entries(input.data).filter(([key, value]) => saved[key as keyof AccountPreferences] !== value));
    if (!Object.keys(patch).length) return;
    void submit(event, '/api/conta/preferencias', { patch, version: saved.version });
  }

  return <main className="settings-page" lang={preferences.locale}>
    <Link className="text-link" href={back ?? '/onboarding'}>{back ? t.back : t.spaces}</Link>
    <h1>{t.title}</h1>
    {error && <p className="form-error" role="alert" tabIndex={-1} ref={element => element?.focus()}>{error}</p>}
    {conflict && <button className="button secondary" onClick={() => window.location.reload()}>{t.reload}</button>}
    <div className="settings-columns">
      <section className="panel" aria-labelledby="appearance-heading">
        <h2 id="appearance-heading">{t.appearance}</h2>
        <form onSubmit={savePreferences}>
          <fieldset className="settings-fields" disabled={busy || !mounted}>
            <label>{t.theme}<select aria-label={t.theme} value={draft.theme} onChange={e => field('theme', e.target.value as AccountPreferences['theme'])}><option value="system">{t.system}</option><option value="light">{t.light}</option><option value="dark">{t.dark}</option></select></label>
            <label>{t.text}<select value={draft.text_scale} onChange={e => field('text_scale', Number(e.target.value) as AccountPreferences['text_scale'])}><option value="100">100%</option><option value="110">110%</option><option value="125">125%</option></select></label>
            <label>{t.density}<select value={draft.density} onChange={e => field('density', e.target.value as AccountPreferences['density'])}><option value="comfortable">{t.comfortable}</option><option value="compact">{t.compact}</option></select></label>
            <label>{t.contrast}<select value={draft.contrast} onChange={e => field('contrast', e.target.value as AccountPreferences['contrast'])}><option value="standard">{t.standard}</option><option value="high">{t.high}</option></select></label>
            <label>{t.motion}<select value={draft.motion} onChange={e => field('motion', e.target.value as AccountPreferences['motion'])}><option value="system">{t.system}</option><option value="reduce">{t.reduce}</option></select></label>
            <label>{t.language}<select value={draft.locale} onChange={e => field('locale', e.target.value as AccountPreferences['locale'])}><option value="pt-BR">Português do Brasil</option><option value="en">English</option></select></label>
            <label>{t.timezone}<select value={draft.timezone_mode} onChange={e => {
              const mode = e.target.value as AccountPreferences['timezone_mode'];
              setDraft(current => ({ ...current, timezone_mode: mode,
                timezone: mode === 'auto' ? null : Intl.DateTimeFormat().resolvedOptions().timeZone }));
            }}><option value="auto">{t.auto}</option><option value="manual">{t.manual}</option></select></label>
            {draft.timezone_mode === 'manual' && <label>{t.zone}<input required maxLength={64} value={draft.timezone ?? ''} onChange={e => field('timezone', e.target.value)} placeholder="America/Sao_Paulo" /></label>}
            <label>{t.home}<select value={draft.home_view} onChange={e => field('home_view', e.target.value as AccountPreferences['home_view'])}><option value="list">{t.list}</option><option value="kanban">Kanban</option><option value="last">{t.last}</option></select></label>
            <label>{t.queue}<select value={draft.queue_view} onChange={e => field('queue_view', e.target.value as AccountPreferences['queue_view'])}><option value="list">{t.list}</option><option value="kanban">Kanban</option></select></label>
          </fieldset>
          <div className={`settings-preview ${draft.theme === 'system' ? 'system-preview' : draft.theme}`}
            data-contrast={draft.contrast} style={{ fontSize: (100 * draft.text_scale / preferences.text_scale) + '%' }}>
            <strong>{t.preview}</strong><p>{t.sample}</p>
          </div>
          <div className="settings-actions"><button className="button primary" disabled={busy || !mounted}>{busy ? t.saving : t.save}</button><button type="button" className="button secondary" disabled={busy || !mounted} onClick={() => { setDraft(saved); setError(''); }}>{t.cancel}</button></div>
        </form>
      </section>
      <section className="panel" aria-labelledby="account-heading">
        <h2 id="account-heading">{t.account}</h2>
        <form onSubmit={event => void submit(event, '/api/conta/perfil', { displayName: name, version: profile.version })}>
          <label>{t.name}<input required maxLength={100} autoComplete="nickname" value={name} onChange={event => setName(event.target.value)} /></label>
          <div className="settings-actions"><button className="button primary" disabled={busy || !mounted}>{t.saveName}</button></div>
        </form>
        {(avatars || profile.hasAvatar) && <AvatarSettings profile={profile} uploadEnabled={avatars} locale={preferences.locale} url={photoUrl} />}
        <dl className="settings-email"><dt>{t.email}</dt><dd>{email}</dd></dl>
        <ul className="settings-links">
          {platformAdmin && <li><Link className="text-link" href="/conta/seguranca">{preferences.locale === 'en' ? 'Two-factor authentication' : 'Autenticação em dois fatores'}</Link></li>}
          <li><Link className="text-link" href="/redefinir-senha">{t.password}</Link></li>
          <li><Link className="text-link" href="/meus-dados">{t.privacy}</Link></li>
          <li><Link className="text-link" href="/privacidade#cookies">{t.cookies}</Link></li>
        </ul>
      </section>
    </div>
  </main>;
}
