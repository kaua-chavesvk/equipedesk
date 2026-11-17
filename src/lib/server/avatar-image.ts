import 'server-only';
import sharp from 'sharp';
import { HttpError } from '@/lib/http/api';
import { AVATAR_SIDE, AVATAR_SOURCE_LIMIT, AVATAR_STORED_LIMIT, avatarSourceMetadataSchema } from '@/features/account-settings/contracts';

export async function normalizeAvatar(input: Buffer, crop: { zoom: number; x: number; y: number }) {
  if (input.length > AVATAR_SOURCE_LIMIT) throw new HttpError(413, 'A foto deve ter no máximo 2 MiB.');
  try {
    const image = sharp(input, { limitInputPixels: 4096 * 4096, failOn: 'warning' }).timeout({ seconds: 5 });
    const metadata = await image.metadata();
    const { width, height } = avatarSourceMetadataSchema.parse({
      mime: 'image/' + metadata.format, bytes: input.length, width: metadata.autoOrient.width,
      height: metadata.autoOrient.height, pages: metadata.pages ?? 1,
    });
    const side = Math.max(1, Math.floor(Math.min(width, height) / crop.zoom));
    // Resolve orientation before extracting coordinates in the same space as the preview.
    const oriented = await image.autoOrient().raw().toBuffer({ resolveWithObject: true });
    const result = await sharp(oriented.data, { raw: oriented.info }).timeout({ seconds: 5 })
      .extract({ width: side, height: side, left: Math.round((width - side) * crop.x), top: Math.round((height - side) * crop.y) })
      .resize(AVATAR_SIDE, AVATAR_SIDE).toColourspace('srgb').webp({ quality: 82 }).toBuffer();
    if (result.length > AVATAR_STORED_LIMIT) throw new Error('Limite do arquivo normalizado.');
    return result;
  } catch {
    throw new HttpError(422, 'Não foi possível preparar a foto. Use JPEG, PNG ou WebP estático, entre 64 e 4.096 pixels.');
  }
}
