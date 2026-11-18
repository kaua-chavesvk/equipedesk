import 'server-only';
import { HttpError } from '@/lib/http/api';
import type { supabaseServer } from '@/lib/supabase/server';

type ServerAuth = Pick<Awaited<ReturnType<typeof supabaseServer>>['auth'], 'getClaims'>;

export async function hasAdminAssurance(auth: ServerAuth, userId: string) {
  if (process.env.ENFORCE_PLATFORM_ADMIN_AAL2 !== 'true') return true;
  const { data, error } = await auth.getClaims();
  return !error && data?.claims.sub === userId && data.claims.aal === 'aal2';
}

export async function requireAdminAssurance(auth: ServerAuth, userId: string) {
  if (!(await hasAdminAssurance(auth, userId))) {
    throw new HttpError(403, 'Confirme o segundo fator para acessar a administração.');
  }
}
