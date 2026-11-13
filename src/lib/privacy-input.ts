import { z } from 'zod';
import { LEGAL_VERSION } from './legal';
export const acceptanceInput=z.object({
  termsAccepted:z.literal(true,{error:'Leia e aceite os Termos de Uso.'}),
  adultConfirmed:z.literal(true,{error:'O serviço é destinado a pessoas com 18 anos ou mais.'}),
  termsVersion:z.literal(LEGAL_VERSION),privacyVersion:z.literal(LEGAL_VERSION),
}).strict();
export const privacyInput=z.discriminatedUnion('action',[
  acceptanceInput.extend({action:z.literal('accept_terms')}),
  z.object({action:z.literal('marketing'),enabled:z.boolean()}).strict(),
  z.object({action:z.literal('request'),kind:z.enum(['access','delete','correct','other']),details:z.string().trim().max(1000).default('')}).strict(),
  z.object({action:z.literal('answer'),id:z.uuid(),status:z.enum(['answered','denied']),response:z.string().trim().min(10).max(2000)}).strict(),
]);
