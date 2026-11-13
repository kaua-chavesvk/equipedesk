export type Role = 'admin' | 'agent' | 'requester';
export type TicketStatus = 'open' | 'in_progress' | 'resolved';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type RuleTicket = { requester_id: string; assignee_id: string | null; status: TicketStatus; version: number };

export function canReadTicket(role: Role, userId: string, ticket: Pick<RuleTicket, 'requester_id'>): boolean {
  return role !== 'requester' || ticket.requester_id === userId;
}

export function transitionFailure(ticket: RuleTicket, role: Role, userId: string, action: 'assign' | 'resolve' | 'reopen', version: number, reason?: string): string | null {
  if (!canReadTicket(role, userId, ticket)) return 'Chamado não encontrado.';
  if (ticket.version !== version) return 'O chamado foi atualizado. Recarregue e tente novamente.';
  if (action === 'assign') {
    if (role === 'requester') return 'Seu papel não permite assumir chamados.';
    if (ticket.status !== 'open' || ticket.assignee_id) return 'Este chamado já foi assumido.';
  }
  if (action === 'resolve') {
    if (role === 'requester') return 'Seu papel não permite resolver chamados.';
    if (ticket.status !== 'in_progress') return 'Somente chamados em atendimento podem ser resolvidos.';
  }
  if (action === 'reopen') {
    if (ticket.status !== 'resolved') return 'Somente chamados resolvidos podem ser reabertos.';
    if (!reason || reason.trim().length < 3) return 'Informe o motivo da reabertura.';
    if (reason.trim().length > 1000) return 'O motivo deve ter no máximo 1000 caracteres.';
  }
  return null;
}
