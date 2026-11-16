import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';

function signature(viewer: string, owner: string, version: number, expiry: number) {
  const key = process.env.AVATAR_URL_SECRET;
  if (!key || key.length < 32) return null;
  return createHmac('sha256', key).update(JSON.stringify([viewer, owner, version, expiry])).digest('hex');
}

export function avatarUrl(viewer: string, owner: string, version: number) {
  const expiry = Math.floor(Date.now() / 1000) + 60;
  const token = signature(viewer, owner, version, expiry);
  return token ? `/api/perfis/${owner}/foto?v=${version}&exp=${expiry}&sig=${token}` : null;
}

export function validAvatarUrl(viewer: string, owner: string, query: URLSearchParams) {
  const version = Number(query.get('v'));
  const expiry = Number(query.get('exp'));
  const token = query.get('sig') ?? '';
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isSafeInteger(version) || version < 1 || !Number.isSafeInteger(expiry)
    || expiry <= now || expiry > now + 60 || !/^[a-f0-9]{64}$/.test(token)) return null;
  const expected = signature(viewer, owner, version, expiry);
  return expected && timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(token, 'hex')) ? version : null;
}
