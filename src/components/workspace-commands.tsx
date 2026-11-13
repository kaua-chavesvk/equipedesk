'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Search } from 'lucide-react';
import { DeskDialog } from './desk-dialog';

export function WorkspaceCommands({ open, onOpenChange, base, organizations, tickets, restoreFocus }: {
  open: boolean; onOpenChange: (open: boolean) => void; base?: string;
  organizations: { id: string; name: string; slug: string }[];
  tickets: { id: string; title: string }[];
  restoreFocus: () => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const normalize = (value: string) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  const term = normalize(query.trim().replace(/^#/, ''));
  const actions = [
    ...(base ? [
      { label: 'Visão geral', kind: 'Navegação', href: base },
      { label: 'Novo chamado', kind: 'Navegação', href: base + '/chamados/novo' },
    ] : [{ label: 'Seus espaços de trabalho', kind: 'Navegação', href: '/onboarding' }]),
    { label: 'Meus dados e privacidade', kind: 'Navegação', href: '/meus-dados' },
    ...organizations.map(org => ({ label: org.name, kind: 'Empresa', href: '/e/' + org.slug })),
    ...tickets.map(ticket => ({ label: ticket.title, kind: '#' + ticket.id.slice(-6).toUpperCase(), href: base + '/chamados/' + ticket.id })),
  ].filter(item => normalize(item.label + ' ' + item.kind).includes(term));
  const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(term);
  const search = term && base ? {
    label: uuid ? 'Abrir chamado pelo ID' : 'Buscar na fila completa',
    kind: 'Chamados',
    href: base + '/chamados' + (uuid ? '/' + term : '?q=' + encodeURIComponent(query.trim())),
  } : null;
  const items = [...actions, ...(search ? [search] : [])];

  function go(href: string) {
    onOpenChange(false);
    if (href.includes('?q=')) window.location.assign(href);
    else router.push(href);
  }

  return <DeskDialog open={open} onOpenChange={onOpenChange} title="Ir para"
    description={base ? "Busque empresas, ações ou chamados desta página. Você também pode colar o ID completo de um chamado." : "Encontre os espaços de trabalho e os dados da sua conta."}
    onCloseAutoFocus={event => { event.preventDefault(); restoreFocus(); }}>
    <form className="command-search" onSubmit={event => { event.preventDefault(); if (items[0]) go(items[0].href); }}>
      <Search size={18} aria-hidden="true"/>
      <input aria-label="Buscar ações, empresas e chamados" maxLength={200} autoFocus onKeyDown={event => {
          if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
          event.preventDefault();
          const buttons = event.currentTarget.closest('form')?.nextElementSibling?.querySelectorAll<HTMLButtonElement>('button');
          const index = event.key === 'ArrowDown' ? 0 : (buttons?.length ?? 0) - 1;
          buttons?.[index]?.focus();
        }}
        placeholder="Ex.: #000001, Aurora, privacidade" value={query} onChange={event => setQuery(event.target.value)} />
    </form>
    <ul className="command-results" onKeyDown={event => {
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      event.preventDefault();
      const buttons = Array.from(event.currentTarget.querySelectorAll('button'));
      const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
      const next = (current + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
      buttons[next]?.focus();
    }}>{items.map(item => <li key={item.kind + item.href}>
      <button type="button" onClick={() => go(item.href)}>
        <span>{item.label}<small>{item.kind}</small></span><ArrowRight size={16} aria-hidden="true"/>
      </button>
    </li>)}</ul>
  </DeskDialog>;
}
