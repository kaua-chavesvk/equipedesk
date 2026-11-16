begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
select public.account_feature_set('settings',true);
insert into auth.users(id,email,raw_user_meta_data) values
 ('a1000000-0000-4000-8000-000000000001','settings-owner@example.test','{"name":"  João da Equipe  "}'),
 ('a1000000-0000-4000-8000-000000000002','settings-peer@example.test','{}'),
 ('a1000000-0000-4000-8000-000000000003','settings-other@example.test','{}'),
 ('a1000000-0000-4000-8000-000000000004','settings-global@example.test','{}');
insert into public.organizations(id,name,slug) values
 ('a2000000-0000-4000-8000-000000000001','Config A','config-a'),
 ('a2000000-0000-4000-8000-000000000002','Config B','config-b');
insert into public.memberships(organization_id,user_id,role) values
 ('a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','admin'),
 ('a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000002','requester'),
 ('a2000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000003','admin');
insert into public.platform_admins(user_id) values('a1000000-0000-4000-8000-000000000004');
select is((select display_name from public.profiles where user_id='a1000000-0000-4000-8000-000000000001'),'João da Equipe','Trigger importa nome válido sem alterar identidade');
select is((select display_name from public.profiles where user_id='a1000000-0000-4000-8000-000000000002'),'Pessoa da equipe','Não transforma e-mail em nome público');
set local role authenticated;
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000001',true);
select is((select count(*)::integer from public.profiles),2,'Titular lê perfis de colegas reais');
select is((select count(*)::integer from public.user_preferences),1,'Titular só lê suas preferências');
select is((select theme from public.user_preferences),'system','Tema padrão sistema');
select is((select notify_comment from public.user_preferences),false,'Notificações desligadas');
select throws_ok($$update public.profiles set avatar_path='forjado.webp'$$,'42501',null,'Escrita direta não contorna o comando');
select throws_ok($$insert into public.user_preferences(user_id) values(auth.uid())$$,'42501',null,'Cliente não cria preferências arbitrárias');
select lives_ok($$select public.account_profile_update('Nome atualizado',1)$$,'Titular altera seu nome');
select is((select version from public.profiles where user_id=auth.uid()),2,'Versão é incrementada');
select throws_ok($$select public.account_profile_update('Outro nome',1)$$,'P0001','409:Seu perfil foi atualizado. Recarregue e tente novamente.','Versão antiga não sobrescreve perfil');
select throws_ok($$select public.account_profile_update(E'Nome\nOutro',2)$$,'P0001','422:Informe um nome de 1 a 100 caracteres, sem caracteres de controle.','Nome com controle é recusado');
select lives_ok($$select public.account_preferences_update('{"theme":"dark","locale":"en","text_scale":125}',1)$$,'Titular salva preferências válidas');
select is((select theme_explicit from public.user_preferences),true,'Tema escolhido fica explícito');
select throws_ok($$select public.account_preferences_update('{"theme":"light"}',1)$$,'P0001','409:Suas preferências foram atualizadas. Recarregue e tente novamente.','Conflito de preferências');
select throws_ok($$select public.account_preferences_update('{"user_id":"a1000000-0000-4000-8000-000000000002"}',2)$$,'P0001','422:Campo de preferência desconhecido.','Não aceita outro usuário no payload');
select throws_ok($$select public.account_preferences_update('{"notify_comment":"true"}',2)$$,'P0001','422:Escolha de preferência inválida.','RPC não converte texto em booleano');
select throws_ok($$select public.account_preferences_update('{"text_scale":200}',2)$$,'P0001','422:Escala de texto inválida.','Escala fora da lista é recusada');
select throws_ok($$select public.account_preferences_update('{"locale":"fr"}',2)$$,'P0001','422:Preferências inválidas. Revise os valores e o fuso horário.','Locale inválido é recusado também no SQL');
select throws_ok($$select public.account_preferences_update('{"timezone_mode":"manual","timezone":"Invalid/Zone"}',2)$$,'P0001','422:Preferências inválidas. Revise os valores e o fuso horário.','Fuso desconhecido é recusado');
select lives_ok($$select public.account_preferences_update('{"timezone_mode":"manual","timezone":"America/Sao_Paulo"}',2)$$,'Fuso IANA válido');
select lives_ok($$select public.account_workspace_preference_update('config-a','queue','kanban',0)$$,'Própria visão inicial');
select throws_ok($$select public.account_workspace_preference_update('config-b','queue','list',0)$$,'P0001','404:Empresa não encontrada.','Não salva visão de empresa invisível');
select throws_ok($$select public.account_workspace_preference_update('config-a','https://externo.example','list',1)$$,'P0001','422:Visualização inválida.','Não aceita URL de redirecionamento');
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000002',true);
select is((select count(*)::integer from public.user_workspace_preferences),0,'Colega não lê visão alheia');
select is((select theme from public.user_preferences),'system','Colega não lê tema alheio');
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000004',true);
select is((select count(*)::integer from public.profiles),1,'Admin global sem membership não lê perfis de todos');
select is((select count(*)::integer from public.user_preferences),1,'Admin global não lê preferências de terceiros');
select throws_ok($$select public.account_feature_set('avatars',true)$$,'42501',null,'Admin do produto não habilita recursos de operação');
reset role;
delete from public.memberships where user_id='a1000000-0000-4000-8000-000000000002';
set local role authenticated;
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000002',true);
select is((select count(*)::integer from public.profiles),1,'Remoção de vínculo revoga leitura compartilhada');
select lives_ok($$select public.account_profile_update('Minha conta sem empresa',1)$$,'Próprio perfil funciona sem workspace');
reset role;
delete from auth.users where id='a1000000-0000-4000-8000-000000000002';
select is((select count(*)::integer from public.profiles where user_id='a1000000-0000-4000-8000-000000000002'),0,'Exclusão elimina perfil');
select is((select count(*)::integer from public.user_preferences where user_id='a1000000-0000-4000-8000-000000000002'),0,'Exclusão elimina preferências');
select * from finish();
rollback;
