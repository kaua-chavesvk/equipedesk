import 'server-only';
import { cache } from 'react';
import { HttpError } from '@/lib/http/api';
import { configured, supabaseServer } from '@/lib/supabase/server';

export const accountScope = cache(async () => {
  if (!configured()) return null;
  const db = await supabaseServer();
  const { data: { user }, error } = await db.auth.getUser();
  if (error && error.name !== 'AuthSessionMissingError' && ![400, 401, 403].includes(error.status ?? 0)) {
    throw new HttpError(503, 'Não foi possível verificar sua sessão.');
  }
  return user ? { db, user } : null;
});

export const accountFlags = cache(async () => {
  const scope = await accountScope();
  if (!scope) return { settings: false, avatars: false };
  const result = await scope.db.rpc('account_feature_status');
  // A deploy can run against the previous schema while the feature is disabled.
  if (result.error?.code === 'PGRST202') return { settings: false, avatars: false };
  if (result.error) throw new HttpError(503, 'Configurações temporariamente indisponíveis.');
  const flags = result.data;
  if (!flags || typeof flags !== 'object' || Array.isArray(flags)) return { settings: false, avatars: false };
  return { settings: flags.settings === true, avatars: flags.avatars === true };
});

export const accountPreferences = cache(async () => {
  const scope = await accountScope();
  if (!scope || !(await accountFlags()).settings) return null;
  const { data, error } = await scope.db.from('user_preferences').select('*').eq('user_id', scope.user.id).single();
  if (error) throw new HttpError(503, 'Não foi possível carregar suas preferências.');
  return data;
});

export async function requireAccount() {
  const scope = await accountScope();
  if (!scope) throw new HttpError(401, 'Entre na sua conta para continuar.');
  return scope;
}

export async function workspaceStart(slug: string, organizationId: string) {
  const base = '/e/' + slug;
  const prefs = await accountPreferences().catch(() => null);
  if (!prefs) return base;
  if (prefs.home_view !== 'last') return base + '/chamados?view=' + prefs.home_view;
  const scope = await accountScope();
  if (!scope) return base;
  const previous = await scope.db.from('user_workspace_preferences').select('last_view,last_queue_view')
    .eq('user_id', scope.user.id).eq('organization_id', organizationId).maybeSingle();
  if (previous.error || previous.data?.last_view === 'overview') return base;
  return base + '/chamados?view=' + (previous.data?.last_queue_view ?? prefs.queue_view);
}

export function accountRpcError(error: { code?: string; message: string }) {
  const domain = error.code === 'P0001' && /^(401|403|404|409|422|429|503):(.+)$/.exec(error.message);
  return domain
    ? new HttpError(Number(domain[1]), domain[2])
    : new HttpError(503, 'Não foi possível salvar agora. Tente novamente.');
}
