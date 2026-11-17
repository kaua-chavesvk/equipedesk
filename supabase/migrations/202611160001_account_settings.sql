-- Account settings never inherit the platform administrator exception.
create table private.account_feature_flags (
 name text primary key check (name in ('settings','avatars','email_change')),
 enabled boolean not null default false, updated_at timestamptz not null default now()
);
insert into private.account_feature_flags(name) values ('settings'),('avatars'),('email_change');
create table private.account_settings_rate (
 user_id uuid not null references auth.users(id) on delete cascade,
 window_start timestamptz not null, attempts integer not null,
 primary key(user_id,window_start)
);
revoke all on private.account_feature_flags,private.account_settings_rate from public,anon,authenticated;
create function private.check_account_settings_write() returns void
language plpgsql security definer set search_path = '' as $$
declare total integer;
begin
 if not exists(select 1 from private.account_feature_flags where name='settings' and enabled) then
  raise exception '409:Configurações indisponíveis.';
 end if;
 delete from private.account_settings_rate where user_id=auth.uid() and window_start<date_trunc('minute',now())-interval '1 minute';
 insert into private.account_settings_rate as quota(user_id,window_start,attempts)
  values(auth.uid(),date_trunc('minute',now()),1)
  on conflict(user_id,window_start) do update set attempts=quota.attempts+1 returning quota.attempts into total;
 if total>30 then raise exception '429:Aguarde antes de alterar outras configurações.'; end if;
end;
$$;
revoke all on function private.check_account_settings_write() from public,anon,authenticated;
create function private.can_read_profile(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select auth.uid() is not null and (p_user = auth.uid() or exists (
  select 1 from public.memberships viewer
  join public.memberships subject on subject.organization_id = viewer.organization_id
  where viewer.user_id = auth.uid() and subject.user_id = p_user
 ));
$$;
revoke all on function private.can_read_profile(uuid) from public, anon;
grant execute on function private.can_read_profile(uuid) to authenticated;

create function private.valid_account_timezone(p_name text) returns boolean
language sql stable set search_path = '' as $$
 select p_name is not null and length(p_name) <= 64
  and exists (select 1 from pg_catalog.pg_timezone_names where name = p_name);
$$;
revoke all on function private.valid_account_timezone(text) from public, anon;
grant execute on function private.valid_account_timezone(text) to authenticated;

create table public.profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null check (display_name = btrim(display_name)
  and char_length(display_name) between 1 and 100 and display_name !~ '[[:cntrl:]]'),
 avatar_path text,
 avatar_version integer not null default 0 check (avatar_version >= 0),
 updated_at timestamptz not null default now(),
 version integer not null default 1 check (version > 0),
 check (avatar_path is null or avatar_path ~ ('^' || user_id::text || '/[0-9a-f-]{36}\.webp$'))
);
create table public.user_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 theme text not null default 'system' check (theme in ('light','dark','system')),
 theme_explicit boolean not null default false,
 text_scale integer not null default 100 check (text_scale in (100,110,125)),
 density text not null default 'comfortable' check (density in ('comfortable','compact')),
 contrast text not null default 'standard' check (contrast in ('standard','high')),
 motion text not null default 'system' check (motion in ('system','reduce')),
 locale text not null default 'pt-BR' check (locale in ('pt-BR','en')),
 format_locale text not null default 'pt-BR' check (format_locale = 'pt-BR'),
 timezone_mode text not null default 'auto' check (timezone_mode in ('auto','manual')),
 timezone text,
 home_view text not null default 'list' check (home_view in ('list','kanban','last')),
 queue_view text not null default 'list' check (queue_view in ('list','kanban')),
 notify_assigned boolean not null default false,
 notify_comment boolean not null default false,
 notify_resolved boolean not null default false,
 updated_at timestamptz not null default now(),
 version integer not null default 1 check (version > 0),
 check ((timezone_mode = 'auto' and timezone is null)
  or (timezone_mode = 'manual' and private.valid_account_timezone(timezone)))
);
create table public.user_workspace_preferences (
 user_id uuid not null references auth.users(id) on delete cascade,
 organization_id uuid not null references public.organizations(id) on delete cascade,
 last_view text not null check (last_view in ('overview','queue')),
 last_queue_view text not null check (last_queue_view in ('list','kanban')),
 updated_at timestamptz not null default now(),
 version integer not null default 1 check (version > 0),
 primary key (user_id,organization_id)
);
alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.user_workspace_preferences enable row level security;
revoke all on public.profiles,public.user_preferences,public.user_workspace_preferences from public,anon,authenticated;
grant select on public.profiles,public.user_preferences,public.user_workspace_preferences to authenticated;
create policy profile_read on public.profiles for select to authenticated
 using (private.can_read_profile(user_id));
