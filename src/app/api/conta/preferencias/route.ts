import { NextResponse } from 'next/server';
import { preferencesUpdateSchema } from '@/features/account-settings/contracts';
import { readJson } from '@/lib/http/read-json';
import { failure } from '@/lib/http/api';
import { observeApi } from '@/lib/http/observe-api';
import { requireAccount, accountRpcError } from '@/lib/server/account-settings';

export const PATCH = observeApi('/api/conta/preferencias', async request => {
  try {
    const { db } = await requireAccount();
    const { patch, version } = preferencesUpdateSchema.parse(await readJson(request));
    const { data, error } = await db.rpc('account_preferences_update', { p_patch: patch, p_version: version });
    if (error) throw accountRpcError(error);
    return NextResponse.json(data);
  } catch (error) {
    return failure(error);
  }
});
