import { z } from 'zod';
import { HttpError, ticketInput, transitionInput } from '@/lib/http/api';

export function parseCommand(
  section: string | undefined,
  id: string | undefined,
  sub: string | undefined,
  method: string,
  payload: unknown,
) {
  let action: string;
  let validated: Record<string, unknown>;
  if (section === 'chamados' && !id && method === 'POST') {
    action = 'create_ticket';
    validated = ticketInput.parse(payload);
  } else if (section === 'chamados' && id && sub === 'comentarios' && method === 'POST') {
    action = 'comment';
    validated = {
      id,
      ...z
        .object({ body: z.string().trim().min(1).max(5000) })
        .strict()
        .parse(payload),
    };
  } else if (section === 'chamados' && id && sub === 'transicoes' && method === 'POST') {
    action = 'transition';
    validated = { id, ...transitionInput.parse(payload) };
  } else if (section === 'membros' && id && method === 'PATCH') {
    action = 'update_member';
    validated = {
      id,
      ...z
        .object({ role: z.enum(['admin', 'agent', 'requester']) })
        .strict()
        .parse(payload),
    };
  } else if (section === 'membros' && id && method === 'DELETE') {
    action = 'remove_member';
    validated = { id };
  } else if (section === 'convites' && !id && method === 'POST') {
    action = 'invite';
    validated = z
      .object({
        email: z.email().transform((s) => s.toLowerCase()),
        role: z.enum(['admin', 'agent', 'requester']),
      })
      .strict()
      .parse(payload);
  } else if (section === 'convites' && id && method === 'DELETE') {
    action = 'revoke_invite';
    validated = { id };
  } else throw new HttpError(404, 'Recurso não encontrado.');

  return { action, validated };
}
