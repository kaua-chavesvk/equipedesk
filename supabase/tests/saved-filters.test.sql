begin;
create extension if not exists pgtap with schema extensions;
select plan(14);
insert into auth.users(id,email,email_confirmed_at) values
 ('e1000000-0000-4000-8000-000000000001','one@filters.test',now()),
 ('e1000000-0000-4000-8000-000000000002','two@filters.test',now());
insert into public.organizations(id,name,slug) values
 ('e2000000-0000-4000-8000-000000000001','Filters','filters-test'),
 ('e2000000-0000-4000-8000-000000000002','External filters','filters-external');
insert into public.memberships(organization_id,user_id,role) values
 ('e2000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000001','admin'),
 ('e2000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000002','requester');
select set_config('test.filters', '[{"id":"e3000000-0000-4000-8000-000000000001","name":"My urgent","q":"","status":"all","priority":"urgent","assignee":"me","view":"kanban"}]',true);
set local role authenticated;
select set_config('request.jwt.claim.sub','e1000000-0000-4000-8000-000000000001',true);
select lives_ok($$select public.ticket_filters_update('filters-test',current_setting('test.filters')::jsonb,0)$$,'Salva filtro pessoal');
select is((select version from public.user_ticket_filters),1,'Incrementa versão');
select throws_ok($$select public.ticket_filters_update('filters-test','[]',0)$$,'P0001','409: Os filtros mudaram em outra sessão. Recarregue antes de salvar.','Recusa versão antiga');
select throws_ok($$select public.ticket_filters_update('filters-test',(current_setting('test.filters')::jsonb || current_setting('test.filters')::jsonb),1)$$,'P0001','422: Use nomes diferentes para os filtros salvos.','Recusa IDs duplicados');
select throws_ok($$select public.ticket_filters_update('filters-test','[null]',1)$$,'P0001','422: Filtros inválidos.','Recusa item nulo');
select throws_ok($$select public.ticket_filters_update('filters-test',jsonb_set(current_setting('test.filters')::jsonb,'{0,assignee}','"other"'),1)$$,'P0001','422: Filtros inválidos.','Recusa responsável arbitrário');
select throws_ok($$select public.ticket_filters_update('filters-test',jsonb_set(current_setting('test.filters')::jsonb,'{0,user_id}','"other"'),1)$$,'P0001','422: Filtros inválidos.','Recusa campo de dono');
select throws_ok($$select public.ticket_filters_update('filters-test',(select jsonb_agg(current_setting('test.filters')::jsonb->0) from generate_series(1,11)),1)$$,'P0001','422: Salve no máximo dez filtros por empresa.','Limita dez');
select throws_ok($$update public.user_ticket_filters set filters='[]'$$,'42501','permission denied for table user_ticket_filters','Não permite escrita direta');
select set_config('request.jwt.claim.sub','e1000000-0000-4000-8000-000000000002',true);
select is((select count(*)::int from public.user_ticket_filters),0,'Colega não lê atalhos alheios');
select lives_ok($$select public.ticket_filters_update('filters-test',current_setting('test.filters')::jsonb,0)$$,'Solicitante salva filtros próprios');
select throws_ok($$select public.ticket_filters_update('filters-external','[]',0)$$,'P0001','404: Empresa não encontrada.','Empresa externa recusada');
reset role;
delete from public.memberships where user_id='e1000000-0000-4000-8000-000000000002';
set local role authenticated;
select is((select count(*)::int from public.user_ticket_filters),0,'Revogação de participação remove leitura imediatamente');
select throws_ok($$select public.ticket_filters_update('filters-test','[]',1)$$,'P0001','404: Empresa não encontrada.','Revogação remove escrita imediatamente');
select * from finish();
rollback;
