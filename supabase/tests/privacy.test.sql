begin;
create extension if not exists pgtap with schema extensions;
select plan(12);
insert into auth.users(id,email,email_confirmed_at) values
 ('94000000-0000-4000-8000-000000000001','privacy-one@test.local',now()),
 ('94000000-0000-4000-8000-000000000002','privacy-two@test.local',now());
set local role authenticated;
select set_config('request.jwt.claim.sub','94000000-0000-4000-8000-000000000001',true);
select throws_ok($$select public.privacy_command('accept_terms','{"termsAccepted":false,"adultConfirmed":true,"termsVersion":"2026-11-12","privacyVersion":"2026-11-12"}')$$,'P0001','422:Aceite a versão atual dos termos e confirme ter 18 anos ou mais.','Recusa aceite falso');
select lives_ok($$select public.privacy_command('accept_terms','{"termsAccepted":true,"adultConfirmed":true,"termsVersion":"2026-11-12","privacyVersion":"2026-11-12"}')$$,'Registra aceite autenticado');
select is((select count(*)::integer from public.legal_acceptances where kind='terms'),1,'Aceite persistido uma vez');
select throws_ok($$update public.legal_acceptances set terms_version='fake'$$,'42501',null,'Titular não altera evidência');
select is((select count(*)::integer from public.privacy_preferences where marketing),0,'Marketing não é autorizado pelo aceite dos termos');
select set_config('privacy.test_token',(public.privacy_command('marketing','{"enabled":true}')->>'unsubscribe_token'),true);
select is((select marketing from public.privacy_preferences),true,'Opt-in separado');
select set_config('privacy.request_id',(public.privacy_command('request','{"kind":"delete"}')->>'id'),true);
select is((select status from public.privacy_requests),'submitted','Pedido não finge exclusão concluída');
select throws_ok($$select public.privacy_command('request','{"kind":"delete"}')$$,'P0001','409:Já existe um pedido desse tipo em atendimento.','Evita pedido duplicado');
select set_config('request.jwt.claim.sub','94000000-0000-4000-8000-000000000002',true);
select is((select count(*)::integer from public.privacy_requests),0,'Isolamento entre titulares');
select throws_ok($$select public.privacy_command('answer',jsonb_build_object('id',current_setting('privacy.request_id'),'status','answered','response','Resposta não autorizada'))$$,'P0001','403:Acesso restrito ao administrador geral.','Usuário comum não conclui pedidos');
select public.unsubscribe_marketing(current_setting('privacy.test_token'));
select set_config('request.jwt.claim.sub','94000000-0000-4000-8000-000000000001',true);
select is((select marketing from public.privacy_preferences),false,'Link revoga marketing');
select is((select count(*)::integer from public.legal_acceptances where kind='marketing_opt_out'),1,'Revogação registrada');
select * from finish();
rollback;
