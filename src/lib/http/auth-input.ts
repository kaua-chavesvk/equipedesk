import { acceptanceInput } from '../privacy-input';
import { z } from 'zod';

const email = z.email('Informe um e-mail válido.');
const password = z.string().min(8, 'Use ao menos 8 caracteres.');

export const authInput = z.discriminatedUnion('action', [
  z.object({ action: z.literal('login'), email, password }).strict(),
  z.object({
    action: z.literal('signup'), email, password,...acceptanceInput.shape,marketingConsent:z.boolean().default(false),
    name: z.string().trim().min(1, 'Informe seu nome.').max(100).optional(),
  }).strict(),
  z.object({ action: z.literal('recover'), email }).strict(),
  z.object({ action: z.literal('update_password'), password }).strict(),
  z.object({ action: z.literal('logout') }).strict(),
  z.object({ action: z.literal('demo') }).strict(),
]);
