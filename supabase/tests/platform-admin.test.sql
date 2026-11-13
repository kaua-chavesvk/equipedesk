begin;
create extension if not exists pgtap with schema extensions;
select plan(9);
insert into auth.users(id,email,email_confirmed_at) values
 ('90000000-0000-4000-8000-000000000001','global@test.local',now()),
 ('90000000-0000-4000-8000-000000000002','ordinary@test.local',now());
insert into public.organizations(id,name,slug) values
 ('91000000-0000-4000-8000-000000000001','Global A','global-a'),
 ('91000000-0000-4000-8000-000000000002','Global B','global-b');
insert into public.platform_admins(user_id) values ('90000000-0000-4000-8000-000000000001');
insert into public.tickets(id,organization_id,requester_id,title,description) values
 ('92000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000002','90000000-0000-4000-8000-000000000002','Chamado externo','Descrição suficiente para teste');
insert into public.comments(organization_id,ticket_id,author_id,body) values
 ('91000000-0000-4000-8000-000000000002','92000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000002','Conversa externa');
set local role authenticated;
select set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000002',true);
select is((select count(*)::integer from public.organizations),0,'Usuário comum não recebe acesso global');
select throws_ok($$insert into public.platform_admins(user_id) values(auth.uid())$$,'42501',null,'Usuário não pode promover a própria conta');
select set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000001',true);
select lives_ok($$select public.desk_command('global-a','create_ticket','{"title":"Chamado global","description":"Criado sem associação local"}')$$,'Administrador geral executa comandos sem membership');
select is((select count(*)::integer from public.organizations),2,'Administrador geral vê todas as empresas');
select is((select count(*)::integer from public.tickets),2,'Administrador geral vê chamados de empresas distintas');
select is((select count(*)::integer from public.comments),1,'Administrador geral lê conversas sem membership');
select is((select count(*)::integer from public.ticket_events),1,'Administrador geral lê eventos sem membership');
reset role;
delete from public.platform_admins where user_id='90000000-0000-4000-8000-000000000001';
set local role authenticated;
select is((select count(*)::integer from public.organizations),0,'Revogação remove leitura global imediatamente');
select throws_ok($$select public.desk_command('global-a','create_ticket','{"title":"Após revogação","description":"Este comando deve falhar"}')$$,'P0001','404:Empresa não encontrada.','Revogação remove comandos globais');
select * from finish();
rollback;
