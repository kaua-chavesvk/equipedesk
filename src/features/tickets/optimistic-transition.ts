import { transitionFailure, type Role, type RuleTicket, type TicketStatus } from './rules';

export type TicketAction = 'assign' | 'resolve' | 'reopen';

export function nextTicketStatus(ticket: RuleTicket, role: Role, viewer: string): TicketStatus | null {
  if (role === 'requester' && ticket.requester_id !== viewer) return null;
  if (ticket.status === 'resolved') return 'open';
  if (role === 'requester') return null;
  if (ticket.status === 'in_progress') return 'resolved';
  return ticket.assignee_id ? null : 'in_progress';
}

export function optimisticTransition<T extends RuleTicket>(ticket: T, role: Role, viewer: string, action: TicketAction, reason?: string): T {
  const error = transitionFailure(ticket, role, viewer, action, ticket.version, reason);
  if (error) throw new Error(error);
  const status = action === 'assign' ? 'in_progress' : action === 'resolve' ? 'resolved' : 'open';
  const assignee_id = action === 'assign' ? viewer : action === 'reopen' ? null : ticket.assignee_id;
  return { ...ticket, status, assignee_id, version: ticket.version + 1 };
}
