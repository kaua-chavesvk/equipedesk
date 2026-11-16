-- Policy-level simulation only: no file bytes are uploaded by this SQL test.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
insert into auth.users(id,email) values
 ('b1000000-0000-4000-8000-000000000001','avatar-owner@example.test'),
 ('b1000000-0000-4000-8000-000000000002','avatar-peer@example.test'),
 ('b1000000-0000-4000-8000-000000000003','avatar-outsider@example.test'),
 ('b1000000-0000-4000-8000-000000000004','avatar-global@example.test');
insert into public.organizations(id,name,slug) values('b2000000-0000-4000-8000-000000000001','Fotos','avatar-test');
insert into public.memberships(organization_id,user_id,role) values
 ('b2000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000001','admin'),
 ('b2000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000002','requester');
insert into public.platform_admins(user_id) values('b1000000-0000-4000-8000-000000000004');
select is((select public from storage.buckets where id='profile-avatars'),false,'Bucket privado');
select is((select file_size_limit::integer from storage.buckets where id='profile-avatars'),262144,'Limite do arquivo normalizado');
select public.avatar_processing_key_set('fixture',vault.create_secret(repeat('sql-test-only-',4)));
create temporary table avatar_fixture as
 select 'b1000000-0000-4000-8000-000000000001'::uuid actor,
 'b3000000-0000-4000-8000-000000000001'::uuid id,repeat('a',64) digest,
 100 bytes,1 version,floor(extract(epoch from now()))::bigint+50 expires,
 'b1000000-0000-4000-8000-000000000001/b3000000-0000-4000-8000-000000000001.webp'::text path;
alter table avatar_fixture add column upload_signature text;
alter table avatar_fixture add column final_signature text;
update avatar_fixture set upload_signature=encode(extensions.hmac(convert_to(concat_ws(E'\n','avatar-upload-v1',actor::text,id::text,path,digest,bytes::text,version::text,expires::text),'UTF8'),convert_to(repeat('sql-test-only-',4),'UTF8'),'sha256'),'hex'),
 final_signature=encode(extensions.hmac(convert_to(concat_ws(E'\n','avatar-finalize-v1',actor::text,id::text,path,digest,bytes::text,version::text),'UTF8'),convert_to(repeat('sql-test-only-',4),'UTF8'),'sha256'),'hex');
