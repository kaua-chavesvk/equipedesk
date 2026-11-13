import { expect, it } from 'vitest';
import { optimisticTransition, nextTicketStatus } from '../../src/features/tickets/optimistic-transition';

const ticket = { requester_id: 'owner', assignee_id: null, status: 'open' as const, version: 1 };

it('calcula uma versão otimista sem alterar o registro original', () => {
  expect(optimisticTransition(ticket, 'agent', 'agent', 'assign')).toEqual({
    ...ticket, assignee_id: 'agent', status: 'in_progress', version: 2,
  });
  expect(ticket).toEqual({ requester_id: 'owner', assignee_id: null, status: 'open', version: 1 });
});

it('oferece apenas transições válidas para o solicitante', () => {
  expect(nextTicketStatus(ticket, 'requester', 'owner')).toBe(null);
  expect(() => optimisticTransition(ticket, 'requester', 'owner', 'assign')).toThrow();
  expect(nextTicketStatus({ ...ticket, status: 'resolved' }, 'requester', 'other')).toBe(null);
});

it('mantém a exigência de motivo ao reabrir', () => {
  const resolved = { ...ticket, status: 'resolved' as const };
  expect(() => optimisticTransition(resolved, 'requester', 'owner', 'reopen', 'ab')).toThrow();
  expect(optimisticTransition(resolved, 'requester', 'owner', 'reopen', 'Ainda preciso de ajuda.').status).toBe('open');
});
