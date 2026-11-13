create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create type public.member_role as enum ('admin','agent','requester');
create type public.ticket_status as enum ('open','in_progress','resolved');
create type public.ticket_priority as enum ('low','medium','high','urgent');

create table public.organizations (
 id uuid primary key default gen_random_uuid(), name text not null check (char_length(name) between 2 and 100),
 slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,59}$'), created_at timestamptz not null default now()
);
create table public.memberships (
 organization_id uuid not null references public.organizations(id), user_id uuid not null references auth.users(id),
 role public.member_role not null, created_at timestamptz not null default now(), primary key(organization_id,user_id)
);
create table public.invitations (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 email text not null check(email=lower(trim(email)) and email like '%@%'), role public.member_role not null,
 token_hash text not null unique, expires_at timestamptz not null, created_by uuid not null references auth.users(id),
 accepted_at timestamptz, revoked_at timestamptz, created_at timestamptz not null default now()
);
create table public.tickets (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 requester_id uuid not null references auth.users(id), assignee_id uuid references auth.users(id),
 title text not null check(char_length(title) between 3 and 160), description text not null check(char_length(description) between 10 and 10000),
 priority public.ticket_priority not null default 'medium', status public.ticket_status not null default 'open',
 version integer not null default 1 check(version>0), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(organization_id,id), check((status='open' and assignee_id is null) or status<>'open')
);
create table public.comments (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, ticket_id uuid not null,
 author_id uuid not null references auth.users(id), body text not null check(char_length(body) between 1 and 5000),
 created_at timestamptz not null default now(), foreign key(organization_id,ticket_id) references public.tickets(organization_id,id)
);
create table public.ticket_events (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, ticket_id uuid not null,
 actor_id uuid not null references auth.users(id), kind text not null, payload jsonb not null default '{}',
 created_at timestamptz not null default now(), foreign key(organization_id,ticket_id) references public.tickets(organization_id,id)
);
create index memberships_user on public.memberships(user_id,organization_id);
create index tickets_queue on public.tickets(organization_id,status,created_at desc,id desc);
create index tickets_requester on public.tickets(organization_id,requester_id,created_at desc,id desc);
create index comments_ticket on public.comments(organization_id,ticket_id,created_at,id);
create index events_ticket on public.ticket_events(organization_id,ticket_id,created_at,id);
create index invitations_organization on public.invitations(organization_id,created_at desc);

create function private.role_in(p_org uuid) returns public.member_role language sql stable security definer set search_path='' as $$
 select role from public.memberships where organization_id=p_org and user_id=auth.uid()
$$;
create function private.can_read_ticket(p_org uuid,p_ticket uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.tickets t join public.memberships m on m.organization_id=t.organization_id and m.user_id=auth.uid()
 where t.organization_id=p_org and t.id=p_ticket and (m.role in ('admin','agent') or t.requester_id=auth.uid()))
$$;
revoke all on function private.role_in(uuid),private.can_read_ticket(uuid,uuid) from public;
grant execute on function private.role_in(uuid),private.can_read_ticket(uuid,uuid) to authenticated;

alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.invitations enable row level security;
alter table public.tickets enable row level security;
alter table public.comments enable row level security;
alter table public.ticket_events enable row level security;
create policy organization_read on public.organizations for select to authenticated using(private.role_in(id) is not null);
create policy membership_read on public.memberships for select to authenticated using(private.role_in(organization_id) is not null);
create policy invitation_read on public.invitations for select to authenticated using(private.role_in(organization_id)='admin');
create policy ticket_read on public.tickets for select to authenticated using(private.role_in(organization_id) in ('admin','agent') or (private.role_in(organization_id)='requester' and requester_id=auth.uid()));
create policy comment_read on public.comments for select to authenticated using(private.can_read_ticket(organization_id,ticket_id));
create policy event_read on public.ticket_events for select to authenticated using(private.can_read_ticket(organization_id,ticket_id));
revoke all on public.organizations,public.memberships,public.invitations,public.tickets,public.comments,public.ticket_events from anon,authenticated;
grant select on public.organizations,public.memberships,public.tickets,public.comments,public.ticket_events to authenticated;
grant select(id,organization_id,email,role,expires_at,created_by,accepted_at,revoked_at,created_at) on public.invitations to authenticated;

