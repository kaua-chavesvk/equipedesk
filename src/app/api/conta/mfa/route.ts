import { NextResponse } from 'next/server';
import { mfaInput } from '@/features/security/mfa';
import { failure, HttpError } from '@/lib/http/api';
import { observeApi } from '@/lib/http/observe-api';
import { readJson } from '@/lib/http/read-json';
import { rateLimitBucket } from '@/lib/rate-limit';
import { adminMfaStatus, changeAdminMfa, requirePlatformAdmin } from '@/lib/server/admin-mfa';

const json = (body: unknown) => NextResponse.json(body, { headers: { 'Cache-Control': 'private, no-store' } });

export const GET = observeApi('/api/conta/mfa', async () => {
  try {
    const { db, user } = await requirePlatformAdmin();
    return json(await adminMfaStatus(db.auth, user.id));
  } catch (error) { return failure(error); }
});

export const POST = observeApi('/api/conta/mfa', async request => {
  try {
    const { db, user } = await requirePlatformAdmin();
    const input = mfaInput.parse(await readJson(request));
    let allowed: boolean;
    try { allowed = await rateLimitBucket('admin-mfa', user.id, 10); }
    catch { throw new HttpError(503, 'Serviço temporariamente indisponível.'); }
    if (!allowed) return NextResponse.json({ error: 'Muitas requisições. Aguarde um minuto.' }, {
      status: 429, headers: { 'Retry-After': '60', 'Cache-Control': 'private, no-store' },
    });
    return json(await changeAdminMfa(db.auth, user.id, input));
  } catch (error) { return failure(error); }
});
