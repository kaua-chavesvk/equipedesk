import { describe, expect, it } from 'vitest';
import { canReadTicket, transitionFailure, type RuleTicket } from '../../src/features/tickets/rules';

const open: RuleTicket = {requester_id:'alice',assignee_id:null,status:'open',version:1};
describe('visibilidade e transições', () => {
  it('limita solicitante à própria autoria', () => {
    expect(canReadTicket('requester','alice',open)).toBe(true);
    expect(canReadTicket('requester','bob',open)).toBe(false);
    expect(canReadTicket('agent','bob',open)).toBe(true);
  });
  it('impede assumir com papel insuficiente ou versão antiga', () => {
    expect(transitionFailure(open,'requester','alice','assign',1)).toBeTruthy();
    expect(transitionFailure(open,'agent','bob','assign',0)).toContain('atualizado');
    expect(transitionFailure(open,'agent','bob','assign',1)).toBeNull();
  });
  it('impede dupla atribuição e resolução fora de atendimento', () => {
    expect(transitionFailure({...open,assignee_id:'bob'},'agent','carol','assign',1)).toBeTruthy();
    expect(transitionFailure(open,'admin','bob','resolve',1)).toBeTruthy();
    expect(transitionFailure({...open,status:'in_progress',assignee_id:'bob'},'agent','bob','resolve',1)).toBeNull();
  });
  it('exige chamado resolvido e motivo para reabrir', () => {
    expect(transitionFailure(open,'requester','alice','reopen',1,'Ainda falha')).toBeTruthy();
    const resolved = {...open,status:'resolved' as const};
    expect(transitionFailure(resolved,'requester','alice','reopen',1,' ')).toBeTruthy();
    expect(transitionFailure(resolved,'requester','alice','reopen',1,'Ainda falha')).toBeNull();
    expect(transitionFailure(resolved,'requester','alice','reopen',1,'a'.repeat(1001))).toContain('1000');
  });
  it('não revela recurso invisível através de conflito', () => {
    expect(transitionFailure(open,'requester','bob','assign',0)).toBe('Chamado não encontrado.');
  });
});