create policy preference_read on public.user_preferences for select to authenticated using (user_id = auth.uid());
create policy workspace_preference_read on public.user_workspace_preferences for select to authenticated using (user_id = auth.uid());
-- Writes are available only through typed/versioned commands, never generic DML.
create policy profile_self_write on public.profiles for update to authenticated
 using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy preference_self_write on public.user_preferences for update to authenticated
 using (user_id = auth.uid()) with check (user_id = auth.uid());

create function private.initialize_account_settings() returns trigger
language plpgsql security definer set search_path = '' as $$
declare proposed text := btrim(new.raw_user_meta_data->>'name');
begin
 if proposed is null or char_length(proposed) not between 1 and 100 or proposed ~ '[[:cntrl:]]' then
  proposed := 'Pessoa da equipe';
 end if;
 insert into public.profiles(user_id,display_name) values (new.id,proposed) on conflict do nothing;
 insert into public.user_preferences(user_id) values (new.id) on conflict do nothing;
 return new;
end;
$$;
revoke all on function private.initialize_account_settings() from public,anon,authenticated;
create trigger initialize_account_settings after insert on auth.users
 for each row execute function private.initialize_account_settings();
insert into public.profiles(user_id,display_name)
 select id,case when char_length(btrim(raw_user_meta_data->>'name')) between 1 and 100
  and btrim(raw_user_meta_data->>'name') !~ '[[:cntrl:]]' then btrim(raw_user_meta_data->>'name')
  else 'Pessoa da equipe' end from auth.users on conflict do nothing;
insert into public.user_preferences(user_id) select id from auth.users on conflict do nothing;

