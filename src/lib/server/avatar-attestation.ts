import 'server-only';
import { createHmac } from 'node:crypto';
import { z } from 'zod';
import { avatarIntentSchema, type AvatarIntent } from '@/features/account-settings/contracts';

function identity(userId: string, input: AvatarIntent) {
  const actor = z.uuid().parse(userId).toLowerCase();
  const intent = avatarIntentSchema.parse(input);
  return { actor, intent, path: `${actor}/${intent.id}.webp` };
}

function sign(message: string, secret: string) {
  if (secret.length < 32) throw new Error('Chave de processamento de foto inválida.');
  return createHmac('sha256', secret).update(message, 'utf8').digest('hex');
}

/** Must match avatar_prepare_intent's canonical representation byte for byte. */
export function attestAvatarUpload(
  userId: string,
  input: AvatarIntent,
  secret: string,
  now = Date.now(),
) {
  const { actor, intent, path } = identity(userId, input);
  const seconds = now / 1000;
  if (intent.expires <= seconds || intent.expires > seconds + 60)
    throw new Error('Intenção de foto expirada ou inválida.');
  return sign(
    [
      'avatar-upload-v1',
      actor,
      intent.id,
      path,
      intent.digest,
      intent.bytes,
      intent.version,
      intent.expires,
    ].join('\n'),
    secret,
  );
}

/** Issue only after the server has successfully uploaded the normalized bytes. */
export function attestAvatarFinalization(userId: string, input: AvatarIntent, secret: string) {
  const { actor, intent, path } = identity(userId, input);
  return sign(
    [
      'avatar-finalize-v1',
      actor,
      intent.id,
      path,
      intent.digest,
      intent.bytes,
      intent.version,
    ].join('\n'),
    secret,
  );
}
