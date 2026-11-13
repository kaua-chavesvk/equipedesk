create table public.legal_acceptances (
 id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete set null,
 subject_hash text not null, kind text not null check(kind in ('terms','marketing_opt_in','marketing_opt_out')),
 terms_version text, privacy_version text, terms_digest text, privacy_digest text, adult_confirmed boolean,
 source text not null check(source in ('signup','account')), recorded_at timestamptz not null default now(),
 delete_after timestamptz
);
create index legal_acceptances_user on public.legal_acceptances(user_id,recorded_at desc);
create table public.privacy_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 marketing boolean not null default false, unsubscribe_hash text unique,
 updated_at timestamptz not null default now()
);
create table public.privacy_requests (
 id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete set null,
 subject_hash text not null, kind text not null check(kind in ('access','delete','correct','other')),
 details text not null default '' check(char_length(details)<=1000),
 status text not null default 'submitted' check(status in ('submitted','answered','denied')),
 response text check(char_length(response)<=2000), created_at timestamptz not null default now(),
 due_at timestamptz not null default now()+interval '15 days', completed_at timestamptz,
 delete_after timestamptz
);
create index privacy_requests_user on public.privacy_requests(user_id,created_at desc);
alter table public.legal_acceptances enable row level security;
alter table public.privacy_preferences enable row level security;
alter table public.privacy_requests enable row level security;
revoke all on public.legal_acceptances,public.privacy_preferences,public.privacy_requests from public,anon,authenticated;
grant select on public.legal_acceptances,public.privacy_preferences,public.privacy_requests to authenticated;
grant all on public.legal_acceptances,public.privacy_preferences,public.privacy_requests to service_role;
create policy legal_read on public.legal_acceptances for select to authenticated using(user_id=auth.uid() or exists(select 1 from public.platform_admins where user_id=auth.uid()));
create policy preferences_read on public.privacy_preferences for select to authenticated using(user_id=auth.uid());
create policy privacy_request_read on public.privacy_requests for select to authenticated using(user_id=auth.uid() or exists(select 1 from public.platform_admins where user_id=auth.uid()));

