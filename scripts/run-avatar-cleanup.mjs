import { createClient } from '@supabase/supabase-js';

const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key, AVATAR_CLEANUP_TARGET: target } = process.env;
if (!url || !key || !target || new URL(url).origin !== target) {
  throw new Error('Defina o destino exato da limpeza e as credenciais no processo administrativo.');
}
const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(8000) }) },
});
const { data: jobs, error } = await db.rpc('avatar_cleanup_claim', { p_limit: 25 });
if (error || !Array.isArray(jobs)) throw new Error('Não foi possível obter o lote de limpeza.');
let completed = 0;
for (const job of jobs) {
  if (!/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.webp$/.test(job.path)) continue;
  const deleted = await db.storage.from('profile-avatars').remove([job.path]);
  if (deleted.error) continue;
  const result = await db.rpc('avatar_cleanup_complete', { p_id: job.id, p_lease: job.lease_token });
  if (!result.error) completed++;
}
console.log(JSON.stringify({ claimed: jobs.length, completed, pendingRetry: jobs.length - completed }));
if (completed !== jobs.length) process.exitCode = 1;
