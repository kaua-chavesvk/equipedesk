-- Private storage is closed until an operator provisions a Vault key and enables it.
create extension if not exists supabase_vault with schema vault;
create table private.avatar_processing_keys (
 key_id text primary key check (key_id ~ '^[a-zA-Z0-9_-]{1,32}$'),
 secret_id uuid not null, enabled boolean not null default true
);
create table private.avatar_intents (
 id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
 path text not null unique, digest text not null check (digest ~ '^[0-9a-f]{64}$'),
 byte_size integer not null check (byte_size between 1 and 262144),
 profile_version integer not null check (profile_version>0),
 expires_at timestamptz not null, created_at timestamptz not null default now(),
 state text not null default 'prepared' check (state in ('prepared','published','retired','cancelled')),
 check (path = user_id::text || '/' || id::text || '.webp')
);
create table private.avatar_cleanup_jobs (
 id uuid primary key default gen_random_uuid(), user_id uuid not null, path text not null unique,
 reason text not null check (reason in ('replaced','removed','account_deleted','expired')),
 state text not null default 'pending' check (state in ('pending','processing','done','failed')),
 attempts integer not null default 0, lease_token uuid, lease_until timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index avatar_cleanup_queue on private.avatar_cleanup_jobs(state,created_at);
revoke all on private.account_feature_flags,private.avatar_processing_keys,private.avatar_intents,private.avatar_cleanup_jobs
 from public,anon,authenticated;

create function public.account_feature_status() returns jsonb
language sql stable security definer set search_path = '' as $$
 select case when auth.uid() is null then '{}'::jsonb
 else (select jsonb_object_agg(name,enabled) from private.account_feature_flags) end;
$$;
create function public.account_feature_set(p_name text,p_enabled boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
 if p_enabled is null then raise exception '422:Estado inválido.'; end if;
 update private.account_feature_flags set enabled=p_enabled,updated_at=now() where name=p_name;
 if not found then raise exception '422:Recurso inválido.'; end if;
end;
$$;
create function public.avatar_processing_key_set(p_key_id text,p_secret_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
 if p_key_id is null or p_key_id !~ '^[a-zA-Z0-9_-]{1,32}$' or not exists (
  select 1 from vault.decrypted_secrets where id=p_secret_id and length(decrypted_secret)>=32
 ) then raise exception '422:Chave de processamento inválida.'; end if;
 insert into private.avatar_processing_keys(key_id,secret_id) values(p_key_id,p_secret_id)
 on conflict(key_id) do update set secret_id=excluded.secret_id,enabled=true;
end;
$$;
revoke all on function public.account_feature_status(),public.account_feature_set(text,boolean),
 public.avatar_processing_key_set(text,uuid) from public,anon,authenticated;
grant execute on function public.account_feature_status() to authenticated;
grant execute on function public.account_feature_set(text,boolean),public.avatar_processing_key_set(text,uuid) to service_role;

create function public.avatar_processing_key_disable(p_key_id text) returns void
language plpgsql security definer set search_path = '' as $$
begin
 update private.avatar_processing_keys set enabled=false where key_id=p_key_id;
 if not found then raise exception '404:Chave de processamento não encontrada.'; end if;
end;
$$;
revoke all on function public.avatar_processing_key_disable(text) from public,anon,authenticated;
grant execute on function public.avatar_processing_key_disable(text) to service_role;

create function public.avatar_prepare_intent(p_id uuid,p_digest text,p_size integer,p_version integer,
 p_expires bigint,p_key_id text,p_signature text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid:=auth.uid(); object_path text; signing_secret text; canonical text; expected text;
begin
 if actor is null then raise exception '401:Sessão ausente.'; end if;
 if not exists(select 1 from private.account_feature_flags where name='avatars' and enabled) then
  raise exception '409:Envio de foto indisponível.';
 end if;
 if p_id is null or p_digest is null or p_digest !~ '^[0-9a-f]{64}$' or p_signature is null or p_signature !~ '^[0-9a-f]{64}$'
  or p_size is null or p_size not between 1 and 262144 or p_version is null or p_version<1 or p_version>=2147483647
  or p_expires is null or p_expires <= extract(epoch from clock_timestamp())
  or p_expires > extract(epoch from clock_timestamp())+60 then raise exception '422:Intenção de foto inválida ou expirada.'; end if;
 object_path:=actor::text || '/' || p_id::text || '.webp';
 select secret.decrypted_secret into signing_secret from private.avatar_processing_keys k
 join vault.decrypted_secrets secret on secret.id=k.secret_id where k.key_id=p_key_id and k.enabled;
 if signing_secret is null then raise exception '503:Processamento de foto indisponível.'; end if;
 canonical:=concat_ws(E'\n','avatar-upload-v1',actor::text,p_id::text,object_path,p_digest,p_size::text,p_version::text,p_expires::text);
 expected:=encode(extensions.hmac(convert_to(canonical,'UTF8'),convert_to(signing_secret,'UTF8'),'sha256'),'hex');
 if p_signature<>expected then raise exception '403:Atestado de processamento inválido.'; end if;
 perform 1 from public.profiles where user_id=actor and version=p_version for update;
 if not found then raise exception '409:Seu perfil foi atualizado. Recarregue e tente novamente.'; end if;
 if (select count(*) from private.avatar_intents where user_id=actor and created_at>now()-interval '1 minute')>=5 then
  raise exception '429:Aguarde antes de enviar outra foto.';
 end if;
 insert into private.avatar_intents(id,user_id,path,digest,byte_size,profile_version,expires_at)
  values(p_id,actor,object_path,p_digest,p_size,p_version,to_timestamp(p_expires));
 return jsonb_build_object('id',p_id,'path',object_path,'expires_at',to_timestamp(p_expires));
exception when unique_violation then raise exception '409:Esta intenção de foto já foi utilizada.';
end;
$$;

-- Storage supplies this transaction-local operation. Missing/unknown operations deny access.
create function private.avatar_storage_operation(p_operations text[]) returns boolean
language sql stable set search_path = '' as $$
 select regexp_replace(coalesce(current_setting('storage.operation',true),''),'^storage\.','')=any(p_operations);
$$;
create function private.avatar_can_insert(p_bucket text,p_path text,p_owner text) returns boolean
language sql stable security definer set search_path = '' as $$
 select p_bucket='profile-avatars' and auth.uid() is not null and p_owner=auth.uid()::text
 and private.avatar_storage_operation(array['object.upload'])
 and exists(select 1 from private.account_feature_flags where name='avatars' and enabled)
 and exists(select 1 from private.avatar_intents i join public.profiles p on p.user_id=i.user_id
  where i.user_id=auth.uid() and i.path=p_path and i.state='prepared' and i.expires_at>now() and p.version=i.profile_version);
$$;
create function private.avatar_can_delete(p_bucket text,p_path text) returns boolean
language sql stable security definer set search_path = '' as $$
 select p_bucket='profile-avatars' and auth.uid() is not null
 and private.avatar_storage_operation(array['object.delete','object.delete_many'])
 and exists(select 1 from private.avatar_intents where user_id=auth.uid() and path=p_path);
$$;
create function private.avatar_can_select(p_bucket text,p_path text) returns boolean
language sql stable security definer set search_path = '' as $$
 select p_bucket='profile-avatars' and auth.uid() is not null and (
  private.avatar_can_delete(p_bucket,p_path)
  or (private.avatar_storage_operation(array['object.get_authenticated','object.get_authenticated_info','object.head_authenticated_info','object.info_authenticated'])
   and exists(select 1 from private.account_feature_flags where name='avatars' and enabled)
   and exists(select 1 from public.profiles p join private.avatar_intents i on i.path=p.avatar_path
    where p.avatar_path=p_path and i.state='published' and private.can_read_profile(p.user_id)))
 );
$$;
revoke all on function private.avatar_storage_operation(text[]),private.avatar_can_insert(text,text,text),
 private.avatar_can_select(text,text),private.avatar_can_delete(text,text) from public,anon;
grant execute on function private.avatar_storage_operation(text[]),private.avatar_can_insert(text,text,text),
 private.avatar_can_select(text,text),private.avatar_can_delete(text,text) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('profile-avatars','profile-avatars',false,262144,array['image/webp']);
create policy avatar_insert on storage.objects for insert to authenticated
 with check(private.avatar_can_insert(bucket_id,name,owner_id));
create policy avatar_select on storage.objects for select to authenticated
 using(private.avatar_can_select(bucket_id,name));
create policy avatar_delete on storage.objects for delete to authenticated
 using(private.avatar_can_delete(bucket_id,name));
-- Restrictive guards survive unrelated permissive policies installed on other buckets.
create policy avatar_insert_guard on storage.objects as restrictive for insert to authenticated
 with check(bucket_id<>'profile-avatars' or private.avatar_can_insert(bucket_id,name,owner_id));
create policy avatar_select_guard on storage.objects as restrictive for select to authenticated
 using(bucket_id<>'profile-avatars' or private.avatar_can_select(bucket_id,name));
create policy avatar_delete_guard on storage.objects as restrictive for delete to authenticated
 using(bucket_id<>'profile-avatars' or private.avatar_can_delete(bucket_id,name));
create policy avatar_update_guard on storage.objects as restrictive for update to authenticated
 using(bucket_id<>'profile-avatars') with check(bucket_id<>'profile-avatars');
create policy avatar_anonymous_guard on storage.objects as restrictive for all to anon
 using(bucket_id<>'profile-avatars') with check(bucket_id<>'profile-avatars');

create function public.avatar_finalize_intent(p_id uuid,p_signature text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid:=auth.uid(); intent private.avatar_intents; profile public.profiles; object_metadata jsonb;
 signing_secret text; expected text; verified boolean:=false; candidate record;
begin
 if actor is null then raise exception '401:Sessão ausente.'; end if;
 if not exists(select 1 from private.account_feature_flags where name='avatars' and enabled) then raise exception '409:Envio de foto indisponível.'; end if;
 -- All profile writes acquire the profile lock before an intent lock.
 select * into profile from public.profiles where user_id=actor for update;
 if not found then raise exception '409:Perfil indisponível. Recarregue e tente novamente.'; end if;
 select * into intent from private.avatar_intents where id=p_id and user_id=actor for update;
 if not found or intent.state<>'prepared' or intent.expires_at<=now() then raise exception '409:Intenção de foto indisponível ou expirada.'; end if;
 if profile.version<>intent.profile_version then raise exception '409:Seu perfil foi atualizado. Recarregue e tente novamente.'; end if;
 if p_signature is null or p_signature !~ '^[0-9a-f]{64}$' then raise exception '403:Atestado de finalização inválido.'; end if;
 -- A second, domain-separated attestation proves the server completed the Storage call.
 for candidate in select s.decrypted_secret from private.avatar_processing_keys k
  join vault.decrypted_secrets s on s.id=k.secret_id where k.enabled loop
  signing_secret:=candidate.decrypted_secret;
  expected:=encode(extensions.hmac(convert_to(concat_ws(E'\n','avatar-finalize-v1',actor::text,intent.id::text,
   intent.path,intent.digest,intent.byte_size::text,intent.profile_version::text),'UTF8'),convert_to(signing_secret,'UTF8'),'sha256'),'hex');
  if p_signature=expected then verified:=true; exit; end if;
 end loop;
 if not verified then raise exception '403:Atestado de finalização inválido.'; end if;
 select metadata into object_metadata from storage.objects
 where bucket_id='profile-avatars' and name=intent.path and owner_id=actor::text;
 if not found or object_metadata->>'mimetype' is distinct from 'image/webp'
  or object_metadata->>'size' is distinct from intent.byte_size::text then raise exception '422:Arquivo de foto não confirmado.'; end if;
 if profile.avatar_path is not null then
  update private.avatar_intents set state='retired' where path=profile.avatar_path;
  insert into private.avatar_cleanup_jobs(user_id,path,reason) values(actor,profile.avatar_path,'replaced') on conflict do nothing;
 end if;
 update private.avatar_intents set state='published' where id=p_id;
 update public.profiles set avatar_path=intent.path,avatar_version=avatar_version+1,
  version=version+1,updated_at=now() where user_id=actor returning * into profile;
 return to_jsonb(profile);
end;
$$;
create function public.avatar_remove(p_version integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid:=auth.uid(); profile public.profiles;
begin
 if actor is null then raise exception '401:Sessão ausente.'; end if;
 select * into profile from public.profiles where user_id=actor for update;
 if p_version is null or p_version<1 or p_version>=2147483647 or not found or profile.version<>p_version then raise exception '409:Seu perfil foi atualizado. Recarregue e tente novamente.'; end if;
 if profile.avatar_path is null then return to_jsonb(profile); end if;
 insert into private.avatar_cleanup_jobs(user_id,path,reason) values(actor,profile.avatar_path,'removed') on conflict do nothing;
 update private.avatar_intents set state='retired' where path=profile.avatar_path;
 update public.profiles set avatar_path=null,avatar_version=avatar_version+1,version=version+1,updated_at=now()
  where user_id=actor returning * into profile;
 return to_jsonb(profile);
end;
$$;
revoke all on function public.avatar_prepare_intent(uuid,text,integer,integer,bigint,text,text),
 public.avatar_finalize_intent(uuid,text),public.avatar_remove(integer) from public,anon;
grant execute on function public.avatar_prepare_intent(uuid,text,integer,integer,bigint,text,text),
 public.avatar_finalize_intent(uuid,text),public.avatar_remove(integer) to authenticated;

create function public.avatar_cancel_intent(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare intent private.avatar_intents;
begin
 if auth.uid() is null then raise exception '401:Sessão ausente.'; end if;
 perform 1 from public.profiles where user_id=auth.uid() for update;
 update private.avatar_intents set state='cancelled' where id=p_id and user_id=auth.uid() and state='prepared'
  returning * into intent;
 if not found then raise exception '404:Intenção de foto não encontrada.'; end if;
 insert into private.avatar_cleanup_jobs(user_id,path,reason) values(intent.user_id,intent.path,'expired') on conflict do nothing;
end;
$$;
revoke all on function public.avatar_cancel_intent(uuid) from public,anon;
grant execute on function public.avatar_cancel_intent(uuid) to authenticated;

create function private.queue_account_avatar_cleanup() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 insert into private.avatar_cleanup_jobs(user_id,path,reason)
  select user_id,path,'account_deleted' from private.avatar_intents where user_id=old.id
  on conflict do nothing;
 return old;
end;
$$;
revoke all on function private.queue_account_avatar_cleanup() from public,anon,authenticated;
create trigger queue_account_avatar_cleanup before delete on auth.users
 for each row execute function private.queue_account_avatar_cleanup();

create function public.avatar_cleanup_claim(p_limit integer default 25) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
 if p_limit is null or p_limit not between 1 and 100 then raise exception '422:Limite inválido.'; end if;
 delete from private.avatar_cleanup_jobs where state='done' and updated_at<now()-interval '30 days';
 delete from private.avatar_intents i where state in ('retired','cancelled') and created_at<now()-interval '30 days'
  and not exists(select 1 from storage.objects where bucket_id='profile-avatars' and name=i.path)
  and not exists(select 1 from private.avatar_cleanup_jobs j where j.path=i.path and j.state<>'done');
 update private.avatar_intents set state='cancelled' where state='prepared' and expires_at<now()-interval '1 hour';
 insert into private.avatar_cleanup_jobs(user_id,path,reason)
  select user_id,path,'expired' from private.avatar_intents where state='cancelled' on conflict do nothing;
 update private.avatar_cleanup_jobs set state='failed',updated_at=now()
  where state='processing' and lease_until<now() and attempts>=8;
 with picked as (
  select id from private.avatar_cleanup_jobs where (state='pending' or (state='processing' and lease_until<now()))
   and attempts<8 order by created_at,id limit p_limit for update skip locked
 ), claimed as (
  update private.avatar_cleanup_jobs j set state='processing',attempts=attempts+1,
   lease_token=gen_random_uuid(),lease_until=now()+interval '5 minutes',updated_at=now()
  from picked where j.id=picked.id returning j.id,j.user_id,j.path,j.lease_token
 ) select coalesce(jsonb_agg(to_jsonb(claimed)),'[]'::jsonb) into result from claimed;
 return result;
end;
$$;
create function public.avatar_cleanup_complete(p_id uuid,p_lease uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare job private.avatar_cleanup_jobs;
begin
 select * into job from private.avatar_cleanup_jobs where id=p_id and state='processing'
  and lease_token=p_lease and lease_until>now() for update;
 if not found then raise exception '409:Concessão de limpeza expirada.'; end if;
 if exists(select 1 from storage.objects where bucket_id='profile-avatars' and name=job.path) then
  raise exception '409:A remoção no Storage ainda não foi confirmada.';
 end if;
 update private.avatar_cleanup_jobs set state='done',lease_token=null,lease_until=null,updated_at=now() where id=p_id;
end;
$$;
revoke all on function public.avatar_cleanup_claim(integer),public.avatar_cleanup_complete(uuid,uuid) from public,anon,authenticated;
grant execute on function public.avatar_cleanup_claim(integer),public.avatar_cleanup_complete(uuid,uuid) to service_role;
