begin;
create extension if not exists pgtap with schema extensions;
select plan(6);
insert into auth.users(id,email) values('95000000-0000-4000-8000-000000000001','retention@test.local');
insert into public.organizations(id,name,slug) values('96000000-0000-4000-8000-000000000001','Retention','retention');
insert into public.tickets(id,organization_id,requester_id,title,description,status,updated_at) values
 ('97000000-0000-4000-8000-000000000001','96000000-0000-4000-8000-000000000001','95000000-0000-4000-8000-000000000001','Vencido resolvido','Descrição suficiente para retenção','resolved',now()-interval '13 months'),
 ('97000000-0000-4000-8000-000000000002','96000000-0000-4000-8000-000000000001','95000000-0000-4000-8000-000000000001','Retenção legal','Descrição suficiente para retenção','resolved',now()-interval '13 months'),
 ('97000000-0000-4000-8000-000000000003','96000000-0000-4000-8000-000000000001','95000000-0000-4000-8000-000000000001','Chamado aberto','Descrição suficiente para retenção','open',now()-interval '13 months');
insert into private.retention_holds(ticket_id,reason,until_at) values('97000000-0000-4000-8000-000000000002','Retenção legal justificada para teste',now()+interval '1 month');
insert into public.comments(organization_id,ticket_id,author_id,body) values('96000000-0000-4000-8000-000000000001','97000000-0000-4000-8000-000000000001','95000000-0000-4000-8000-000000000001','Comentário que acompanha o chamado');
set local role authenticated;
select throws_ok($$select public.run_privacy_retention(100)$$,'42501',null,'Usuário não executa descarte');
reset role;
select is((public.run_privacy_retention(100)->>'tickets')::integer,1,'Descarta apenas chamado resolvido vencido');
select is((select count(*)::integer from public.comments where ticket_id='97000000-0000-4000-8000-000000000001'),0,'Descarta conversa vinculada');
select is((select count(*)::integer from public.tickets where id='97000000-0000-4000-8000-000000000002'),1,'Preserva retenção legal');
select is((select count(*)::integer from public.tickets where id='97000000-0000-4000-8000-000000000003'),1,'Preserva chamado aberto');
select is((select count(*)::integer from private.retention_runs),1,'Registra contagens do descarte');
select * from finish();
rollback;
