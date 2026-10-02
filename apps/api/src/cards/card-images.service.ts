import { BadGatewayException, Injectable } from '@nestjs/common';
import ky from 'ky';
import { LRUCache } from 'lru-cache';
import { decodeReferenceImage, type DecodedImage } from '../common/image-utils.js';

@Injectable()
export class CardImagesService {
  private readonly http = ky.create({
    prefix: 'https://cardmarketapi.com/cards',
    timeout: 15_000,
    retry: 0,
  });
  private readonly images = new LRUCache<number, DecodedImage>({
    max: 100,
    maxSize: 32 * 1024 * 1024,
    ttl: 24 * 60 * 60 * 1000,
    sizeCalculation: image => image.data.length,
    fetchMethod: async id => decodeReferenceImage(await this.http.get(`${id}/image`)),
  });

  // Seuls des identifiants Cardmarket sont acceptés, jamais une URL fournie par le navigateur.
  async charger(id: number) {
    try {
      const image = await this.images.fetch(id);
      if (!image) throw new Error('Image indisponible');
      return { image: `data:${image.mediaType};base64,${image.data.toString('base64')}` };
    } catch {
      throw new BadGatewayException('L’image de la carte est temporairement indisponible.');
    }
  }
}
