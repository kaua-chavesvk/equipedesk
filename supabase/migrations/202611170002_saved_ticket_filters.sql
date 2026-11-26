-- Personal queue shortcuts. Existing policies/functions are not modified.
create table public.user_ticket_filters (
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  filters jsonb not null default '[]'::jsonb check (jsonb_typeof(filters) = 'array' and jsonb_array_length(filters) <= 10),
  version integer not null default 0 check (version >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, organization_id)
);
alter table public.user_ticket_filters enable row level security;
revoke all on public.user_ticket_filters from public, anon, authenticated;
grant select on public.user_ticket_filters to authenticated;
grant all on public.user_ticket_filters to service_role;
create policy personal_ticket_filters_read on public.user_ticket_filters for select to authenticated
  using (user_id = (select auth.uid()) and private.role_in(organization_id) is not null);

create function public.ticket_filters_update(p_slug text, p_filters jsonb, p_version integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_org uuid;
  v_item jsonb;
  v_current public.user_ticket_filters;
begin
  if v_user is null then raise exception '401: Entre na sua conta para continuar.'; end if;
  select id into v_org from public.organizations where slug = p_slug;
  if v_org is null or private.role_in(v_org) is null then raise exception '404: Empresa não encontrada.'; end if;
  if p_version is null or p_version < 0 or p_version > 2147483646
    or p_filters is null or jsonb_typeof(p_filters) <> 'array' then
    raise exception '422: Filtros inválidos.';
  end if;
  if jsonb_array_length(p_filters) > 10 then raise exception '422: Salve no máximo dez filtros por empresa.'; end if;
  for v_item in select value from jsonb_array_elements(p_filters) loop
    if jsonb_typeof(v_item) <> 'object' then raise exception '422: Filtros inválidos.'; end if;
    if (select count(*) from jsonb_object_keys(v_item)) <> 7
      or not (v_item ?& array['id','name','q','status','priority','assignee','view'])
      or exists (select 1 from jsonb_each(v_item) where jsonb_typeof(value) <> 'string') then
      raise exception '422: Filtros inválidos.';
    end if;
    if (v_item->>'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or length(btrim(v_item->>'name')) not between 1 and 40
      or length(v_item->>'q') > 200
      or (v_item->>'status') not in ('all','open','in_progress','resolved')
      or (v_item->>'priority') not in ('all','low','medium','high','urgent')
      or (v_item->>'assignee') not in ('all','me')
      or (v_item->>'view') not in ('list','kanban') then
      raise exception '422: Filtros inválidos.';
    end if;
  end loop;
  if (select count(distinct value->>'id') from jsonb_array_elements(p_filters)) <> jsonb_array_length(p_filters)
    or (select count(distinct lower(btrim(value->>'name'))) from jsonb_array_elements(p_filters)) <> jsonb_array_length(p_filters) then
    raise exception '422: Use nomes diferentes para os filtros salvos.';
  end if;
  insert into public.user_ticket_filters(user_id, organization_id) values (v_user, v_org) on conflict do nothing;
  select * into v_current from public.user_ticket_filters where user_id = v_user and organization_id = v_org for update;
  if v_current.version <> p_version then raise exception '409: Os filtros mudaram em outra sessão. Recarregue antes de salvar.'; end if;
  update public.user_ticket_filters set filters = p_filters, version = version + 1, updated_at = now()
    where user_id = v_user and organization_id = v_org returning * into v_current;
  return jsonb_build_object('filters', v_current.filters, 'version', v_current.version);
end;
$$;
revoke all on function public.ticket_filters_update(text,jsonb,integer) from public, anon;
grant execute on function public.ticket_filters_update(text,jsonb,integer) to authenticated;
