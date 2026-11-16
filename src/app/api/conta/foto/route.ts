import { createHash, randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AVATAR_SOURCE_LIMIT, versionSchema } from '@/features/account-settings/contracts';
import { failure, HttpError } from '@/lib/http/api';
import { observeApi } from '@/lib/http/observe-api';
import { accountFlags, accountRpcError, requireAccount } from '@/lib/server/account-settings';
import { attestAvatarFinalization, attestAvatarUpload } from '@/lib/server/avatar-attestation';
import { normalizeAvatar } from '@/lib/server/avatar-image';

export const runtime = 'nodejs';
const bucket = 'profile-avatars';
const cropSchema = z.object({ zoom: z.number().min(1).max(3), x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).strict();

async function boundedForm(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, 'Envie uma foto.');
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > AVATAR_SOURCE_LIMIT + 65536) {
        await reader.cancel();
        throw new HttpError(413, 'A foto deve ter no máximo 2 MiB.');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return await new Response(Buffer.concat(chunks), { headers: { 'Content-Type': request.headers.get('content-type') ?? '' } }).formData();
  } catch {
    throw new HttpError(400, 'O formulário da foto é inválido.');
  }
}

export const POST = observeApi('/api/conta/foto', async request => {
  try {
    const { db, user } = await requireAccount();
    const flags = await accountFlags();
    if (!flags.settings || !flags.avatars) throw new HttpError(409, 'Envio de foto indisponível.');
    const secret = process.env.AVATAR_PROCESSING_SECRET;
    const keyId = process.env.AVATAR_PROCESSING_KEY_ID;
    if (!secret || secret.length < 32 || !keyId) throw new HttpError(503, 'Processamento de foto indisponível.');
    const form = await boundedForm(request);
    if ([...form.keys()].sort().join(',') !== 'crop,file,version') throw new HttpError(400, 'O formulário da foto é inválido.');
    const file = form.get('file');
    if (!(file instanceof File)) throw new HttpError(422, 'Escolha uma foto.');
    if (file.size > AVATAR_SOURCE_LIMIT) throw new HttpError(413, 'A foto deve ter no máximo 2 MiB.');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new HttpError(415, 'Use JPEG, PNG ou WebP.');
    let rawCrop: unknown;
    try { rawCrop = JSON.parse(String(form.get('crop'))); }
    catch { throw new HttpError(400, 'O recorte da foto é inválido.'); }
    const version = versionSchema.parse(Number(form.get('version')));
    const previous = await db.from('profiles').select('avatar_path,version').eq('user_id', user.id).single();
    if (previous.error) throw new HttpError(503, 'Não foi possível consultar seu perfil.');
    if (previous.data.version !== version) throw new HttpError(409, 'Recarregue o perfil e tente novamente.');
    const bytes = await normalizeAvatar(Buffer.from(await file.arrayBuffer()), cropSchema.parse(rawCrop));
    const id = randomUUID();
    const path = user.id + '/' + id + '.webp';
    const intent = { id, digest: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length,
      version, expires: Math.floor(Date.now() / 1000) + 55, keyId };
    const { error: prepareError } = await db.rpc('avatar_prepare_intent', {
      p_id: id, p_digest: intent.digest, p_size: bytes.length, p_version: version, p_expires: intent.expires,
      p_key_id: keyId, p_signature: attestAvatarUpload(user.id, intent, secret),
    });
    if (prepareError) throw accountRpcError(prepareError);
    const storage = db.storage.from(bucket);
    try {
      const uploaded = await storage.upload(path, bytes, { contentType: 'image/webp', cacheControl: '0', upsert: false });
      if (uploaded.error) throw new HttpError(503, 'Não foi possível armazenar a foto.');
      const { error } = await db.rpc('avatar_finalize_intent', { p_id: id, p_signature: attestAvatarFinalization(user.id, intent, secret) });
      if (error) throw accountRpcError(error);
    } catch (error) {
      // Cancel succeeds only while unpublished. If the finalize response was lost,
      // never remove a photo that the database may already have published.
      const cancelled = await db.rpc('avatar_cancel_intent', { p_id: id });
      if (!cancelled.error) await storage.remove([path]);
      throw error;
    }
    if (previous.data.avatar_path) await storage.remove([previous.data.avatar_path]);
    return NextResponse.json({ saved: true }, { status: 201 });
  } catch (error) { return failure(error); }
});

export const DELETE = observeApi('/api/conta/foto', async request => {
  try {
    const { db, user } = await requireAccount();
    const version = versionSchema.parse(Number(request.headers.get('if-match')?.replace(/^"(\d+)"$/, '$1')));
    const profile = await db.from('profiles').select('avatar_path').eq('user_id', user.id).single();
    if (profile.error) throw new HttpError(503, 'Não foi possível consultar seu perfil.');
    const { error } = await db.rpc('avatar_remove', { p_version: version });
    if (error) throw accountRpcError(error);
    const path = profile.data.avatar_path;
    if (!path) return NextResponse.json({ removed: true, cleanupPending: false });
    const removed = await db.storage.from(bucket).remove([path]);
    const cleanupPending = !!removed.error || !removed.data?.some(object => object.name === path);
    return NextResponse.json({ removed: true, cleanupPending }, { status: cleanupPending ? 202 : 200 });
  } catch (error) { return failure(error); }
});
