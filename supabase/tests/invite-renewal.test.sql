begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users(id, email, email_confirmed_at) values
 ('d1000000-0000-4000-8000-000000000001', 'admin@renewal.test', now()),
 ('d1000000-0000-4000-8000-000000000002', 'agent@renewal.test', now()),
 ('d1000000-0000-4000-8000-000000000003', 'invitee@renewal.test', now());
insert into public.organizations(id, name, slug) values
 ('d2000000-0000-4000-8000-000000000001', 'Renewal workspace', 'invite-renewal');
insert into public.memberships(organization_id, user_id, role) values
 ('d2000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', 'admin'),
 ('d2000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000002', 'agent');
insert into public.invitations(id, organization_id, email, role, token_hash, expires_at, created_by)
 values ('d3000000-0000-4000-8000-000000000001', 'd2000000-0000-4000-8000-000000000001',
  'invitee@renewal.test', 'requester', encode(extensions.digest(repeat('a',64),'sha256'),'hex'),
  now() - interval '1 day', 'd1000000-0000-4000-8000-000000000001');

set local role authenticated;
select set_config('request.jwt.claim.sub','d1000000-0000-4000-8000-000000000002',true);
select throws_ok($$select public.renew_invitation('invite-renewal','d3000000-0000-4000-8000-000000000001')$$,
 'P0001','403:Apenas administradores podem gerenciar a equipe.','Atendente não renova');
select set_config('request.jwt.claim.sub','d1000000-0000-4000-8000-000000000001',true);
select throws_ok($$select public.renew_invitation('outra-empresa','d3000000-0000-4000-8000-000000000001')$$,
 'P0001','404:Empresa não encontrada.','Exige a empresa correta');
select lives_ok($$select set_config('test.replacement',
 public.renew_invitation('invite-renewal','d3000000-0000-4000-8000-000000000001')::text,true)$$,
 'Administrador renova convite expirado');
select ok((select revoked_at is not null from public.invitations where id='d3000000-0000-4000-8000-000000000001'),
 'Convite anterior foi revogado');
select ok((select expires_at > now() and email='invitee@renewal.test' and role='requester' from public.invitations
 where id=(current_setting('test.replacement')::jsonb->>'id')::uuid),'Preserva destinatário e papel e estende a validade');
select throws_ok($$select public.renew_invitation('invite-renewal','d3000000-0000-4000-8000-000000000001')$$,
 'P0001','404:Convite não encontrado.','Repetir a renovação do convite antigo é recusado');
select set_config('request.jwt.claim.sub','d1000000-0000-4000-8000-000000000003',true);
select throws_ok($$select public.desk_command('', 'accept_invite', jsonb_build_object('token', repeat('a',64)))$$,
 'P0001','409:Convite expirado ou já utilizado.','O token anterior não pode ser usado');
select lives_ok($$select public.desk_command('', 'accept_invite', jsonb_build_object(
 'token', current_setting('test.replacement')::jsonb->>'token'))$$,'O destinatário pode aceitar o novo link');

select * from finish();
rollback;
