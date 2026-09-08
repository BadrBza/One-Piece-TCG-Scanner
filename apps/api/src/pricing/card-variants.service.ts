import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { generateText, Output } from 'ai';

import { VARIANT_METADATA_PROMPT } from '../prompts/variant-metadata.prompt.js';
import { withGeminiModel } from '../recognition/gemini-model.js';
import type { CardRecognition } from '../schemas/card-recognition.schema.js';
import { OptcgCardsSchema, VariantMetadataSchema, type VariantMetadata } from '../schemas/card-variants.schema.js';
import type { PriceResult } from './price-provider.interface.js';

type Product = NonNullable<PriceResult['products']>[number];
type VariantProduct = Product & { version: number; imageUrl: string };

type CardInfo = { rarity: string; setName: string };
type CacheEntry<T> = { expires: number; value: T };

const ONE_DAY = 24 * 60 * 60 * 1000;
const FAST_GEMINI_MODEL = 'gemini-3.5-flash-lite';

@Injectable()
export class CardVariantsService {
  private readonly metadataCache = new Map<string, CacheEntry<VariantMetadata>>();
  private readonly cardInfoCache = new Map<string, CacheEntry<CardInfo>>();

  constructor(private readonly config: ConfigService) {}

  async variants(card: CardRecognition, guide: PriceResult): Promise<PriceResult> {
    const variants = this.addVariantDetails(guide.products ?? []);
    if (!variants.length) return guide;

    const [cardInfo, metadata] = await Promise.all([
      this.getCardInfo(card.cardNumber),
      this.getMetadata(variants),
    ]);

    const products = variants.map(product => {
      const description = metadata.find(item => item.id === String(product.id));
      return {
        ...product,
        expansion: cardInfo?.setName,
        languageLabel: description?.language ?? 'À identifier sur l’image',
        rarity: cardInfo?.rarity ?? card.rarity ?? 'Non déterminée',
        variantLabel: description?.variant ?? 'Non déterminée',
        metadataEstimated: Boolean(description),
      };
    });

    return {
      ...guide,
      products,
      message: 'Compare ta carte avec les images. La langue, la rareté et le type d’illustration sont estimés à partir de chaque image de référence.',
    };
  }

  private addVariantDetails(products: Product[]): VariantProduct[] {
    return products.map((product, index) => ({
      ...product,
      version: index + 1,
      imageUrl: `https://cardmarketapi.com/cards/${product.id}/image`,
    }));
  }

  private async getMetadata(products: VariantProduct[]): Promise<VariantMetadata> {
    const key = products.map(product => product.id).join(',');
    const cached = this.metadataCache.get(key);
    if (cached && cached.expires > Date.now()) return cached.value;

    try {
      const downloads = await Promise.allSettled(products.map(async product => ({
        product,
        ...await this.reference(product),
      })));
      const references = downloads.flatMap(result => result.status === 'fulfilled' ? [result.value] : []);
      if (!references.length) return [];

      const response = await withGeminiModel(
        this.config,
        model => generateText({
          model,
          system: VARIANT_METADATA_PROMPT,
          messages: [{
            role: 'user',
            content: references.flatMap(({ product, data, mediaType }) => [
              { type: 'text' as const, text: `Reference ID: ${product.id}` },
              { type: 'file' as const, data, mediaType },
            ]),
          }],
          output: Output.object({ schema: VariantMetadataSchema }),
          maxOutputTokens: 2048,
          maxRetries: 0,
          abortSignal: AbortSignal.timeout(30000),
        }),
        this.config.get<string>('GEMINI_VARIANT_MODEL')?.trim() || FAST_GEMINI_MODEL,
      );

      this.metadataCache.set(key, { expires: Date.now() + ONE_DAY, value: response.output.items });
      return response.output.items;
    } catch {
      return [];
    }
  }

  private async getCardInfo(cardNumber: string): Promise<CardInfo | undefined> {
    const cached = this.cardInfoCache.get(cardNumber);
    if (cached && cached.expires > Date.now()) return cached.value;

    try {
      const response = await fetch(`https://optcgapi.com/api/sets/card/${encodeURIComponent(cardNumber)}/`, {
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) return undefined;

      const card = OptcgCardsSchema.parse(await response.json())[0];
      if (!card) return undefined;

      const value = { rarity: card.rarity, setName: card.set_name };
      this.cardInfoCache.set(cardNumber, { expires: Date.now() + ONE_DAY, value });
      return value;
    } catch {
      return undefined;
    }
  }

  private async reference(product: VariantProduct) {
    const response = await fetch(product.imageUrl, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error('Reference unavailable');

    const mediaType = response.headers.get('content-type')?.split(';')[0];
    if (!mediaType?.startsWith('image/')) throw new Error('Invalid reference');

    const data = Buffer.from(await response.arrayBuffer());
    if (data.length > 3 * 1024 * 1024) throw new Error('Reference too large');
    return { data, mediaType };
  }
}
