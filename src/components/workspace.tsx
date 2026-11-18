'use client';
import { useLocale, useTranslations } from '@/features/i18n/context';

import Link from 'next/link';
import { toast } from 'sonner';
import { ProfileAvatar } from './profile-avatar';
import { AccountAppearance } from '@/features/account-settings/appearance-context';
import { formatAccountDate } from '@/features/account-settings/format';
import { DeskDialog } from './desk-dialog';
import { WorkspaceInvitations } from './workspace-invitations';
import { TicketSavedFilters } from './ticket-saved-filters';
import { filterLocation, type TicketFilter } from '@/features/tickets/saved-filters';
import { WorkspaceCommands } from './workspace-commands';
import { TicketBoard } from '@/features/tickets/ticket-board';
import {
  nextTicketStatus,
  optimisticTransition,
  type TicketAction,
} from '@/features/tickets/optimistic-transition';
import type { Role, TicketStatus } from '@/features/tickets/rules';
import { conversationTimeline } from '@/lib/conversation-timeline';
import { useRouter } from 'next/navigation';
import {
  useContext,
  useState,
  useEffect,
  useTransition,
  useRef,
  useSyncExternalStore,
  type FormEvent,
} from 'react';
import {
  LayoutDashboard,
  Ticket as TicketIcon,
  Users,
  ChevronDown,
  Plus,
  Search,
  ArrowUpRight,
  ArrowRight,
  ArrowLeft,
  Check,
  Clock3,
  CircleDot,
  CheckCheck,
  Layers3,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  Settings,
  X,
  Send,
  Sparkles,
  ShieldCheck,
  Menu,
  LogOut,
  LoaderCircle,
  Copy,
  Signal,
} from 'lucide-react';
type Ticket = {
  id: string;
  organization_id: string;
  requester_id: string;
  assignee_id: string | null;
  title: string;
  description: string;
  priority: string;
  status: TicketStatus;
  version: number;
  created_at: string;
};
type Member = {
  user_id: string;
  role: string;
  name?: string;
  email?: string;
  avatarUrl?: string | null;
};
type Org = { id: string; name: string; slug: string; role: Role; platform_admin?: boolean };
type Data = {
  queueView?: 'list' | 'kanban';
  viewPreference?: { version: number; last_view: string; last_queue_view: string } | null;
  query: {
    q: string;
    status: string;
    priority: string;
    assignee: 'all' | 'me';
    page: number;
    pageSize: number;
  };
  queue: { total: number; page: number; pageSize: number };
  counts: { open: number; in_progress: number; resolved: number; total: number };
  demo: boolean;
  organizations: Org[];
  organization: Org;
  user: { id: string; email: string; name: string; avatarUrl?: string | null };
  tickets: Ticket[];
  members: Member[];
};
const statusLabelsSource: Record<string, string> = {
  open: 'Aberto',
  in_progress: 'Em andamento',
  resolved: 'Resolvido',
};
const priorityLabelsSource: Record<string, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  urgent: 'Urgente',
};
const roleLabelsSource: Record<string, string> = {
  admin: 'Administrador',
  agent: 'Atendente',
  requester: 'Solicitante',
};
async function fetchConversation(url: string) {
  const response = await fetch(url);
  const result = await response.json();
  if (!response.ok)
    throw new Error(
      typeof result.error === 'string'
        ? result.error
        : 'Não foi possível carregar a conversa. Tente novamente.',
    );
  return result;
}
const subscribeToDeviceZone = () => () => {};
const deviceZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
const serverZone = () => '';
function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => Array.from(word)[0])
      .join('')
      .toUpperCase() || 'ED'
  );
}
export function Workspace({ data, path }: { data: Data; path: string[] }) {
  const tr = useTranslations();
  const locale = useLocale();
  const roleLabels = Object.fromEntries(
    Object.entries(roleLabelsSource).map(([key, label]) => [key, tr(label)]),
  );
  const priorityLabels = Object.fromEntries(
    Object.entries(priorityLabelsSource).map(([key, label]) => [key, tr(label)]),
  );
  const statusLabels = Object.fromEntries(
    Object.entries(statusLabelsSource).map(([key, label]) => [key, tr(label)]),
  );
  const router = useRouter();
  const overlayTrigger = useRef<HTMLElement | null>(null);
  const base = `/e/${data.organization.slug}`;
  const view = path[0] ?? 'painel';
  const [pending, startTransition] = useTransition();
  const [conversationBusy, setConversationBusy] = useState(
    Boolean(path[0] === 'chamados' && path[1] && path[1] !== 'novo'),
  );
  const [search, setSearch] = useState(data.query.q);
  const [filter, setFilter] = useState(data.query.status);
  const [priority, setPriority] = useState(data.query.priority);
  const [assignee, setAssignee] = useState(data.query.assignee);
  const [page, setPage] = useState(data.query.page);
  const [menu, setMenu] = useState(false);
  const [orgMenu, setOrgMenu] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [invite, setInvite] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [details, setDetails] = useState<Record<string, unknown> | null>(null);
  const isNew = view === 'chamados' && path[1] === 'novo';
  const serverTicket =
    view === 'chamados' && path[1] && !isNew
      ? data.tickets.find((t) => t.id === path[1])
      : undefined;
  const preferences = useContext(AccountAppearance);
  const automaticZone = useSyncExternalStore(subscribeToDeviceZone, deviceZone, serverZone);
  const timeZone = preferences?.timezone_mode === 'manual' ? preferences.timezone : automaticZone;
  const date = (value: string) =>
    timeZone ? formatAccountDate(value, timeZone, false, locale) : '—';
  const [board, setBoard] = useState(data.queueView === 'kanban');
  const previousView = useRef(data.viewPreference);
  useEffect(() => {
    if (!preferences || !['painel', 'chamados'].includes(view) || isNew || serverTicket || path[1])
      return;
    const lastView = view === 'painel' ? 'overview' : 'queue';
    const queueView = board ? 'kanban' : 'list';
    const current = previousView.current;
    if (current?.last_view === lastView && current.last_queue_view === queueView) return;
    const timer = setTimeout(async () => {
      try {
        const result = await fetch(
          '/api/empresas/' + data.organization.slug + '/minha-visualizacao',
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              view: lastView,
              queueView,
              version: current?.version ?? data.viewPreference?.version ?? 0,
            }),
          },
        );
        if (result.ok) previousView.current = await result.json();
        else if (result.status === 409) {
          previousView.current = undefined;
          router.refresh();
        }
      } catch {
        /* A recent view is a convenience. The current queue remains available. */
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [
    preferences,
    view,
    isNew,
    serverTicket,
    path,
    board,
    data.organization.slug,
    data.viewPreference,
    router,
    tr,
  ]);

  const [commands, setCommands] = useState(false);
  const commandTrigger = useRef<HTMLElement | null>(null);
  const [confirmation, setConfirmation] = useState<{
    ticket: Ticket;
    action: 'resolve' | 'reopen';
  } | null>(null);
  const moveTrigger = useRef<HTMLElement | null>(null);
  const [moving, setMoving] = useState(false);
  const movingRef = useRef(false);
  const [overrides, setOverrides] = useState<Record<string, Ticket>>({});
  const displayed = (row: Ticket) =>
    overrides[row.id]?.version > row.version ? overrides[row.id] : row;
  const ticket = serverTicket ? displayed(serverTicket) : undefined;
  useEffect(() => {
    if (!serverTicket) return;
    let active = true;
    fetchConversation(`/api/empresas/${data.organization.slug}/chamados/${serverTicket.id}`)
      .then((value) => {
        if (active) setDetails(value);
      })
      .catch((e) => {
        if (active)
          setError(
            e instanceof Error
              ? e.message
              : tr('Não foi possível carregar a conversa. Tente novamente.'),
          );
      })
      .finally(() => {
        if (active) setConversationBusy(false);
      });
    return () => {
      active = false;
    };
  }, [serverTicket, data.organization.slug, tr]);
  useEffect(() => {
    function keyboard(event: KeyboardEvent) {
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === 'k' &&
        !invite &&
        !menu &&
        !confirmation
      ) {
        event.preventDefault();
        if (commands) setCommands(false);
        else openCommands();
      }
      if (event.key === 'Escape') {
        setInvite(false);
        setOrgMenu(false);
        setMenu(false);
      }
    }
    document.addEventListener('keydown', keyboard);
    return () => document.removeEventListener('keydown', keyboard);
  }, [invite, menu, confirmation, commands]);
  useEffect(() => {
    if (!invite && !menu) return;
    const panel = document.querySelector<HTMLElement>(
      invite ? '[aria-labelledby="invite-title"]' : '#workspace-navigation',
    );
    const previous = overlayTrigger.current ?? (document.activeElement as HTMLElement | null);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusable = () =>
      Array.from(
        panel?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href]',
        ) ?? [],
      ).filter((el) => el.getClientRects().length > 0);
    const frame = requestAnimationFrame(() => {
      (invite
        ? panel?.querySelector<HTMLInputElement>('input')
        : panel?.querySelector<HTMLElement>('.drawer-close')
      )?.focus();
    });
    function trap(event: KeyboardEvent) {
      if (event.key !== 'Tab') return;
      const elements = focusable(),
        first = elements[0],
        last = elements[elements.length - 1];
      if (!first) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', trap);
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', trap);
      previous?.focus();
    };
  }, [invite, menu]);
  useEffect(() => {
    const media = window.matchMedia('(max-width:760px)');
    const resize = () => {
      if (!media.matches) setMenu(false);
    };
    media.addEventListener('change', resize);
    return () => media.removeEventListener('change', resize);
  }, []);
  function openCommands() {
    commandTrigger.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setCommands(true);
  }
  function applySavedFilter(input: TicketFilter) {
    setSearch(input.q);
    setFilter(input.status);
    setPriority(input.priority);
    setAssignee(input.assignee);
    setBoard(input.view === 'kanban');
    setPage(1);
    startTransition(() => router.push(filterLocation(base, input), { scroll: false }));
  }
  const filtered = data.tickets.map(displayed);
  useEffect(() => {
    if (isNew || ticket || view === 'equipe') return;
    const timeout = setTimeout(() => {
      const params = new URLSearchParams();
      if (search) params.set('q', search);
      if (filter !== 'all') params.set('status', filter);
      if (priority !== 'all') params.set('priority', priority);
      if (assignee !== 'all') params.set('assignee', assignee);
      if (page > 1) params.set('page', String(page));
      if (data.query.pageSize !== 6) params.set('pageSize', String(data.query.pageSize));
      const explicitView = new URLSearchParams(window.location.search).get('view');
      if (board || explicitView === 'list' || explicitView === 'kanban')
        params.set('view', board ? 'kanban' : 'list');
      const next = params.toString();
      if (next !== window.location.search.slice(1))
        startTransition(() =>
          router.replace(window.location.pathname + (next ? '?' + next : ''), { scroll: false }),
        );
    }, 350);
    return () => clearTimeout(timeout);
  }, [
    search,
    filter,
    priority,
    assignee,
    board,
    page,
    isNew,
    ticket,
    view,
    router,
    data.query.pageSize,
  ]);

  useEffect(() => {
    function restore() {
      const query = new URLSearchParams(window.location.search);
      setSearch(query.get('q') ?? '');
      setFilter(query.get('status') ?? 'all');
      setPriority(query.get('priority') ?? 'all');
      setAssignee(query.get('assignee') === 'me' ? 'me' : 'all');
      setBoard(query.get('view') === 'kanban');
      setPage(Number(query.get('page') ?? 1));
    }
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, []);
  async function command(url: string, body: unknown, method = 'POST') {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await res.json();
      if (!res.ok)
        throw Error(
          typeof result.error === 'string'
            ? result.error
            : (result.error?.message ?? tr('Não foi possível concluir esta ação.')),
        );
      router.refresh();
      return result;
    } catch (e) {
      setError(e instanceof Error ? e.message : tr('Algo deu errado. Tente novamente.'));
      return null;
    } finally {
      setBusy(false);
    }
  }
  async function newTicket(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const r = await command(
      `/api/empresas/${data.organization.slug}/chamados`,
      Object.fromEntries(f),
    );
    if (r) {
      toast.success(tr('Chamado aberto com sucesso.'));
      router.push(base + '/chamados');
    }
  }
  async function moveTicket(row: Ticket, action: TicketAction, reason?: string) {
    if (movingRef.current || busy) return;
    let next: Ticket;
    try {
      next = optimisticTransition(row, data.organization.role, data.user.id, action, reason);
    } catch (error) {
      toast.error(error instanceof Error ? tr(error.message) : tr('Movimento inválido.'));
      return;
    }

    movingRef.current = true;
    setMoving(true);
    setConfirmation(null);
    setOverrides((previous) => ({ ...previous, [row.id]: next }));
    try {
      const response = await fetch(
        '/api/empresas/' + data.organization.slug + '/chamados/' + row.id + '/transicoes',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(12000),
          body: JSON.stringify({ action, version: row.version, reason }),
        },
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          typeof result.error === 'string' ? result.error : tr('Não foi possível mover o chamado.'),
        );
      setOverrides((previous) => ({ ...previous, [row.id]: { ...next, ...result } }));
      toast.success(tr('Chamado atualizado.'));
    } catch (error) {
      setOverrides((previous) => ({ ...previous, [row.id]: row }));
      toast.error(
        error instanceof Error && error.name !== 'TypeError' && error.name !== 'TimeoutError'
          ? tr(error.message)
          : tr(
              'Não foi possível confirmar a alteração. Atualizando a fila para conferir o estado do chamado.',
            ),
      );
    } finally {
      router.refresh();
      movingRef.current = false;
      setMoving(false);
    }
  }

  function requestMove(row: Ticket, target: TicketStatus) {
    if (nextTicketStatus(row, data.organization.role, data.user.id) !== target) return;
    if (target === 'in_progress') {
      void moveTicket(row, 'assign');
      return;
    }
    moveTrigger.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setConfirmation({ ticket: row, action: target === 'open' ? 'reopen' : 'resolve' });
  }

  function transition(action: TicketAction) {
    if (ticket)
      requestMove(
        ticket,
        action === 'assign' ? 'in_progress' : action === 'resolve' ? 'resolved' : 'open',
      );
  }
  async function comment(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!ticket) return;
    const form = e.currentTarget;
    const body = new FormData(form).get('body');
    const r = await command(
      `/api/empresas/${data.organization.slug}/chamados/${ticket.id}/comentarios`,
      { body },
    );
    if (r) {
      form.reset();
      toast.success(tr('Comentário enviado.'));
      try {
        setDetails(
          await fetchConversation(`/api/empresas/${data.organization.slug}/chamados/${ticket.id}`),
        );
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : tr('Não foi possível carregar a conversa. Tente novamente.'),
        );
      }
    }
  }
  const memberName = (id: string | null) => {
    if (!id) return tr('Não atribuído');
    if (id === data.user.id) return data.user.name;
    const m = data.members.find((m) => m.user_id === id);
    return m?.name ?? m?.email ?? tr('Equipe de atendimento');
  };
  const counts = data.counts;
  const heading =
    view === 'equipe'
      ? tr('Equipe')
      : isNew
        ? tr('Novo chamado')
        : ticket
          ? tr('Detalhes do chamado')
          : view === 'chamados'
            ? tr('Chamados')
            : tr('Olá, {name}.', { name: data.user.name.split(' ')[0] });
  return (
    <div className="app-shell">
      <a className="skip-link" href="#content">
        {tr('Ir para o conteúdo')}
      </a>
      {menu && (
        <button
          className="navigation-backdrop"
          aria-label={tr('Fechar navegação')}
          tabIndex={-1}
          onClick={() => setMenu(false)}
        />
      )}
      <aside
        id="workspace-navigation"
        aria-label={tr('Navegação do espaço')}
        role={menu ? 'dialog' : undefined}
        aria-modal={menu ? true : undefined}
        inert={invite}
        className={`sidebar ${menu ? 'mobile-open' : ''}`}
      >
        <Link href={base} className="brand">
          <span className="brand-icon">
            <Layers3 size={23} />
          </span>
          equipe<span>desk</span>
          <span className="brand-dot">.</span>
        </Link>
        <button
          className="drawer-close icon-button"
          aria-label={tr('Fechar menu')}
          onClick={() => setMenu(false)}
        >
          <X size={21} />
        </button>
        <div className="workspace-switch">
          <button onClick={() => setOrgMenu(!orgMenu)} aria-expanded={orgMenu}>
            <span className="org-avatar">{initials(data.organization.name)}</span>
            <span>
              <strong>{data.organization.name}</strong>
              <small>{tr('Seu espaço de trabalho')}</small>
            </span>
            <ChevronDown size={15} />
          </button>
          {orgMenu && (
            <div className="org-dropdown">
              {data.organizations.map((o) => (
                <Link
                  key={o.id}
                  href={`/e/${o.slug}`}
                  onClick={() => {
                    setOrgMenu(false);
                    setSearch('');
                    setFilter('all');
                    setDetails(null);
                  }}
                >
                  <span>
                    {o.name}
                    <small>{roleLabels[o.role]}</small>
                  </span>
                  {o.id === data.organization.id && <Check size={15} />}
                </Link>
              ))}
              <Link href="/onboarding">
                <Plus size={15} /> {tr(' Criar empresa')}
              </Link>
            </div>
          )}
        </div>
        <span className="nav-label">{tr('ESPAÇO DE TRABALHO')}</span>
        <nav aria-label={tr('Menu principal')}>
          {[
            {
              url: base,
              label: tr('Visão geral'),
              icon: LayoutDashboard,
              active: view === 'painel',
            },
            {
              url: base + '/chamados',
              label: tr('Chamados'),
              icon: TicketIcon,
              active: view === 'chamados',
            },
            { url: base + '/equipe', label: tr('Equipe'), icon: Users, active: view === 'equipe' },
          ].map((n) => (
            <Link
              key={n.label}
              href={n.url}
              className={n.active ? 'active' : ''}
              aria-current={n.active ? 'page' : undefined}
              onClick={() => setMenu(false)}
            >
              <n.icon size={19} />
              <span>{n.label}</span>
              {n.url === base + '/chamados' && (
                <span className="nav-count">{data.counts.total}</span>
              )}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="team-card">
            <Users size={20} aria-hidden="true" />
            <strong>
              {data.members.length}{' '}
              {data.members.length === 1 ? tr('pessoa neste espaço') : tr('pessoas neste espaço')}
            </strong>
            <p>{data.organization.name}</p>
            <Link href={base + '/equipe'}>
              {tr('Ver equipe ')}
              <ArrowUpRight size={16} />
            </Link>
          </div>
          <button
            className="help-link"
            onClick={() =>
              setNotice(tr('Para pedir ajuda, abra um chamado e descreva o que aconteceu.'))
            }
          >
            <HelpCircle size={18} />
            {tr('Central de ajuda')}
            <ArrowUpRight size={14} />
          </button>
          {preferences && (
            <Link className="help-link" href={base + '/configuracoes'}>
              <Settings size={18} />
              {preferences.locale === 'en' ? 'Settings' : tr('Configurações')}
            </Link>
          )}
          <div className="profile">
            <ProfileAvatar name={data.user.name} url={data.user.avatarUrl} />
            <span>
              <strong>{data.user.name}</strong>
              <small>
                {data.organization.platform_admin
                  ? tr('Administrador geral')
                  : roleLabels[data.organization.role]}
              </small>
            </span>
            <button
              aria-label={tr('Sair da conta')}
              onClick={async () => {
                await fetch('/api/auth', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ action: 'logout' }),
                });
                router.push('/login');
                router.refresh();
              }}
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-shell" inert={menu || invite}>
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-menu icon-button"
              aria-label={menu ? tr('Fechar navegação') : tr('Abrir navegação')}
              aria-expanded={menu}
              aria-controls="workspace-navigation"
              onClick={(event) => {
                overlayTrigger.current = event.currentTarget;
                setMenu(!menu);
              }}
            >
              <Menu size={20} />
            </button>
            <span>{data.demo ? tr('Demonstração · dados fictícios') : data.organization.name}</span>
            <ChevronRight size={13} />
            <strong>
              {view === 'equipe'
                ? tr('Equipe')
                : view === 'chamados'
                  ? tr('Chamados')
                  : tr('Visão geral')}
            </strong>
          </div>
          <div className="topbar-right">
            <button
              type="button"
              className="command-trigger"
              onClick={openCommands}
              aria-label={tr('Abrir comandos')}
            >
              <Search size={17} />
              <span>{tr('Ir para')}</span>
              <kbd>Ctrl K</kbd>
            </button>
            <span className="online">
              <i /> {tr(' Atendimento interno')}
            </span>
            <span className="top-separator" />
            <ProfileAvatar
              name={data.user.name}
              url={data.user.avatarUrl}
              size={32}
              decorative={false}
            />
          </div>
        </header>
        <main id="content" className="content" tabIndex={-1} aria-busy={pending}>
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {view === 'equipe'
                  ? tr('NOSSA EQUIPE')
                  : isNew
                    ? tr('NOVO CHAMADO')
                    : ticket
                      ? tr('ACOMPANHAMENTO')
                      : tr('ATENDIMENTO INTERNO')}
              </div>
              <h1>
                {heading}
                <span className="heading-dot"></span>
              </h1>
              <p>
                {view === 'equipe'
                  ? tr('Pessoas e permissões deste espaço de trabalho.')
                  : isNew
                    ? tr('Descreva a solicitação e escolha a prioridade para sua equipe.')
                    : ticket
                      ? tr('Converse com a equipe e acompanhe a evolução do seu chamado.')
                      : tr('Veja o que está em aberto, em atendimento e concluído.')}
              </p>
            </div>
            {!isNew && !ticket && (view !== 'equipe' || data.organization.role === 'admin') && (
              <button
                className="button primary"
                onClick={(event) => {
                  overlayTrigger.current = event.currentTarget;
                  return view === 'equipe'
                    ? (setInviteLink(''), setError(''), setInvite(true))
                    : router.push(base + '/chamados/novo');
                }}
              >
                <Plus size={17} />
                {view === 'equipe' ? tr('Convidar pessoa') : tr('Novo chamado')}
              </button>
            )}
          </div>
          {error && !invite && (
            <div className="alert error" role="alert" tabIndex={-1} ref={(el) => el?.focus()}>
              {tr(error)}
              <button aria-label={tr('Fechar erro')} onClick={() => setError('')}>
                <X size={16} />
              </button>
            </div>
          )}
          {notice && (
            <div className="alert" role="status">
              <Check size={17} />
              {notice}
              <button aria-label={tr('Fechar aviso')} onClick={() => setNotice('')}>
                <X size={16} />
              </button>
            </div>
          )}
          {view === 'painel' && (
            <>
              <section className="welcome-banner" aria-label={tr('Resumo do atendimento')}>
                <div className="banner-copy">
                  <p className="banner-label">{data.organization.name}</p>
                  <h2>
                    {tr('O próximo passo')}
                    <br />
                    {tr('começa na sua fila.')}
                  </h2>
                  <p>
                    {counts.open}{' '}
                    {counts.open === 1 ? tr('chamado em aberto') : tr('chamados em aberto')}{' '}
                    {tr(' e ')}
                    {counts.in_progress} {tr(' em andamento neste espaço.')}
                  </p>
                  <Link href={base + '/chamados'}>
                    {tr('Acompanhar chamados ')}
                    <ArrowRight size={18} />
                  </Link>
                </div>
                <div className="queue-summary">
                  <span>{tr('Chamados em aberto')}</span>
                  <strong>{counts.open}</strong>
                  <span>
                    {tr('de ')}
                    {counts.total} {tr(' no total')}
                  </span>
                </div>
              </section>
              <section className="stats-grid" aria-label={tr('Resumo dos chamados')}>
                {[
                  {
                    label: tr('Total de chamados'),
                    count: data.counts.total,
                    icon: TicketIcon,
                    cls: 'purple',
                    hint: tr('Ver todos'),
                    key: 'all',
                  },
                  {
                    label: tr('Em aberto'),
                    count: counts.open,
                    icon: CircleDot,
                    cls: 'orange',
                    hint: tr('Aguardando atendimento'),
                    key: 'open',
                  },
                  {
                    label: tr('Em andamento'),
                    count: counts.in_progress,
                    icon: Clock3,
                    cls: 'blue',
                    hint: tr('Em atendimento'),
                    key: 'in_progress',
                  },
                  {
                    label: tr('Resolvidos'),
                    count: counts.resolved,
                    icon: CheckCheck,
                    cls: 'green',
                    hint: tr('Atendimento concluído'),
                    key: 'resolved',
                  },
                ].map((s) => (
                  <button
                    key={s.label}
                    className="stat-card"
                    aria-pressed={filter === s.key}
                    onClick={() => {
                      setFilter(s.key);
                      setPage(1);
                    }}
                  >
                    <div className="stat-top">
                      <span>{s.label}</span>
                      <span className={`stat-icon ${s.cls}`}>
                        <s.icon size={18} />
                      </span>
                    </div>
                    <strong>{s.count}</strong>
                    <div className="stat-bottom">
                      <span className={`stat-dot ${s.cls}`} />
                      {s.hint}
                      <ArrowUpRight size={14} />
                    </div>
                  </button>
                ))}
              </section>
            </>
          )}
          {!isNew && !ticket && view !== 'equipe' && (
            <section className="ticket-section">
              <div className="section-heading">
                <div>
                  <h2>
                    {view === 'painel' ? tr('Chamados recentes') : tr('Todos os chamados')}
                    <span className="count-badge">{data.counts.total}</span>
                  </h2>
                  <p>
                    {view === 'painel'
                      ? tr('Uma visão do que está acontecendo por aqui.')
                      : tr('Encontre e acompanhe cada solicitação da sua empresa.')}
                  </p>
                </div>
                {view === 'painel' && (
                  <Link className="text-link" href={base + '/chamados'}>
                    {tr('Ver todos os chamados')}
                    <ArrowRight size={15} />
                  </Link>
                )}
              </div>
              <div className="table-card" aria-busy={pending}>
                <div className="view-toolbar">
                  <div role="group" aria-label={tr('Visualização dos chamados')}>
                    <button type="button" aria-pressed={!board} onClick={() => setBoard(false)}>
                      {tr('Lista')}
                    </button>
                    <button type="button" aria-pressed={board} onClick={() => setBoard(true)}>
                      Kanban
                    </button>
                  </div>
                  {board && <small>{tr('Cartões da página atual')}</small>}
                </div>
                <TicketSavedFilters
                  key={data.user.id + data.organization.id}
                  slug={data.organization.slug}
                  demo={data.demo}
                  current={{
                    q: search,
                    status: filter as TicketFilter['status'],
                    priority: priority as TicketFilter['priority'],
                    assignee,
                    view: board ? 'kanban' : 'list',
                  }}
                  onApply={applySavedFilter}
                />
                <div className="table-toolbar">
                  <div className="tabs" role="group" aria-label={tr('Filtrar estado')}>
                    {[
                      ['all', tr('Todos')],
                      ['open', tr('Em aberto')],
                      ['in_progress', tr('Em andamento')],
                      ['resolved', tr('Resolvidos')],
                    ].map(([key, label]) => (
                      <button
                        key={key}
                        className={filter === key ? 'selected' : ''}
                        aria-pressed={filter === key}
                        onClick={() => {
                          setFilter(key);
                          setPage(1);
                        }}
                      >
                        {label}
                        {key === 'all' && <span>{data.counts.total}</span>}
                      </button>
                    ))}
                  </div>
                  <div className="table-search-row">
                    <div className="search-field">
                      <Search size={16} />
                      <input
                        aria-label={tr('Buscar chamados')}
                        maxLength={200}
                        placeholder={tr('Buscar chamado...')}
                        value={search}
                        onChange={(e) => {
                          setSearch(e.target.value);
                          setPage(1);
                        }}
                      />
                    </div>
                    <label className="filter-select">
                      <SlidersHorizontal size={15} />
                      <select
                        aria-label={tr('Filtrar prioridade')}
                        value={priority}
                        onChange={(e) => {
                          setPriority(e.target.value);
                          setPage(1);
                        }}
                      >
                        <option value="all">{tr('Todas as prioridades')}</option>
                        {Object.entries(priorityLabels).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="filter-select">
                      <select
                        aria-label={tr('Filtrar responsável')}
                        value={assignee}
                        onChange={(event) => {
                          setAssignee(event.target.value as 'all' | 'me');
                          setPage(1);
                        }}
                      >
                        <option value="all">{tr('Todos os responsáveis')}</option>
                        <option value="me">{tr('Atribuídos a mim')}</option>
                      </select>
                    </label>
                  </div>
                </div>
                <div className="queue-feedback" role="status" aria-live="polite">
                  {pending ? (
                    <>
                      <LoaderCircle size={16} className="spin" />
                      {tr('Atualizando chamados…')}
                    </>
                  ) : (
                    tr('{count} chamados encontrados', { count: data.queue.total })
                  )}
                </div>
                {board ? (
                  <TicketBoard
                    tickets={filtered}
                    base={base}
                    busy={moving || busy || pending}
                    destination={(row) =>
                      nextTicketStatus(row, data.organization.role, data.user.id)
                    }
                    onMove={requestMove}
                    assignee={memberName}
                    priorities={priorityLabels}
                  />
                ) : (
                  <div className="table-scroll">
                    <table role="table">
                      <caption className="sr-only">
                        {tr('Chamados de ')}
                        {data.organization.name}
                      </caption>
                      <thead role="rowgroup">
                        <tr role="row">
                          <th role="columnheader">{tr('CHAMADO')}</th>
                          <th role="columnheader">{tr('ESTADO')}</th>
                          <th role="columnheader" className="priority-cell">
                            {tr('PRIORIDADE')}
                          </th>
                          <th role="columnheader">{tr('RESPONSÁVEL')}</th>
                          <th role="columnheader" className="date-cell">
                            {tr('CRIADO EM')}
                          </th>
                          <th />
                        </tr>
                      </thead>
                      <tbody role="rowgroup">
                        {filtered.map((t, i) => (
                          <tr role="row" key={t.id}>
                            <td role="cell" data-label={tr('Chamado')} className="ticket-main-cell">
                              <Link
                                className="ticket-title"
                                aria-label={tr('Abrir {title}', { title: t.title })}
                                href={base + '/chamados/' + t.id}
                              >
                                <span
                                  className={`ticket-symbol ${['lavender', 'peach', 'mint', 'sky'][i % 4]}`}
                                >
                                  <TicketIcon size={16} />
                                </span>
                                <span>
                                  <strong>{t.title}</strong>
                                  <small>
                                    #{t.id.slice(-6).toUpperCase()} <span>·</span>{' '}
                                    {t.description.slice(0, 42)}
                                    {t.description.length > 42 ? '…' : ''}
                                  </small>
                                </span>
                              </Link>
                            </td>
                            <td role="cell" data-label={tr('Estado')}>
                              <span className={`status ${t.status}`}>
                                <i />
                                {statusLabels[t.status]}
                              </span>
                            </td>
                            <td role="cell" className="priority-cell" data-label={tr('Prioridade')}>
                              <span className={`priority ${t.priority}`}>
                                <Signal size={16} aria-hidden="true" />
                                {priorityLabels[t.priority]}
                              </span>
                            </td>
                            <td role="cell" data-label={tr('Responsável')}>
                              <div className="assignee">
                                {t.assignee_id ? (
                                  <ProfileAvatar
                                    name={memberName(t.assignee_id)}
                                    url={
                                      data.members.find(
                                        (member) => member.user_id === t.assignee_id,
                                      )?.avatarUrl
                                    }
                                    size={28}
                                  />
                                ) : (
                                  <span className="unassigned-avatar">
                                    <Users size={12} />
                                  </span>
                                )}
                                <span>{memberName(t.assignee_id)}</span>
                              </div>
                            </td>
                            <td role="cell" className="date-cell" data-label={tr('Criado em')}>
                              {date(t.created_at)}
                            </td>
                            <td role="cell">
                              <Link
                                className="row-more"
                                aria-label={tr('Detalhes de {title}', { title: t.title })}
                                href={base + '/chamados/' + t.id}
                              >
                                <ChevronRight size={16} />
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {!filtered.length && (
                  <div className="empty-state">
                    <Search size={30} />
                    <h3>{tr('Nenhum chamado por aqui.')}</h3>
                    <p>
                      {search || filter !== 'all' || priority !== 'all' || assignee !== 'all'
                        ? tr(
                            'Nenhum resultado para os filtros escolhidos. Limpe os filtros para ver os demais chamados.',
                          )
                        : tr('Abra o primeiro chamado para iniciar o atendimento neste espaço.')}
                    </p>
                    {(search || filter !== 'all' || priority !== 'all' || assignee !== 'all') && (
                      <button
                        className="button secondary"
                        onClick={() => {
                          setSearch('');
                          setFilter('all');
                          setPriority('all');
                          setAssignee('all');
                          setPage(1);
                        }}
                      >
                        {tr('Limpar filtros')}
                      </button>
                    )}
                    <Link className="button secondary" href={base + '/chamados/novo'}>
                      {tr('Abrir um chamado')}
                    </Link>
                  </div>
                )}
                <div className="table-footer">
                  <span>
                    {tr('Mostrando ')}
                    <strong>
                      {data.queue.total
                        ? Math.min((page - 1) * data.query.pageSize + 1, data.queue.total)
                        : 0}
                      –{Math.min(page * data.query.pageSize, data.queue.total)}
                    </strong>{' '}
                    {tr(' de ')}
                    <strong>{data.queue.total}</strong> {tr(' chamados')}
                  </span>
                  <div
                    className="pagination"
                    role="group"
                    aria-label={tr('Paginação dos chamados')}
                  >
                    <button
                      aria-label={tr('Página anterior')}
                      disabled={page === 1}
                      onClick={() => setPage(page - 1)}
                    >
                      <ChevronLeft size={15} />
                    </button>
                    {Array.from(
                      {
                        length: Math.min(
                          5,
                          Math.max(1, Math.ceil(data.queue.total / data.query.pageSize)),
                        ),
                      },
                      (_, i) => {
                        const n =
                          Math.max(
                            1,
                            Math.min(
                              page - 2,
                              Math.ceil(data.queue.total / data.query.pageSize) - 4,
                            ),
                          ) + i;
                        return (
                          <button
                            key={n}
                            className={page === n ? 'current' : ''}
                            aria-label={tr('Página {number}', { number: n })}
                            aria-current={page === n ? 'page' : undefined}
                            onClick={() => setPage(n)}
                          >
                            {n}
                          </button>
                        );
                      },
                    )}
                    <button
                      aria-label={tr('Próxima página')}
                      disabled={page >= Math.ceil(data.queue.total / data.query.pageSize)}
                      onClick={() => setPage(page + 1)}
                    >
                      <ChevronRight size={15} />
                    </button>
                  </div>
                </div>
              </div>
            </section>
          )}
          {isNew && (
            <div className="form-layout">
              <section className="panel">
                <Link href={base + '/chamados'} className="back-link">
                  <ArrowLeft size={15} />
                  {tr('Voltar aos chamados')}
                </Link>
                <h2>{tr('Descreva sua solicitação')}</h2>
                <form className="ticket-form" onSubmit={newTicket}>
                  <label>
                    {tr('Título do chamado')}
                    <input
                      name="title"
                      required
                      minLength={5}
                      maxLength={160}
                      placeholder={tr('Ex.: Preciso de acesso à ferramenta de design')}
                    />
                    <small>{tr('Um resumo claro ajuda a encontrar a pessoa certa.')}</small>
                  </label>
                  <label>
                    {tr('Descrição')}
                    <textarea
                      name="description"
                      required
                      minLength={10}
                      maxLength={10000}
                      rows={7}
                      placeholder={tr(
                        'O que aconteceu? Inclua os detalhes que podem ajudar nossa equipe.',
                      )}
                    />
                  </label>
                  <label>
                    {tr('Prioridade')}
                    <select name="priority" defaultValue="medium">
                      {Object.entries(priorityLabels).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="form-actions">
                    <Link className="button secondary" href={base + '/chamados'}>
                      {tr('Cancelar')}
                    </Link>
                    <button className="button primary" disabled={busy}>
                      {busy ? <LoaderCircle className="spin" size={16} /> : <Send size={16} />}
                      {tr('Abrir chamado')}
                    </button>
                  </div>
                </form>
              </section>
              <aside className="tip-card">
                <span className="stat-icon purple">
                  <Sparkles size={20} />
                </span>
                <h3>{tr('O que incluir no chamado')}</h3>
                <p>
                  {tr(
                    'Descreva o que você precisa, o que já tentou e como isso afeta o seu trabalho.',
                  )}
                </p>
                <div>
                  <ShieldCheck size={17} />
                  <span>
                    {tr('Seu chamado fica protegido no espaço da ')}
                    {data.organization.name}.
                  </span>
                </div>
              </aside>
            </div>
          )}
          {view === 'chamados' && path[1] && !isNew && !ticket && (
            <div className="empty-state panel">
              <ShieldCheck size={34} />
              <h2>{tr('Chamado não encontrado.')}</h2>
              <p>{tr('Ele não existe ou você não tem acesso neste espaço.')}</p>
              <Link href={base + '/chamados'} className="button primary">
                {tr('Voltar aos chamados')}
              </Link>
            </div>
          )}
          {ticket && (
            <div className="form-layout">
              <section className="panel detail-panel">
                <Link href={base + '/chamados'} className="back-link">
                  <ArrowLeft size={15} />
                  {tr('Voltar aos chamados')}
                </Link>
                <span className="eyebrow">
                  {tr('CHAMADO #')}
                  {ticket.id.slice(-6).toUpperCase()}
                </span>
                <h2>{ticket.title}</h2>
                <div className="detail-tags">
                  <span className={`status ${ticket.status}`}>
                    <i />
                    {statusLabels[ticket.status]}
                  </span>
                  <span className={`priority ${ticket.priority}`}>
                    {priorityLabels[ticket.priority]}
                  </span>
                  <span className="muted">
                    {tr('Aberto em ')}
                    {date(ticket.created_at)}
                  </span>
                </div>
                <p className="description">{ticket.description}</p>
                <hr />
                <h3>{tr('Conversa e histórico')}</h3>
                {conversationBusy && (
                  <p className="loading-status" role="status">
                    <LoaderCircle className="spin" size={18} />
                    {tr('Carregando conversa…')}
                  </p>
                )}
                {details &&
                  conversationTimeline(
                    Array.isArray(details.comments) ? details.comments : [],
                    Array.isArray(details.events) ? details.events : [],
                  ).map((item) => {
                    if (item.type === 'comment') {
                      const c = item.entry as Record<string, string>;
                      return (
                        <div className="comment" key={`comment-${c.id}`}>
                          <div className="conversation-author">
                            <ProfileAvatar
                              name={c.author_name ?? memberName(c.author_id ?? c.user_id)}
                              url={
                                data.members.find(
                                  (member) => member.user_id === (c.author_id ?? c.user_id),
                                )?.avatarUrl
                              }
                              size={28}
                            />
                            <strong>{c.author_name ?? memberName(c.author_id ?? c.user_id)}</strong>
                          </div>
                          <p>{c.body}</p>
                        </div>
                      );
                    }
                    const ev = item.entry as Record<string, unknown>;
                    return (
                      <div className="timeline" key={`event-${String(ev.id)}`}>
                        {ev.actor_id && preferences ? (
                          <ProfileAvatar
                            name={memberName(String(ev.actor_id))}
                            url={
                              data.members.find((member) => member.user_id === ev.actor_id)
                                ?.avatarUrl
                            }
                            size={28}
                            decorative={false}
                          />
                        ) : (
                          <span className="timeline-icon">
                            <Clock3 size={15} />
                          </span>
                        )}
                        <div>
                          <strong>
                            {(
                              {
                                created: tr('Chamado aberto'),
                                assigned: tr('Chamado assumido'),
                                resolved: tr('Chamado resolvido'),
                                reopened: tr('Chamado reaberto'),
                                commented: tr('Comentário adicionado'),
                                assign: tr('Chamado assumido'),
                                resolve: tr('Chamado resolvido'),
                                reopen: tr('Chamado reaberto'),
                              } as Record<string, string>
                            )[String(ev.kind)] ?? String(ev.kind)}
                          </strong>
                          <p>
                            {typeof ev.payload === 'object' &&
                            ev.payload !== null &&
                            'reason' in ev.payload
                              ? String(ev.payload.reason)
                              : date(String(ev.created_at))}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                <button
                  className="text-link"
                  disabled={conversationBusy}
                  onClick={async () => {
                    setError('');
                    setConversationBusy(true);
                    try {
                      setDetails(
                        await fetchConversation(
                          `/api/empresas/${data.organization.slug}/chamados/${ticket.id}`,
                        ),
                      );
                    } catch (e) {
                      setError(
                        e instanceof Error
                          ? e.message
                          : tr('Não foi possível carregar a conversa. Tente novamente.'),
                      );
                    } finally {
                      setConversationBusy(false);
                    }
                  }}
                >
                  {tr('Carregar conversa completa ')}
                  <ArrowRight size={14} />
                </button>
                <form className="comment-form" onSubmit={comment}>
                  <label>
                    {tr('Escreva uma mensagem')}
                    <textarea
                      name="body"
                      required
                      maxLength={5000}
                      rows={3}
                      placeholder={tr('Compartilhe uma atualização ou tire uma dúvida...')}
                    />
                  </label>
                  <button className="button primary" disabled={busy} aria-busy={busy}>
                    <Send size={15} />
                    {busy ? tr('Enviando mensagem…') : tr('Enviar mensagem')}
                  </button>
                </form>
              </section>
              <aside className="panel detail-sidebar">
                <h3>{tr('Sobre este chamado')}</h3>
                <dl>
                  <dt>{tr('Responsável')}</dt>
                  <dd>{memberName(ticket.assignee_id)}</dd>
                  <dt>{tr('Solicitante')}</dt>
                  <dd>{memberName(ticket.requester_id)}</dd>
                  <dt>{tr('Empresa')}</dt>
                  <dd>{data.organization.name}</dd>
                  <dt>{tr('Última versão')}</dt>
                  <dd>{ticket.version}</dd>
                </dl>
                {data.organization.role !== 'requester' &&
                  ticket.status === 'open' &&
                  !ticket.assignee_id && (
                    <button
                      className="button primary"
                      disabled={busy || moving}
                      onClick={() => transition('assign')}
                    >
                      <Users size={16} />
                      {tr('Assumir chamado')}
                    </button>
                  )}
                {data.organization.role !== 'requester' && ticket.status === 'in_progress' && (
                  <button
                    className="button primary"
                    disabled={busy || moving}
                    onClick={() => transition('resolve')}
                  >
                    <CheckCheck size={16} />
                    {tr('Resolver chamado')}
                  </button>
                )}
                {ticket.status === 'resolved' && (
                  <button
                    className="button secondary"
                    disabled={busy || moving}
                    onClick={() => transition('reopen')}
                  >
                    {tr('Reabrir chamado')}
                  </button>
                )}
                <p className="safe-note">
                  <ShieldCheck size={14} />
                  {tr('Histórico de atendimento registrado.')}
                </p>
              </aside>
            </div>
          )}
          {view === 'equipe' && (
            <section className="panel">
              <div className="section-heading">
                <div>
                  <h2>
                    {tr('Pessoas neste espaço ')}
                    <span className="count-badge">{data.members.length}</span>
                  </h2>
                  <p>{tr('Gerencie quem faz parte deste espaço.')}</p>
                </div>
                <Users size={23} />
              </div>
              <div className="members-list">
                {data.members.map((m) => (
                  <div className="member-row" key={m.user_id}>
                    <ProfileAvatar name={memberName(m.user_id)} url={m.avatarUrl} />
                    <div className="member-info">
                      <strong>
                        {memberName(m.user_id)}
                        {m.user_id === data.user.id && <small>{tr('Você')}</small>}
                      </strong>
                      <span>{m.email ?? tr('Membro da equipe')}</span>
                    </div>
                    {data.organization.role === 'admin' ? (
                      <>
                        <select
                          aria-label={tr('Papel de {name}', { name: memberName(m.user_id) })}
                          value={m.role}
                          onChange={async (e) => {
                            if (window.confirm(tr('Confirmar alteração do papel desta pessoa?')))
                              await command(
                                `/api/empresas/${data.organization.slug}/membros/${m.user_id}`,
                                { role: e.target.value },
                                'PATCH',
                              );
                          }}
                        >
                          {Object.entries(roleLabels).map(([k, v]) => (
                            <option key={k} value={k}>
                              {v}
                            </option>
                          ))}
                        </select>
                        <button
                          className="icon-button"
                          aria-label={tr('Remover {name}', { name: memberName(m.user_id) })}
                          onClick={async () => {
                            if (
                              window.confirm(
                                tr('Remover esta pessoa da empresa? O histórico será preservado.'),
                              )
                            )
                              await command(
                                `/api/empresas/${data.organization.slug}/membros/${m.user_id}`,
                                {},
                                'DELETE',
                              );
                          }}
                        >
                          <X size={16} />
                        </button>
                      </>
                    ) : (
                      <span className="role-pill">{roleLabels[m.role]}</span>
                    )}
                  </div>
                ))}
              </div>
              <div className="team-note">
                <ShieldCheck size={18} />
                <p>
                  {tr(
                    'Os papéis definem o que cada pessoa pode acessar. Somente administradores podem gerenciar membros e convites.',
                  )}
                </p>
              </div>
            </section>
          )}
          {view === 'equipe' && data.organization.role === 'admin' && !data.demo && (
            <WorkspaceInvitations
              key={data.organization.slug}
              slug={data.organization.slug}
              revision={inviteLink}
            />
          )}
          {view === 'painel' && (
            <div className="bottom-note">
              <span>
                <ShieldCheck size={17} />
                {tr('O acesso aos chamados segue sua empresa e seu papel.')}
              </span>
              <span>
                {data.demo ? tr('Demonstração com dados fictícios') : tr('Atendimento interno')}
              </span>
            </div>
          )}
          <footer className="page-footer">
            <span>© {new Date().getFullYear()} EquipeDesk</span>
            <span>
              <span className="footer-dot" />
              {tr('Acesso por empresa e papel')}
            </span>
          </footer>
        </main>
      </div>
      {invite && (
        <div className="modal-backdrop" onClick={() => setInvite(false)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="invite-title"
            className="modal panel"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close icon-button"
              onClick={() => setInvite(false)}
              aria-label={tr('Fechar convite')}
            >
              <X size={20} />
            </button>
            <span className="stat-icon purple">
              <Users size={20} />
            </span>
            <h2 id="invite-title">{tr('Convidar pessoa')}</h2>
            {error && (
              <p role="alert" className="form-error" tabIndex={-1} ref={(el) => el?.focus()}>
                {tr(error)}
              </p>
            )}
            <p className="muted">
              {tr('Convide alguém para o espaço da ')}
              {data.organization.name}.
            </p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const r = await command(
                  `/api/empresas/${data.organization.slug}/convites`,
                  Object.fromEntries(new FormData(e.currentTarget)),
                );
                if (r) {
                  setInviteLink(
                    r.url ??
                      r.link ??
                      r.invite_url ??
                      `${window.location.origin}/convite/${r.token}`,
                  );
                  toast.success(tr('Convite criado. Compartilhe o link com a pessoa convidada.'));
                }
              }}
            >
              <label>
                {tr('E-mail')}
                <input
                  name="email"
                  type="email"
                  required
                  placeholder={tr('pessoa@empresa.com.br')}
                />
              </label>
              <label>
                {tr('Papel')}
                <select name="role" defaultValue="requester">
                  {Object.entries(roleLabels).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <button className="button primary" disabled={busy}>
                <Plus size={16} />
                {busy ? tr('Criando convite…') : tr('Criar convite')}
              </button>
            </form>
            {inviteLink && (
              <div className="invite-result">
                <label>
                  {tr('Link de convite')}
                  <input readOnly value={inviteLink} />
                </label>
                <button
                  className="button secondary"
                  onClick={() => {
                    void navigator.clipboard.writeText(inviteLink).then(
                      () => toast.success(tr('Link copiado.')),
                      () =>
                        toast.error(
                          tr('Não foi possível copiar. Selecione o link e copie manualmente.'),
                        ),
                    );
                  }}
                >
                  <Copy size={15} />
                  {tr('Copiar link')}
                </button>
              </div>
            )}
          </section>
        </div>
      )}
      <nav className="bottom-nav" aria-label={tr('Atalhos do workspace')} inert={menu || invite}>
        <Link href={base} aria-current={view === 'painel' ? 'page' : undefined}>
          <LayoutDashboard size={20} />
          {tr('Visão geral')}
        </Link>
        <Link href={base + '/chamados'} aria-current={view === 'chamados' ? 'page' : undefined}>
          <TicketIcon size={20} />
          {tr('Chamados')}
        </Link>
        <Link href={base + '/chamados/novo'}>
          <Plus size={20} />
          {tr('Abrir chamado')}
        </Link>
        <button type="button" onClick={openCommands}>
          <Search size={20} />
          {tr('Ir para')}
        </button>
      </nav>
      {commands && (
        <WorkspaceCommands
          open={commands}
          onOpenChange={setCommands}
          base={base}
          organizations={data.organizations}
          tickets={data.tickets}
          restoreFocus={() => commandTrigger.current?.focus()}
        />
      )}
      {confirmation && (
        <DeskDialog
          open
          title={confirmation.action === 'reopen' ? tr('Reabrir chamado') : tr('Resolver chamado')}
          description={confirmation.ticket.title}
          onOpenChange={(open) => {
            if (!open) setConfirmation(null);
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            moveTrigger.current?.focus();
          }}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const reason = new FormData(event.currentTarget).get('reason');
              void moveTicket(
                confirmation.ticket,
                confirmation.action,
                typeof reason === 'string' ? reason.trim() : undefined,
              );
            }}
          >
            {confirmation.action === 'reopen' && (
              <label>
                {tr('Motivo da reabertura')}
                <textarea name="reason" required minLength={3} maxLength={1000} />
              </label>
            )}
            <button className="button primary" type="submit">
              {confirmation.action === 'reopen'
                ? tr('Confirmar reabertura')
                : tr('Confirmar resolução')}
            </button>
          </form>
        </DeskDialog>
      )}
    </div>
  );
}
