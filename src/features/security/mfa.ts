import { z } from 'zod';

export const mfaInput = z.discriminatedUnion('action', [
  z.object({ action: z.literal('enroll') }).strict(),
  z.object({ action: z.literal('verify'), factorId: z.uuid(), code: z.string().regex(/^\d{6}$/) }).strict(),
  z.object({ action: z.literal('cancel'), factorId: z.uuid() }).strict(),
]);

export type MfaInput = z.infer<typeof mfaInput>;
export type MfaStatus = {
  verified: boolean;
  factors: { id: string; status: 'verified' | 'unverified' }[];
};
export type MfaEnrollment = { factorId: string; qrCode: string; secret: string };
