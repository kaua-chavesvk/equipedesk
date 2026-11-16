import { NextResponse } from 'next/server';
import { workspacePreferenceSchema } from '@/features/account-settings/contracts';
import { failure } from '@/lib/http/api';
import { readJson } from '@/lib/http/read-json';
import { observeApi } from '@/lib/http/observe-api';
import { requireAccount, accountRpcError } from '@/lib/server/account-settings';

export const PUT = observeApi('/api/empresas/[slug]/minha-visualizacao', async (request, context: { params: Promise<{ slug: string }> }) => {
  try {
    const { db } = await requireAccount();
    const { slug } = await context.params;
    const { view, queueView, version } = workspacePreferenceSchema.parse(await readJson(request));
    const { data, error } = await db.rpc('account_workspace_preference_update', {
      p_slug: slug, p_view: view, p_queue_view: queueView, p_version: version,
    });
    if (error) throw accountRpcError(error);
    return NextResponse.json(data);
  } catch (error) { return failure(error); }
});
