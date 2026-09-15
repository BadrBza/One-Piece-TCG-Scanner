import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';

export type DecodedImage = { data: Buffer; mediaType: string };

const IMAGE_PATTERN = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/;

/** Returns null when the data URL is missing, malformed, or empty after decode. */
export function parseDataUrl(value: string): DecodedImage | null {
  const match = IMAGE_PATTERN.exec(value);
  if (!match || match[2].length % 4 !== 0) return null;
  const data = Buffer.from(match[2], 'base64');
  if (!data.length) return null;
  return { data, mediaType: match[1] };
}

export function decodeImage(value: string, maxBytes: number, errorMessage: string): DecodedImage {
  const image = parseDataUrl(value);
  if (!image || image.data.length > maxBytes) throw new BadRequestException(errorMessage);
  return image;
}

export async function resizeImage(image: DecodedImage, width: number, height: number): Promise<DecodedImage> {
  return {
    data: await sharp(image.data).rotate().resize({ width, height, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer(),
    mediaType: 'image/jpeg',
  };
}

export function decodePhoto(photo: string) {
  const image = parseDataUrl(photo);
  if (!image) throw new Error('Invalid user photo');
  return image;
}

export async function prepareAvatar(source: string): Promise<string> {
  try {
    const data = Buffer.from(source.split(',')[1], 'base64');
    if (!data.length || data.length > 2 * 1024 * 1024) throw new Error('Invalid image size');
    const image = sharp(data, { limitInputPixels: 25_000_000 });
    const metadata = await image.metadata();
    if (!['jpeg', 'png', 'webp'].includes(metadata.format ?? '') || (metadata.pages ?? 1) > 1) throw new Error('Unsupported image');
    const avatar = await image.rotate().resize(256, 256, { fit: 'cover' }).webp({ quality: 80 }).toBuffer();
    return `data:image/webp;base64,${avatar.toString('base64')}`;
  } catch {
    throw new BadRequestException('Choisis une photo JPG, PNG ou WebP valide de 2 Mo maximum (25 mégapixels maximum).');
  }
}

export async function decodeReferenceImage(response: Response): Promise<DecodedImage> {
  const mediaType = response.headers.get('content-type')?.split(';')[0];
  if (!mediaType || !['image/jpeg', 'image/png', 'image/webp'].includes(mediaType)) throw new Error('Invalid reference');
  const data = Buffer.from(await response.arrayBuffer());
  if (!data.length || data.length > 3 * 1024 * 1024) throw new Error('Reference too large');
  return { data, mediaType };
}
