-- Platform privileges are provisioned only through the administrative server API.
create table public.platform_admins (
 user_id uuid primary key references auth.users(id) on delete cascade,
 created_at timestamptz not null default now()
);
alter table public.platform_admins enable row level security;
revoke all on public.platform_admins from public, anon, authenticated;
grant select on public.platform_admins to authenticated;
grant all on public.platform_admins to service_role;
create policy platform_admin_self_read on public.platform_admins for select to authenticated
 using (user_id = auth.uid());

create or replace function private.role_in(p_org uuid) returns public.member_role
language sql stable security definer set search_path='' as $$
 select case when exists(select 1 from public.organizations where id=p_org)
  and exists(select 1 from public.platform_admins where user_id=auth.uid())
 then 'admin'::public.member_role
 else (select role from public.memberships where organization_id=p_org and user_id=auth.uid()) end
$$;

create or replace function private.can_read_ticket(p_org uuid,p_ticket uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.tickets t where t.organization_id=p_org and t.id=p_ticket
  and (private.role_in(p_org) in ('admin','agent')
   or (private.role_in(p_org)='requester' and t.requester_id=auth.uid())))
$$;
