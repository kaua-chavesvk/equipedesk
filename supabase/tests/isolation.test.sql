begin;
create extension if not exists pgtap with schema extensions;
select plan(27);
insert into auth.users(id,email,email_confirmed_at) values
 ('10000000-0000-0000-0000-000000000001','admin@test.local',now()),
 ('10000000-0000-0000-0000-000000000002','requester@test.local',now()),
 ('10000000-0000-0000-0000-000000000003','other@test.local',now()),
 ('10000000-0000-0000-0000-000000000004','invite@test.local',now());
insert into public.organizations(id,name,slug) values
 ('20000000-0000-0000-0000-000000000001','Empresa A','empresa-a'),
 ('20000000-0000-0000-0000-000000000002','Empresa B','empresa-b');
insert into public.memberships(organization_id,user_id,role) values
 ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','admin'),
 ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','requester'),
 ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000003','requester'),
 ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000003','admin');
insert into public.tickets(id,organization_id,requester_id,title,description) values
 ('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','Chamado privado A','Descrição suficiente para teste'),
 ('30000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000003','Outro solicitante','Descrição suficiente para teste'),
 ('30000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000003','Chamado empresa B','Descrição suficiente para teste');
insert into public.invitations(organization_id,email,role,token_hash,expires_at,created_by,accepted_at) values
 ('20000000-0000-0000-0000-000000000001','invite@test.local','agent',encode(extensions.digest('expired','sha256'),'hex'),now()-interval '1 hour','10000000-0000-0000-0000-000000000001',null),
 ('20000000-0000-0000-0000-000000000001','invite@test.local','agent',encode(extensions.digest('used','sha256'),'hex'),now()+interval '1 day','10000000-0000-0000-0000-000000000001',now()),
 ('20000000-0000-0000-0000-000000000001','invite@test.local','agent',encode(extensions.digest('valid','sha256'),'hex'),now()+interval '1 day','10000000-0000-0000-0000-000000000001',null);
select throws_ok($$insert into public.comments(organization_id,ticket_id,author_id,body) values ('20000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Tentativa')$$,'23503',null,'Chave composta impede conversa em empresa incorreta');
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
select is((select count(*)::integer from public.organizations),1,'Empresa externa invisível');
select is((select count(*)::integer from public.tickets),1,'Solicitante vê apenas seus chamados');
select is((select count(*)::integer from public.tickets where title ilike '%empresa B%'),0,'Busca respeita RLS');
select throws_ok($$select public.desk_command('empresa-b','create_ticket','{"title":"Tentativa","description":"Descrição de invasão"}')$$,'P0001','404:Empresa não encontrada.','Comando em empresa externa recusado');
select throws_ok($$select public.desk_command('empresa-a','comment','{"id":"30000000-0000-0000-0000-000000000002","body":"Ataque"}')$$,'P0001','404:Chamado não encontrado.','Comentário em chamado invisível recusado');
select throws_ok($$select public.desk_command('empresa-a','transition','{"id":"30000000-0000-0000-0000-000000000001","action":"assign","version":1}')$$,'P0001','403:Apenas atendentes podem executar esta ação.','Solicitante não assume');
select throws_ok($$update public.tickets set requester_id=auth.uid()$$,'42501',null,'Escrita direta bloqueada');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
select is((select count(*)::integer from public.tickets),2,'Admin vê toda a fila da empresa');
select throws_ok($$select public.desk_command('empresa-a','remove_member','{"id":"10000000-0000-0000-0000-000000000001"}')$$,'P0001','409:A empresa precisa de pelo menos um administrador.','Último admin não pode ser removido');
select throws_ok($$select public.desk_command('empresa-a','update_member','{"id":"10000000-0000-0000-0000-000000000001","role":"requester"}')$$,'P0001','409:A empresa precisa de pelo menos um administrador.','Último admin não pode ser rebaixado');
select lives_ok($$select public.desk_command('empresa-a','transition','{"id":"30000000-0000-0000-0000-000000000001","action":"assign","version":1}')$$,'Admin assume chamado');
select throws_ok($$select public.desk_command('empresa-a','transition','{"id":"30000000-0000-0000-0000-000000000001","action":"assign","version":1}')$$,'P0001','409:O chamado foi atualizado. Recarregue a página.','Versão antiga perde disputa');
select is((select count(*)::integer from public.ticket_events),1,'Conflito não grava histórico');
select lives_ok($$select public.desk_command('empresa-a','transition','{"id":"30000000-0000-0000-0000-000000000001","action":"resolve","version":2}')$$,'Resolve chamado assumido');
select throws_ok($$select public.desk_command('empresa-a','transition','{"id":"30000000-0000-0000-0000-000000000001","action":"reopen","version":3}')$$,'P0001','422:Informe o motivo da reabertura (3 a 1000 caracteres).','Reabertura exige motivo');
select lives_ok($$select public.desk_command('empresa-a','transition','{"id":"30000000-0000-0000-0000-000000000001","action":"reopen","version":3,"reason":"Problema persiste"}')$$,'Reabre com motivo');
select is((select version from public.tickets where id='30000000-0000-0000-0000-000000000001'),4,'Versão avança atomicamente');
select throws_ok($$select public.desk_command('','accept_invite','{"token":"expired"}')$$,'P0001','409:Convite expirado ou já utilizado.','Convite expirado recusado');
select throws_ok($$select public.desk_command('','accept_invite','{"token":"used"}')$$,'P0001','409:Convite expirado ou já utilizado.','Convite reutilizado recusado');
select throws_ok($$select public.desk_command('','accept_invite','{"token":"valid"}')$$,'P0001','403:Confirme o e-mail correspondente ao convite.','Convite vinculado ao e-mail verificado');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000004',true);
select is(public.invite_preview(repeat('x',64))->>'status','invalid','Link desconhecido não revela dados');
reset role;
update public.invitations set token_hash=encode(extensions.digest(repeat('v',64),'sha256'),'hex')
 where token_hash=encode(extensions.digest('valid','sha256'),'hex');
set local role authenticated;
select is(public.invite_preview(repeat('v',64))->>'role','agent','Convidado vê o papel antes de aceitar');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
select is(public.invite_preview(repeat('v',64))->>'status','invalid','Outro e-mail não vê detalhes do convite');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000004',true);
select lives_ok($$select public.desk_command('','accept_invite','{"token":"vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv"}')$$,'Aceite cria vínculo');
select is((select role::text from public.memberships where user_id=auth.uid()),'agent','Aceite preserva papel autorizado');
select is(public.invite_preview(repeat('v',64))->>'status','used','Convite aceito muda para usado');
select * from finish();
rollback;
