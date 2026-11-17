import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';

assert.equal(process.env.CI, 'true', 'Execute o ensaio no CI descartável.');
assert.equal(process.env.CONFIRM_SYNTHETIC_RESTORE, 'yes', 'Confirme o uso de dados sintéticos.');

const container = 'supabase_db_equipedesk';
const suffix = randomUUID().replaceAll('-', '');
const database = 'equipedesk_restore_' + suffix;
const archive = '/tmp/equipedesk-restore-' + suffix + '.dump';
const hbaBackup = '/tmp/equipedesk-hba-' + suffix;
let created = false;
let socketAuthEnabled = false;

function docker(args, input) {
  return execFileSync('docker', args, {
    input, encoding: 'utf8', timeout: 120_000, maxBuffer: 1024 * 1024,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

function sql(target, statement) {
  return docker(['exec', '-i', container, 'psql', '-X', '-U', 'supabase_admin', '-d', target,
    '-v', 'ON_ERROR_STOP=1', '-At'], statement).trim();
}

const tables = ['auth.users', 'public.organizations', 'public.memberships', 'public.tickets',
  'public.comments', 'public.ticket_events', 'public.profiles', 'public.user_preferences'];
const fingerprint = tables.map(table =>
  `select '${table}', count(*), md5(coalesce(string_agg(row_to_json(item)::text, E'\n' order by row_to_json(item)::text), '')) from ${table} item;`,
).join('\n');

try {
  // The built-in roles own objects across several schemas. Restore using the
  // local system role and limit its temporary login to the container socket.
  const hba = docker(['exec', container, 'psql', '-X', '-U', 'postgres', '-d', 'postgres',
    '-Atc', 'show hba_file']).trim();
  assert.match(hba, /^\/[\w/.-]+$/);
  docker(['exec', '-u', 'postgres', container, 'cp', '-p', '--', hba, hbaBackup]);
  socketAuthEnabled = true;
  try {
    docker(['exec', '-u', 'postgres', container, 'sh', '-ec',
      'printf "%s\\n" "local all supabase_admin trust" | cat - "$2" > "$1"; pg_ctl -D "$PGDATA" reload',
      'restore-test', hba, hbaBackup]);
  const source = sql('postgres', fingerprint);
  assert.equal(sql('postgres', 'select count(*) >= 4 from auth.users;'), 't', 'Prepare o seed local.');
  docker(['exec', container, 'pg_dump', '-U', 'supabase_admin', '-d', 'postgres', '-Fc', '-f', archive]);
  docker(['exec', container, 'createdb', '-U', 'supabase_admin', '--template=template0', database]);
  created = true;
  docker(['exec', container, 'pg_restore', '-U', 'supabase_admin', '-d', database,
    '--exit-on-error', '--single-transaction', archive]);
  assert.equal(sql(database, fingerprint), source, 'Dados restaurados divergem da origem.');

  sql(database, `
    begin;
    do $$
    begin
      if not exists(select 1 from pg_class where oid='public.tickets'::regclass and relrowsecurity) then
        raise exception 'RLS ausente no banco restaurado';
      end if;
      if not exists(select 1 from public.tickets) then
        raise exception 'O ensaio exige chamados sintéticos';
      end if;
    end $$;
    select set_config('request.jwt.claim.sub',
      (select id::text from auth.users where email='lucas@aurora.example'), true);
    set local role authenticated;
    do $$
    begin
      if auth.uid() is null then raise exception 'Sessão de teste ausente'; end if;
      if (select count(*) from public.organizations) <> 1 then
        raise exception 'Isolamento de empresa falhou após restauração';
      end if;
      if exists(select 1 from public.organizations where slug <> 'aurora') then
        raise exception 'Empresa externa visível após restauração';
      end if;
      if exists(select 1 from public.tickets where requester_id <> auth.uid()) then
        raise exception 'Chamado externo visível após restauração';
      end if;
      begin
        update public.tickets set title='Escrita direta indevida';
        raise exception 'Escrita direta foi permitida';
      exception when insufficient_privilege then null;
      end;
    end $$;
    rollback;
  `);
    console.log('Backup restaurado em banco descartável. Dados, RLS e bloqueio de escrita direta conferidos.');
  } finally {
    try {
      if (created) docker(['exec', container, 'dropdb', '-U', 'supabase_admin', '--force', database]);
    } finally {
      docker(['exec', '-u', 'postgres', container, 'sh', '-ec',
        'cp -p -- "$2" "$1"; pg_ctl -D "$PGDATA" reload; rm -f -- "$2"',
        'restore-test', hba, hbaBackup]);
    }
  }
} finally {
  if (socketAuthEnabled) docker(['exec', container, 'rm', '-f', '--', archive]);
}