create function public.account_profile_update(p_name text,p_version integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare result public.profiles;
begin
 if auth.uid() is null then raise exception '401:Sessão ausente.'; end if;
 perform private.check_account_settings_write();
 if p_name is null or char_length(btrim(p_name)) not between 1 and 100 or p_name ~ '[[:cntrl:]]' then
  raise exception '422:Informe um nome de 1 a 100 caracteres, sem caracteres de controle.';
 end if;
 if p_version is null or p_version < 1 or p_version >= 2147483647 then raise exception '422:Versão inválida.'; end if;
 update public.profiles set display_name=btrim(p_name),version=version+1,updated_at=now()
 where user_id=auth.uid() and version=p_version returning * into result;
 if not found then raise exception '409:Seu perfil foi atualizado. Recarregue e tente novamente.'; end if;
 return to_jsonb(result);
end;
$$;

create function public.account_preferences_update(p_patch jsonb,p_version integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare current_row public.user_preferences; proposed public.user_preferences; item record;
 allowed text[] := array['theme','theme_explicit','text_scale','density','contrast','motion','locale',
  'format_locale','timezone_mode','timezone','home_view','queue_view','notify_assigned','notify_comment','notify_resolved'];
begin
 if auth.uid() is null then raise exception '401:Sessão ausente.'; end if;
 perform private.check_account_settings_write();
 if jsonb_typeof(p_patch) is distinct from 'object' or p_patch='{}'::jsonb then raise exception '422:Informe as preferências que deseja alterar.'; end if;
 if p_version is null or p_version < 1 or p_version >= 2147483647 then raise exception '422:Versão inválida.'; end if;
 for item in select key,value from jsonb_each(p_patch) loop
  if item.key <> all(allowed) then raise exception '422:Campo de preferência desconhecido.'; end if;
  if item.key in ('theme_explicit','notify_assigned','notify_comment','notify_resolved') then
   if jsonb_typeof(item.value) <> 'boolean' then raise exception '422:Escolha de preferência inválida.'; end if;
  elsif item.key='text_scale' then
   if item.value not in ('100'::jsonb,'110'::jsonb,'125'::jsonb) then raise exception '422:Escala de texto inválida.'; end if;
  elsif not (item.key='timezone' and item.value='null'::jsonb) and jsonb_typeof(item.value)<>'string' then
   raise exception '422:Escolha de preferência inválida.';
  end if;
 end loop;
 select * into current_row from public.user_preferences where user_id=auth.uid() for update;
 if not found or current_row.version<>p_version then raise exception '409:Suas preferências foram atualizadas. Recarregue e tente novamente.'; end if;
 proposed := jsonb_populate_record(current_row,p_patch);
 -- Choosing a theme marks it explicit even when a caller omits the convenience flag.
 if p_patch ? 'theme' then proposed.theme_explicit := true; end if;
 update public.user_preferences set theme=proposed.theme,theme_explicit=proposed.theme_explicit,
  text_scale=proposed.text_scale,density=proposed.density,contrast=proposed.contrast,motion=proposed.motion,
  locale=proposed.locale,format_locale=proposed.format_locale,timezone_mode=proposed.timezone_mode,
  timezone=proposed.timezone,home_view=proposed.home_view,queue_view=proposed.queue_view,
  notify_assigned=proposed.notify_assigned,notify_comment=proposed.notify_comment,notify_resolved=proposed.notify_resolved,
  updated_at=now(),version=version+1 where user_id=auth.uid() returning * into current_row;
 return to_jsonb(current_row);
exception when check_violation or not_null_violation or invalid_text_representation then
 raise exception '422:Preferências inválidas. Revise os valores e o fuso horário.';
end;
$$;

create function public.account_workspace_preference_update(p_slug text,p_view text,p_queue_view text,p_version integer)
 returns jsonb language plpgsql security definer set search_path = '' as $$
declare org uuid; result public.user_workspace_preferences;
begin
 if auth.uid() is null then raise exception '401:Sessão ausente.'; end if;
 perform private.check_account_settings_write();
 if p_view is null or p_view not in ('overview','queue') or p_queue_view is null or p_queue_view not in ('list','kanban')
  or p_version is null or p_version < 0 or p_version >= 2147483647 then raise exception '422:Visualização inválida.'; end if;
 select id into org from public.organizations where slug=p_slug for update;
 if org is null or private.role_in(org) is null then raise exception '404:Empresa não encontrada.'; end if;
 if p_version=0 then
  insert into public.user_workspace_preferences(user_id,organization_id,last_view,last_queue_view)
   values(auth.uid(),org,p_view,p_queue_view) on conflict do nothing returning * into result;
 else
  update public.user_workspace_preferences set last_view=p_view,last_queue_view=p_queue_view,
   version=version+1,updated_at=now() where user_id=auth.uid() and organization_id=org and version=p_version returning * into result;
 end if;
 if result.user_id is null then raise exception '409:A visualização foi atualizada. Recarregue e tente novamente.'; end if;
 return to_jsonb(result);
end;
$$;
revoke all on function public.account_profile_update(text,integer),public.account_preferences_update(jsonb,integer),
 public.account_workspace_preference_update(text,text,text,integer) from public,anon;
grant execute on function public.account_profile_update(text,integer),public.account_preferences_update(jsonb,integer),
 public.account_workspace_preference_update(text,text,text,integer) to authenticated;
