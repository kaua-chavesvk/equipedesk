create table private.command_rate (
 user_id uuid not null references auth.users(id) on delete cascade,
 window_start timestamptz not null,
 attempts integer not null,
 primary key(user_id,window_start)
);
revoke all on private.command_rate from public,anon,authenticated;

create or replace function public.desk_command(p_slug text,p_action text,p_payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 v_allowed text[]; v_attempts integer;
 v_user uuid := auth.uid(); v_org uuid; v_role public.member_role; v_ticket public.tickets; v_inv public.invitations;
 v_id uuid; v_target uuid; v_role_new public.member_role; v_token text; v_email text; v_body text; v_kind text; v_version integer;
begin
 if v_user is null then raise exception '401:Sessão ausente.'; end if;
 if jsonb_typeof(p_payload) is distinct from 'object' then raise exception '422:Payload inválido.'; end if;
 v_allowed := case p_action
 when 'create_organization' then array['name','slug']
 when 'accept_invite' then array['token']
 when 'create_ticket' then array['title','description','priority']
 when 'comment' then array['id','body']
 when 'transition' then array['id','action','version','reason']
 when 'invite' then array['email','role']
 when 'update_member' then array['id','role']
 when 'remove_member' then array['id']
 when 'revoke_invite' then array['id'] else array[]::text[] end;
 if exists(select 1 from jsonb_object_keys(p_payload) k where k <> all(v_allowed)) then raise exception '422:Campos desconhecidos.'; end if;
 -- Bound direct Data API writes as well as requests through Next.js.
 delete from private.command_rate where user_id=v_user and window_start < date_trunc('minute',now())-interval '1 minute';
 insert into private.command_rate as quota(user_id,window_start,attempts) values(v_user,date_trunc('minute',now()),1)
 on conflict(user_id,window_start) do update set attempts=quota.attempts+1 returning attempts into v_attempts;
 if v_attempts>120 then raise exception '429:Muitas operações. Aguarde um minuto.'; end if;
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
  if coalesce(char_length(trim(p_payload->>'title')),0) not between 5 and 160 then raise exception '422:Título deve ter de 5 a 160 caracteres.'; end if;
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