create function public.desk_command(p_slug text,p_action text,p_payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 v_user uuid := auth.uid(); v_org uuid; v_role public.member_role; v_ticket public.tickets; v_inv public.invitations;
 v_id uuid; v_target uuid; v_role_new public.member_role; v_token text; v_email text; v_body text; v_kind text; v_version integer;
begin
 if v_user is null then raise exception '401:Sessão ausente.'; end if;
 if p_action='create_organization' then
  insert into public.organizations(name,slug) values(trim(p_payload->>'name'),p_payload->>'slug') returning id into v_org;
  insert into public.memberships(organization_id,user_id,role) values(v_org,v_user,'admin');
  return jsonb_build_object('id',v_org,'slug',p_payload->>'slug');
 end if;
 if p_action='accept_invite' then
  select * into v_inv from public.invitations where token_hash=encode(extensions.digest(p_payload->>'token','sha256'),'hex');
  if not found then raise exception '404:Convite não encontrado.'; end if;
  perform 1 from public.organizations where id=v_inv.organization_id for update;
  -- Re-read under lock after locking the organization, matching the revocation lock order.
  select * into v_inv from public.invitations where id=v_inv.id for update;
  if v_inv.accepted_at is not null or v_inv.revoked_at is not null or v_inv.expires_at<=now() then raise exception '409:Convite expirado ou já utilizado.'; end if;
  select lower(email) into v_email from auth.users where id=v_user and email_confirmed_at is not null;
  if v_email is distinct from v_inv.email then raise exception '403:Confirme o e-mail correspondente ao convite.'; end if;
  if exists(select 1 from public.memberships where organization_id=v_inv.organization_id and user_id=v_user) then raise exception '409:Você já pertence a esta empresa.'; end if;
  insert into public.memberships(organization_id,user_id,role) values(v_inv.organization_id,v_user,v_inv.role);
  update public.invitations set accepted_at=now() where id=v_inv.id;
  return (select jsonb_build_object('id',id,'slug',slug) from public.organizations where id=v_inv.organization_id);
 end if;
 -- Serializes membership changes, including last-admin protection and concurrent invitations.
 select id into v_org from public.organizations where slug=p_slug for update;
 v_role := private.role_in(v_org);
 if v_org is null or v_role is null then raise exception '404:Empresa não encontrada.'; end if;
 if p_action='create_ticket' then
  insert into public.tickets(organization_id,requester_id,title,description,priority)
  values(v_org,v_user,trim(p_payload->>'title'),trim(p_payload->>'description'),coalesce(p_payload->>'priority','medium')::public.ticket_priority) returning * into v_ticket;
  insert into public.ticket_events(organization_id,ticket_id,actor_id,kind) values(v_org,v_ticket.id,v_user,'created');
  return to_jsonb(v_ticket);
 end if;
 if p_action in ('comment','transition') then
  select * into v_ticket from public.tickets where organization_id=v_org and id=(p_payload->>'id')::uuid for update;
  if not found or not private.can_read_ticket(v_org,v_ticket.id) then raise exception '404:Chamado não encontrado.'; end if;
  if p_action='comment' then
   v_body := trim(p_payload->>'body');
   insert into public.comments(organization_id,ticket_id,author_id,body) values(v_org,v_ticket.id,v_user,v_body) returning id into v_id;
   insert into public.ticket_events(organization_id,ticket_id,actor_id,kind,payload) values(v_org,v_ticket.id,v_user,'commented',jsonb_build_object('comment_id',v_id));
   return jsonb_build_object('id',v_id);
  end if;
  v_kind := p_payload->>'action';
  if v_kind in ('assign','resolve') and v_role not in ('admin','agent') then raise exception '403:Apenas atendentes podem executar esta ação.'; end if;
  if v_kind not in ('assign','resolve','reopen') or v_kind is null then raise exception '422:Transição inválida.'; end if;
  v_version := (p_payload->>'version')::integer;
  if v_version is null then raise exception '422:Informe a versão do chamado.'; end if;
  if v_ticket.version<>v_version then raise exception '409:O chamado foi atualizado. Recarregue a página.'; end if;
  if v_kind='assign' and (v_ticket.status<>'open' or v_ticket.assignee_id is not null) then raise exception '409:Este chamado já foi assumido.'; end if;
  if v_kind='resolve' and v_ticket.status<>'in_progress' then raise exception '409:Assuma o chamado antes de resolver.'; end if;
  if v_kind='reopen' and v_ticket.status<>'resolved' then raise exception '409:Somente chamados resolvidos podem ser reabertos.'; end if;
  if v_kind='reopen' and coalesce(char_length(trim(p_payload->>'reason')),0) not between 3 and 1000 then raise exception '422:Informe o motivo da reabertura (3 a 1000 caracteres).'; end if;
  update public.tickets set status=case v_kind when 'assign' then 'in_progress'::public.ticket_status when 'resolve' then 'resolved'::public.ticket_status else 'open'::public.ticket_status end,
   assignee_id=case v_kind when 'assign' then v_user when 'reopen' then null else assignee_id end,version=version+1,updated_at=now()
   where id=v_ticket.id and version=v_version returning * into v_ticket;
  if not found then raise exception '409:Versão desatualizada.'; end if;
  insert into public.ticket_events(organization_id,ticket_id,actor_id,kind,payload) values(v_org,v_ticket.id,v_user,v_kind,jsonb_build_object('reason',p_payload->>'reason','version',v_ticket.version));
  return to_jsonb(v_ticket);
 end if;
 if v_role<>'admin' then raise exception '403:Apenas administradores podem gerenciar a equipe.'; end if;
 if p_action='invite' then
  v_email:=lower(trim(p_payload->>'email')); v_role_new:=(p_payload->>'role')::public.member_role;
  v_token:=encode(extensions.gen_random_bytes(32),'hex');
  insert into public.invitations(organization_id,email,role,token_hash,expires_at,created_by)
  values(v_org,v_email,v_role_new,encode(extensions.digest(v_token,'sha256'),'hex'),now()+interval '7 days',v_user) returning id into v_id;
  return jsonb_build_object('id',v_id,'token',v_token,'expires_in_days',7);
 elsif p_action='revoke_invite' then
  update public.invitations set revoked_at=now() where id=(p_payload->>'id')::uuid and organization_id=v_org and accepted_at is null and revoked_at is null returning id into v_id;
  if not found then raise exception '404:Convite não encontrado.'; end if;
  return jsonb_build_object('id',v_id);
 elsif p_action in ('update_member','remove_member') then
  v_target:=(p_payload->>'id')::uuid;
  select role into v_role_new from public.memberships where organization_id=v_org and user_id=v_target for update;
  if not found then raise exception '404:Membro não encontrado.'; end if;
  if v_role_new='admin' and (p_action='remove_member' or p_payload->>'role'<>'admin')
   and (select count(*) from public.memberships where organization_id=v_org and role='admin')=1 then raise exception '409:A empresa precisa de pelo menos um administrador.'; end if;
  if p_action='remove_member' then delete from public.memberships where organization_id=v_org and user_id=v_target;
  else update public.memberships set role=(p_payload->>'role')::public.member_role where organization_id=v_org and user_id=v_target; end if;
  return jsonb_build_object('id',v_target);
 end if;
 raise exception '422:Operação desconhecida.';
exception
 when unique_violation then raise exception '409:Este registro já existe.';
 when check_violation or not_null_violation or invalid_text_representation then raise exception '422:Dados inválidos. Revise os campos.';
end;
$$;
revoke all on function public.desk_command(text,text,jsonb) from public,anon;
grant execute on function public.desk_command(text,text,jsonb) to authenticated;
