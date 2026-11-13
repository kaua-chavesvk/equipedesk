'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { TicketStatus } from './rules';

export type BoardTicket = {
  id: string; title: string; description: string; status: TicketStatus;
  priority: string; requester_id: string; assignee_id: string | null; version: number;
};

const columns = [
  ['open', 'Aberto'], ['in_progress', 'Em andamento'], ['resolved', 'Resolvido'],
] as const;

export function TicketBoard<T extends BoardTicket>({ tickets, base, busy, destination, onMove, assignee, priorities }: {
  tickets: T[]; base: string; busy: boolean; destination: (ticket: T) => TicketStatus | null;
  onMove: (ticket: T, status: TicketStatus) => void; assignee: (id: string | null) => string;
  priorities: Record<string, string>;
}) {
  const [dragged, setDragged] = useState<T | null>(null);
  return <div className="ticket-board">{columns.map(([status, title]) => {
    const cards = tickets.filter(ticket => ticket.status === status);
    const acceptsDrop = !busy && dragged && destination(dragged) === status;
    return <section key={status} className="board-column" aria-label={title} data-drop={Boolean(acceptsDrop)}
      onDragOver={event => { if (acceptsDrop) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; } }}
      onDrop={event => {
        const ticket = tickets.find(item => item.id === event.dataTransfer.getData('application/x-equipedesk-ticket'));
        if (busy || !ticket || destination(ticket) !== status) return;
        event.preventDefault();
        onMove(ticket, status);
        setDragged(null);
      }}>
      <h3>{title}<span className="count-badge">{cards.length}</span></h3>
      {cards.map(ticket => {
        const next = destination(ticket);
        return <article key={ticket.id} className="board-card" draggable={Boolean(next) && !busy}
          onDragStart={event => {
            if (!next || busy) { event.preventDefault(); return; }
            event.stopPropagation();
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('application/x-equipedesk-ticket', ticket.id);
            setDragged(ticket);
          }}
          onDragEnd={() => setDragged(null)}>
          <small>#{ticket.id.slice(-6).toUpperCase()} · {priorities[ticket.priority]}</small>
          <Link draggable={false} href={base + '/chamados/' + ticket.id}>{ticket.title}</Link>
          <small>{assignee(ticket.assignee_id)}</small>
          {next && <button className="button secondary" disabled={busy} onClick={() => onMove(ticket, next)}>
            {next === 'open' ? 'Reabrir' : next === 'in_progress' ? 'Assumir' : 'Resolver'}
          </button>}
        </article>;
      })}
      {!cards.length && <p className="muted">Nenhum chamado nesta página.</p>}
    </section>;
  })}</div>;
}