grant select on avatar_fixture to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000001',true);
select throws_ok($$select public.avatar_prepare_intent(id,digest,bytes,version,expires,'fixture',upload_signature) from avatar_fixture$$,'P0001','409:Envio de foto indisponível.','Feature fechada por padrão');
select throws_ok($$select * from private.avatar_intents$$,'42501',null,'Cliente não lê caminhos pendentes');
select throws_ok($$select public.avatar_cleanup_claim(25)$$,'42501',null,'Cliente não executa limpeza administrativa');
reset role;
select public.account_feature_set('avatars',true);
set local role authenticated;
select throws_ok($$select public.avatar_prepare_intent(id,digest,bytes,version,expires,'fixture',repeat('0',64)) from avatar_fixture$$,'P0001','403:Atestado de processamento inválido.','Atestado forjado é negado');
select lives_ok($$select public.avatar_prepare_intent(id,digest,bytes,version,expires,'fixture',upload_signature) from avatar_fixture$$,'Servidor pode registrar intenção atestada na sessão do titular');
select throws_ok($$select public.avatar_prepare_intent(id,digest,bytes,version,expires,'fixture',upload_signature) from avatar_fixture$$,'P0001','409:Esta intenção de foto já foi utilizada.','Intenção não é reutilizada');
select set_config('storage.operation','storage.object.upload',true);
select throws_ok($$insert into storage.objects(bucket_id,name,owner_id,metadata) values('profile-avatars','b1000000-0000-4000-8000-000000000001/forjado.webp',auth.uid()::text,'{"mimetype":"image/webp","size":100}')$$,'42501',null,'Diretório próprio não permite arquivo sem intenção');
select lives_ok($$insert into storage.objects(bucket_id,name,owner_id,metadata) select 'profile-avatars',path,actor::text,'{"mimetype":"image/webp","size":100}'::jsonb from avatar_fixture$$,'INSERT permitido somente para caminho atestado');
select set_config('storage.operation','storage.object.get_authenticated',true);
select is((select count(*)::integer from storage.objects where bucket_id='profile-avatars'),0,'Candidato não publicado é invisível');
select throws_ok($$select public.avatar_finalize_intent(id,repeat('0',64)) from avatar_fixture$$,'P0001','403:Atestado de finalização inválido.','Só possuir intenção não permite publicar');
select lives_ok($$select public.avatar_finalize_intent(id,final_signature) from avatar_fixture$$,'Finalização com prova do servidor');
select is((select avatar_version from public.profiles where user_id=auth.uid()),1,'Versão da foto incrementada');
select is((select count(*)::integer from storage.objects where bucket_id='profile-avatars'),1,'Titular lê foto publicada');
select set_config('storage.operation','storage.object.sign',true);
select is((select count(*)::integer from storage.objects where bucket_id='profile-avatars'),0,'Não autoriza assinatura nativa longa');
select set_config('storage.operation','storage.object.list',true);
select is((select count(*)::integer from storage.objects where bucket_id='profile-avatars'),0,'Não permite listagem do bucket');
select set_config('storage.operation','',true);
select is((select count(*)::integer from storage.objects where bucket_id='profile-avatars'),0,'Operação ausente é recusada');
select set_config('storage.operation','storage.object.upload_update',true);
select is((with changed as (update storage.objects set metadata='{}' where bucket_id='profile-avatars' returning id) select count(*)::integer from changed),0,'Arquivo não é sobrescrito');
select set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000002',true);
select set_config('storage.operation','storage.object.get_authenticated',true);
select is((select count(*)::integer from storage.objects where bucket_id='profile-avatars'),1,'Colega real lê foto atual');
select set_config('storage.operation','storage.object.delete',true);
select is(private.avatar_can_delete('profile-avatars',(select path from avatar_fixture)),false,'Colega não remove foto alheia');
select set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000003',true);
select set_config('storage.operation','storage.object.get_authenticated',true);
select is((select count(*)::integer from storage.objects where bucket_id='profile-avatars'),0,'Outra empresa não lê foto');
select set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000004',true);
select is((select count(*)::integer from storage.objects where bucket_id='profile-avatars'),0,'Admin global sem vínculo não recebe foto');
reset role;
delete from public.memberships where user_id='b1000000-0000-4000-8000-000000000002';
set local role authenticated;
select set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000002',true);
select is((select count(*)::integer from storage.objects where bucket_id='profile-avatars'),0,'Revogação do vínculo retira leitura');
select set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000001',true);
select lives_ok($$select public.avatar_remove(2)$$,'Titular remove vínculo da foto');
select is((select avatar_path from public.profiles where user_id=auth.uid()),null::text,'Foto deixa de ser publicada imediatamente');
select is((select count(*)::integer from storage.objects where bucket_id='profile-avatars'),0,'Objeto retirado não é baixado');
select lives_ok($$select public.avatar_remove(3)$$,'Remoção repetida não recria foto');
select set_config('storage.operation','storage.object.delete_many',true);
select is((select count(*)::integer from storage.objects where bucket_id='profile-avatars'),1,'SELECT para remoção do próprio arquivo retirado é permitido');
reset role;
create temporary table cleanup_fixture as select (j->>'id')::uuid id,(j->>'lease_token')::uuid lease
 from jsonb_array_elements(public.avatar_cleanup_claim(25)) j;
select throws_ok($$select public.avatar_cleanup_complete(id,lease) from cleanup_fixture$$,'P0001','409:A remoção no Storage ainda não foi confirmada.','Não confirma limpeza enquanto objeto existe');
set local role authenticated;
select set_config('storage.allow_delete_query','true',true);
select lives_ok($$delete from storage.objects where bucket_id='profile-avatars'$$,'Simula exclusão da metadata na operação de Storage');
select set_config('storage.operation','storage.object.upload',true);
select throws_ok($$insert into storage.objects(bucket_id,name,owner_id,metadata) select 'profile-avatars',path,actor::text,'{"mimetype":"image/webp","size":100}'::jsonb from avatar_fixture$$,'42501',null,'Intenção consumida não reinsere arquivo removido');
reset role;
select lives_ok($$select public.avatar_cleanup_complete(id,lease) from cleanup_fixture$$,'Lease atual confirma objeto removido');
select is((select count(*)::integer from private.avatar_cleanup_jobs where state='done'),1,'Limpeza contabilizada');
select public.avatar_processing_key_disable('fixture');
select is((select enabled from private.avatar_processing_keys where key_id='fixture'),false,'Chave pode ser revogada sem deploy');
select * from finish();
rollback;
