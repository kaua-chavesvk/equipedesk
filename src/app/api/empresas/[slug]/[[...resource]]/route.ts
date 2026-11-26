import { observeApi } from '@/lib/http/observe-api';
import { readJson } from '@/lib/http/read-json';
import { demoEnabled, getWorkspace } from '@/lib/data';
import { failure } from '@/lib/http/api';

import { handleInvitations } from '@/lib/server/workspace-api/invitations';
import { handleQuery } from '@/lib/server/workspace-api/queries';
import { parseCommand } from '@/lib/server/workspace-api/commands';
import { executeDemo } from '@/lib/server/workspace-api/demo';
import { executeProduction } from '@/lib/server/workspace-api/production';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ slug: string; resource?: string[] }> };
async function handle(request: Request, context: Context) {
  try {
    const { slug, resource = [] } = await context.params;
    const [section, id, sub] = resource;
    const workspace = await getWorkspace(slug);
    const method = request.method;
    const url = new URL(request.url);
    const payload = method === 'GET' || method === 'DELETE' ? {} : await readJson(request);

    if (
      section === 'convites' &&
      ((!id && method === 'GET') ||
        (id && sub === 'renovar' && method === 'POST' && resource.length === 3))
    )
      return await handleInvitations(workspace, slug, id, method, payload, url);
    if (method === 'GET') return await handleQuery(workspace, section, id, url);
    const { action, validated } = parseCommand(section, id, sub, method, payload);
    return demoEnabled()
      ? await executeDemo(workspace, action, validated, id)
      : await executeProduction(workspace, slug, action, validated, request);
  } catch (error) {
    return failure(error);
  }
}
export const GET = observeApi('/api/empresas/[slug]/[[...resource]]', handle);
export { GET as POST, GET as PATCH, GET as DELETE };
