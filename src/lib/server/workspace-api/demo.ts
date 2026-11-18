import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { demoStore } from '@/lib/data';
import { HttpError, ticketInput, transitionInput } from '@/lib/http/api';

import type { Workspace } from '@/lib/data';
import { transitionFailure, canReadTicket } from '@/features/tickets/rules';
type Payload = Record<string, unknown>;

async function createTicket(workspace: Workspace, validated: Payload) {
  const store = await demoStore();
  const org = workspace.organization;
  const actor = workspace.user;
  const ticket = {
    ...ticketInput.parse(validated),
    id: randomUUID(),
    organization_id: org.id,
    requester_id: actor.id,
    assignee_id: null,
    status: 'open' as const,
    version: 1,
    created_at: new Date().toISOString(),
    requester_name: actor.name,
  };
  store.tickets.unshift(ticket);
  store.events[ticket.id] = [
    {
      id: randomUUID(),
      kind: 'created',
      actor_id: actor.id,
      created_at: ticket.created_at,
      payload: {},
    },
  ];
  return ticket;
}
async function updateTicket(workspace: Workspace, action: string, validated: Payload, id?: string) {
  const store = await demoStore();
  const org = workspace.organization;
  const actor = workspace.user;
  const ticket = workspace.tickets.find((t) => t.id === id);
  if (!ticket) throw new HttpError(404, 'Chamado não encontrado.');
  if (action === 'comment') {
    const comment = {
      id: randomUUID(),
      body: String(validated.body),
      author_id: actor.id,
      author_name: actor.name,
      created_at: new Date().toISOString(),
    };
    (store.comments[ticket.id] ??= []).push(comment);
    return comment;
  } else {
    const input = transitionInput.parse({
      action: validated.action,
      version: validated.version,
      ...(validated.reason === undefined ? {} : { reason: validated.reason }),
    });
    const transition = input.action;
    const reason = transitionFailure(
      ticket,
      org.role,
      actor.id,
      transition,
      input.version,
      input.reason,
    );
    if (reason) {
      const status = !canReadTicket(org.role, actor.id, ticket)
        ? 404
        : ticket.version !== input.version
          ? 409
          : org.role === 'requester' && transition !== 'reopen'
            ? 403
            : transition === 'reopen'
              ? 422
              : 409;
      throw new HttpError(status, reason);
    }
    ticket.status =
      transition === 'assign' ? 'in_progress' : transition === 'resolve' ? 'resolved' : 'open';
    ticket.assignee_id =
      transition === 'assign' ? actor.id : transition === 'reopen' ? null : ticket.assignee_id;
    ticket.assignee_name = transition === 'assign' ? actor.name : undefined;
    ticket.version++;
    (store.events[ticket.id] ??= []).push({
      id: randomUUID(),
      kind: transition,
      actor_id: actor.id,
      created_at: new Date().toISOString(),
      payload: { reason: validated.reason ?? null },
    });
    return ticket;
  }
}
async function updateMember(workspace: Workspace, action: string, validated: Payload, id?: string) {
  const store = await demoStore();
  const org = workspace.organization;

  const member = store.members.find((m) => m.user_id === id && m.organization_id === org.id);
  if (!member) throw new HttpError(404, 'Membro não encontrado.');
  if (
    member.role === 'admin' &&
    store.members.filter((m) => m.organization_id === org.id && m.role === 'admin').length === 1
  )
    throw new HttpError(409, 'Não é possível remover ou rebaixar o último administrador.');
  if (action === 'remove_member') store.members = store.members.filter((m) => m !== member);
  else member.role = validated.role as typeof member.role;
  return { id };
}
export async function executeDemo(
  workspace: Workspace,
  action: string,
  validated: Payload,
  id?: string,
) {
  if (
    ['invite', 'update_member', 'remove_member', 'revoke_invite'].includes(action) &&
    workspace.organization.role !== 'admin'
  )
    throw new HttpError(403, 'Apenas administradores podem gerenciar a equipe.');
  let result: unknown;
  switch (action) {
    case 'create_ticket':
      result = await createTicket(workspace, validated);
      break;
    case 'comment':
    case 'transition':
      result = await updateTicket(workspace, action, validated, id);
      break;
    case 'update_member':
    case 'remove_member':
      result = await updateMember(workspace, action, validated, id);
      break;
    case 'invite':
      throw new HttpError(422, 'Conecte o Supabase para emitir convites com aceite seguro.');
    case 'revoke_invite':
      result = { id };
      break;
    default:
      throw new HttpError(404, 'Recurso não encontrado.');
  }
  return NextResponse.json(result, {
    status: ['create_ticket', 'comment'].includes(action) ? 201 : 200,
  });
}
