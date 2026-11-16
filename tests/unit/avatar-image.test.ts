import { expect, it, vi } from 'vitest';
import sharp from 'sharp';
vi.mock('server-only', () => ({}));
import { normalizeAvatar } from '../../src/lib/server/avatar-image';

it('produz uma foto WebP quadrada a partir de JPEG com EXIF e dados de GPS', async () => {
  const original = await sharp({
    create: { width: 400, height: 300, channels: 3, background: '#002fa7' },
  }).withExif({ IFD0: { Artist: 'Fixture' }, IFD3: { GPSLatitudeRef: 'S', GPSLongitudeRef: 'W' } }).jpeg().toBuffer();
  expect((await sharp(original).metadata()).exif).toBeDefined();
  const result = await normalizeAvatar(original, { x: .5, y: .5, zoom: 1 });
  const metadata = await sharp(result).metadata();
  expect(metadata).toMatchObject({ format: 'webp', width: 256, height: 256 });
  expect(metadata.exif).toBeUndefined();
  expect(metadata.xmp).toBeUndefined();
  expect(metadata.iptc).toBeUndefined();
});

it('recusa SVG, arquivos inválidos e fonte acima do limite', async () => {
  for (const value of [
    Buffer.from('<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg"/>'),
    Buffer.from('não é uma imagem'), Buffer.alloc(2_097_153),
  ]) {
    await expect(normalizeAvatar(value, { x: .5, y: .5, zoom: 1 })).rejects.toThrow();
  }
});
