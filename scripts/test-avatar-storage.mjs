import assert from 'node:assert/strict';
import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
assert.ok(url && key && new URL(url).origin === 'http://127.0.0.1:54321', 'Use a instância Supabase local do projeto.');
const secret = randomBytes(32).toString('hex');
function sql(statement) {
  execFileSync('docker', ['exec', '-i', 'supabase_db_equipedesk', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], {
    input: statement, stdio: ['pipe', 'ignore', 'pipe'],
  });
}
async function login(email) {
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password: process.env.DEMO_PASSWORD ?? 'EquipeDesk-local-2026!' });
  assert.ifError(error);
  return { client, id: data.user.id, bucket: client.storage.from('profile-avatars') };
}

const [owner, peer, outsider] = await Promise.all([
  login('marina@aurora.example'), login('lucas@aurora.example'), login('bia@horizonte.example'),
]);
sql(`select public.avatar_processing_key_set('ci',vault.create_secret('${secret}'));
select public.account_feature_set('avatars',true);`);
const id = randomUUID();
const path = `${owner.id}/${id}.webp`;
try {
  const bytes = await sharp({ create: { width: 256, height: 256, channels: 3, background: '#002fa7' } }).webp().toBuffer();
  const options = { contentType: 'image/webp', upsert: false, cacheControl: '0' };
  assert.ok((await owner.bucket.upload(path, bytes, options)).error, 'Upload direto sem atestado deve falhar');
  const digest = createHash('sha256').update(bytes).digest('hex');
  const expires = Math.floor(Date.now() / 1000) + 55;
  const sign = (purpose, ...suffix) => createHmac('sha256', secret)
    .update([purpose, owner.id, id, path, digest, bytes.length, 1, ...suffix].join('\n')).digest('hex');
  assert.ifError((await owner.client.rpc('avatar_prepare_intent', {
    p_id: id, p_digest: digest, p_size: bytes.length, p_version: 1, p_expires: expires, p_key_id: 'ci',
    p_signature: sign('avatar-upload-v1', expires),
  })).error);
  assert.ok((await outsider.bucket.upload(path, bytes, options)).error, 'Outra conta não pode usar uma intenção alheia');
  assert.ifError((await owner.bucket.upload(path, bytes, options)).error);
  assert.ok((await peer.bucket.download(path)).error, 'Candidato não publicado é privado');
  assert.ifError((await owner.client.rpc('avatar_finalize_intent', { p_id: id, p_signature: sign('avatar-finalize-v1') })).error);
  const download = await peer.bucket.download(path);
  assert.ifError(download.error);
  assert.deepEqual(Buffer.from(await download.data.arrayBuffer()), bytes);
  assert.ok((await outsider.bucket.download(path)).error, 'Foto de outra empresa não pode ser baixada');
  assert.ok((await peer.bucket.createSignedUrl(path, 3600)).error, 'Colega não pode emitir assinatura direta');
  assert.ok((await owner.bucket.createSignedUrl(path, 3600)).error, 'Titular não pode emitir assinatura direta');
  const listed = await peer.bucket.list(owner.id);
  assert.ok(listed.error || listed.data.length === 0, 'Listagem não pode revelar a foto');
  assert.ok((await owner.bucket.update(path, bytes, options)).error, 'Foto publicada não é sobrescrita');
  assert.ifError((await owner.client.rpc('avatar_remove', { p_version: 2 })).error);
  assert.ok((await peer.bucket.download(path)).error, 'Retirada revoga acesso');
  const removed = await owner.bucket.remove([path]);
  assert.ifError(removed.error);
  assert.ok(removed.data.some(item => item.name === path), 'Storage confirmou remoção física pelo titular');
  assert.ok((await owner.bucket.upload(path, bytes, options)).error, 'Intenção consumida não pode recriar a foto');
  console.log('Storage HTTP aprovado com três sessões reais e bucket privado.');
} finally {
  await owner.bucket.remove([path]);
  sql("select public.account_feature_set('avatars',false); select public.avatar_processing_key_disable('ci');");
}
