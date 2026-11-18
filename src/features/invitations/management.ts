import type { Invitation } from '@/lib/supabase/database.types';

export type ManagedInvitation = Pick<Invitation, 'id' | 'email' | 'role' | 'expires_at'>;

export function invitationLink(token: unknown, origin: string) {
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return null;
  return new URL('/convite/' + token, origin).href;
}