create function public.privacy_command(p_action text,p_payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_id uuid; v_token text; v_marketing boolean; v_allowed text[];
begin
 if v_user is null then raise exception '401:Sessão ausente.'; end if;
 if jsonb_typeof(p_payload) is distinct from 'object' then raise exception '422:Entrada inválida.'; end if;
 v_allowed:=case p_action
  when 'accept_terms' then array['termsAccepted','adultConfirmed','termsVersion','privacyVersion']
  when 'marketing' then array['enabled'] when 'request' then array['kind','details']
  when 'answer' then array['id','status','response'] else array[]::text[] end;
 if exists(select 1 from jsonb_object_keys(p_payload) k where k<>all(v_allowed)) then raise exception '422:Campos desconhecidos.'; end if;
 -- Per-user lock serializes repeated opt-ins and duplicate requests.
 perform 1 from auth.users where id=v_user for update;
 if p_action='accept_terms' then
  if p_payload->'termsAccepted' is distinct from 'true'::jsonb or p_payload->'adultConfirmed' is distinct from 'true'::jsonb
   or p_payload->>'termsVersion' is distinct from '2026-11-12' or p_payload->>'privacyVersion' is distinct from '2026-11-12'
  then raise exception '422:Aceite a versão atual dos termos e confirme ter 18 anos ou mais.'; end if;
  insert into public.legal_acceptances(user_id,subject_hash,kind,terms_version,privacy_version,terms_digest,privacy_digest,adult_confirmed,source)
  values(v_user,encode(extensions.digest(v_user::text,'sha256'),'hex'),'terms','2026-11-12','2026-11-12','c4d6ecc82e94dd49b5012ff2f54e1d827a35682105f236ab96b5d677eadc8994','6dbd113421bc998f986c50dcd83ffa4d3c37aa59f5d1b655c792c38939c9e3d2',true,'account') returning id into v_id;
  return jsonb_build_object('id',v_id);
 elsif p_action='marketing' then
  if jsonb_typeof(p_payload->'enabled') is distinct from 'boolean' then raise exception '422:Escolha inválida.'; end if;
  v_marketing:=(p_payload->>'enabled')::boolean;
  if v_marketing then v_token:=encode(extensions.gen_random_bytes(32),'hex'); end if;
  insert into public.privacy_preferences(user_id,marketing,unsubscribe_hash) values(v_user,v_marketing,case when v_token is not null then encode(extensions.digest(v_token,'sha256'),'hex') end)
  on conflict(user_id) do update set marketing=excluded.marketing,unsubscribe_hash=excluded.unsubscribe_hash,updated_at=now();
  insert into public.legal_acceptances(user_id,subject_hash,kind,source) values(v_user,encode(extensions.digest(v_user::text,'sha256'),'hex'),case when v_marketing then 'marketing_opt_in' else 'marketing_opt_out' end,'account');
  return jsonb_build_object('enabled',v_marketing,'unsubscribe_token',v_token);
 elsif p_action='request' then
  if coalesce(p_payload->>'kind','') not in ('access','delete','correct','other') or coalesce(char_length(p_payload->>'details'),0)>1000 then raise exception '422:Pedido inválido.'; end if;
  if exists(select 1 from public.privacy_requests where user_id=v_user and kind=p_payload->>'kind' and status='submitted') then raise exception '409:Já existe um pedido desse tipo em atendimento.'; end if;
  if (select count(*) from public.privacy_requests where user_id=v_user and created_at>now()-interval '1 day')>=5 then raise exception '429:Aguarde antes de abrir outro pedido.'; end if;
  insert into public.privacy_requests(user_id,subject_hash,kind,details) values(v_user,encode(extensions.digest(v_user::text,'sha256'),'hex'),p_payload->>'kind',coalesce(trim(p_payload->>'details'),'')) returning id into v_id;
  return jsonb_build_object('id',v_id,'message','Pedido recebido. A exclusão só será confirmada após análise e execução.');
 elsif p_action='answer' then
  if not exists(select 1 from public.platform_admins where user_id=v_user) then raise exception '403:Acesso restrito ao administrador geral.'; end if;
  if coalesce(p_payload->>'status','') not in ('answered','denied') or coalesce(char_length(trim(p_payload->>'response')),0) not between 10 and 2000 then raise exception '422:Informe uma resposta fundamentada.'; end if;
  update public.privacy_requests set status=p_payload->>'status',response=trim(p_payload->>'response'),completed_at=now(),delete_after=now()+interval '5 years'
   where id=(p_payload->>'id')::uuid and status='submitted' returning id into v_id;
  if not found then raise exception '404:Pedido não encontrado ou já respondido.'; end if;
  return jsonb_build_object('id',v_id);
 end if;
 raise exception '422:Operação inválida.';
end;
$$;
revoke all on function public.privacy_command(text,jsonb) from public,anon;
grant execute on function public.privacy_command(text,jsonb) to authenticated;

create function public.unsubscribe_marketing(p_token text) returns void
language plpgsql security definer set search_path='' as $$
declare v_user uuid;
begin
 if p_token !~ '^[a-f0-9]{64}$' then return; end if;
 update public.privacy_preferences set marketing=false,unsubscribe_hash=null,updated_at=now()
 where unsubscribe_hash=encode(extensions.digest(p_token,'sha256'),'hex') returning user_id into v_user;
 if v_user is not null then
  insert into public.legal_acceptances(user_id,subject_hash,kind,source) values(v_user,encode(extensions.digest(v_user::text,'sha256'),'hex'),'marketing_opt_out','account');
 end if;
end;
$$;
revoke all on function public.unsubscribe_marketing(text) from public;
grant execute on function public.unsubscribe_marketing(text) to anon,authenticated;

create function private.record_signup_acceptance() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.raw_user_meta_data->'legal_terms_accepted'='true'::jsonb and new.raw_user_meta_data->'legal_adult_confirmed'='true'::jsonb
  and new.raw_user_meta_data->>'legal_terms_version'='2026-11-12' and new.raw_user_meta_data->>'legal_privacy_version'='2026-11-12' then
  insert into public.legal_acceptances(user_id,subject_hash,kind,terms_version,privacy_version,terms_digest,privacy_digest,adult_confirmed,source)
  values(new.id,encode(extensions.digest(new.id::text,'sha256'),'hex'),'terms','2026-11-12','2026-11-12','c4d6ecc82e94dd49b5012ff2f54e1d827a35682105f236ab96b5d677eadc8994','6dbd113421bc998f986c50dcd83ffa4d3c37aa59f5d1b655c792c38939c9e3d2',true,'signup');
  insert into public.privacy_preferences(user_id,marketing) values(new.id,coalesce(new.raw_user_meta_data->'marketing_consent'='true'::jsonb,false));
  insert into public.legal_acceptances(user_id,subject_hash,kind,source)
  values(new.id,encode(extensions.digest(new.id::text,'sha256'),'hex'),case when new.raw_user_meta_data->'marketing_consent'='true'::jsonb then 'marketing_opt_in' else 'marketing_opt_out' end,'signup');
 end if;
 return new;
end;
$$;
create trigger record_signup_acceptance after insert on auth.users for each row execute function private.record_signup_acceptance();

create function private.close_privacy_records() returns trigger language plpgsql security definer set search_path='' as $$
begin
 update public.legal_acceptances set delete_after=now()+interval '5 years' where user_id=old.id;
 update public.privacy_requests set delete_after=coalesce(delete_after,now()+interval '5 years') where user_id=old.id;
 return old;
end;
$$;
create trigger close_privacy_records before delete on auth.users for each row execute function private.close_privacy_records();
revoke all on function private.record_signup_acceptance(),private.close_privacy_records() from public,anon,authenticated;
