import { NextResponse } from 'next/server';
import { z } from 'zod';
import { filtersUpdate, filtersState } from '@/features/tickets/saved-filters';
import { failure, HttpError } from '@/lib/http/api';
import { observeApi } from '@/lib/http/observe-api';
import { readJson } from '@/lib/http/read-json';
import { accountRpcError, requireAccount } from '@/lib/server/account-settings';

type Context = { params: Promise<{ slug: string }> };
const slugInput = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const json = (body: unknown) =>
  NextResponse.json(body, { headers: { 'Cache-Control': 'private, no-store' } });

export const GET = observeApi(
  '/api/empresas/[slug]/filtros-salvos',
  async (_request, context: Context) => {
    try {
      const { db, user } = await requireAccount();
      const slug = slugInput.parse((await context.params).slug);
      const organization = await db
        .from('organizations')
        .select('id')
        .eq('slug', slug)
        .maybeSingle();
      if (organization.error)
        throw new HttpError(503, 'Não foi possível carregar os filtros salvos.');
      if (!organization.data) throw new HttpError(404, 'Empresa não encontrada.');
      const result = await db
        .from('user_ticket_filters')
        .select('filters,version')
        .eq('organization_id', organization.data.id)
        .eq('user_id', user.id)
        .maybeSingle();
      if (result.error) throw new HttpError(503, 'Não foi possível carregar os filtros salvos.');
      return json(filtersState.parse(result.data ?? { filters: [], version: 0 }));
    } catch (error) {
      return failure(error);
    }
  },
);

export const PUT = observeApi(
  '/api/empresas/[slug]/filtros-salvos',
  async (request, context: Context) => {
    try {
      const { db } = await requireAccount();
      const slug = slugInput.parse((await context.params).slug);
      const { filters, version } = filtersUpdate.parse(await readJson(request));
      const result = await db.rpc('ticket_filters_update', {
        p_slug: slug,
        p_filters: filters,
        p_version: version,
      });
      if (result.error) throw accountRpcError(result.error);
      return json(filtersState.parse(result.data));
    } catch (error) {
      return failure(error);
    }
  },
);
