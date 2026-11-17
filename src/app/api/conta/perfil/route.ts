import { NextResponse } from 'next/server';
import { profileUpdateSchema } from '@/features/account-settings/contracts';
import { readJson } from '@/lib/http/read-json';
import { failure } from '@/lib/http/api';
import { observeApi } from '@/lib/http/observe-api';
import { requireAccount, accountRpcError } from '@/lib/server/account-settings';

export const PATCH = observeApi('/api/conta/perfil', async request => {
  try {
    const { db } = await requireAccount();
    const { displayName, version } = profileUpdateSchema.parse(await readJson(request));
    const { data, error } = await db.rpc('account_profile_update', { p_name: displayName, p_version: version });
    if (error) throw accountRpcError(error);
    const result = data as { display_name: string; version: number };
    return NextResponse.json({ display_name: result.display_name, version: result.version });
  } catch (error) {
    return failure(error);
  }
});
