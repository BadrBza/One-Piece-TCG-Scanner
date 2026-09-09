import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { generateText, Output } from 'ai';

import { VARIANT_METADATA_PROMPT } from '../prompts/variant-metadata.prompt.js';
import { MATCH_CARD_VARIANT_PROMPT } from '../prompts/match-card-variant.prompt.js';
import { withGeminiModel } from '../recognition/gemini-model.js';
import type { CardRecognition } from '../schemas/card-recognition.schema.js';
import { OptcgCardsSchema, VariantMetadataSchema, VariantPhotoAnalysisSchema, type VariantMetadata } from '../schemas/card-variants.schema.js';
import type { PriceResult } from './price-result.js';

type Product = NonNullable<PriceResult['products']>[number];
type VariantProduct = Product & { version: number; imageUrl: string };
type Reference = { product: VariantProduct; data: Buffer; mediaType: string };
type ReferenceImage = Omit<Reference, 'product'>;
type Analysis = { metadata: VariantMetadata; selectedProductId?: number; matchConfidence?: number };

type CardInfo = { rarity: string; setName: string };
type CacheEntry<T> = { expires: number; value: T };

const ONE_DAY = 24 * 60 * 60 * 1000;
const FAST_GEMINI_MODEL = 'gemini-3.5-flash-lite';

@Injectable()
export class CardVariantsService {
  private readonly metadataCache = new Map<string, CacheEntry<VariantMetadata>>();
  private readonly cardInfoCache = new Map<string, CacheEntry<CardInfo>>();
  private readonly referenceCache = new Map<number, CacheEntry<ReferenceImage>>();

  constructor(private readonly config: ConfigService) {}

  async variants(card: CardRecognition, guide: PriceResult, photo?: string): Promise<PriceResult> {
    const variants = this.addVariantDetails(guide.products ?? []);
    if (!variants.length) return guide;

    const [cardInfo, analysis] = await Promise.all([
      this.getCardInfo(card.cardNumber),
      photo ? this.analyzePhoto(photo, variants) : this.getMetadata(variants).then<Analysis>(metadata => ({ metadata })),
    ]);

    const products = variants.map(product => {
      const description = analysis.metadata.find(item => item.id === String(product.id));
      return {
        ...product,
        expansion: cardInfo?.setName,
        languageLabel: description?.language ?? 'À identifier sur l’image',
        rarity: cardInfo?.rarity ?? card.rarity ?? 'Non déterminée',
        variantLabel: description?.variant ?? 'Non déterminée',
      };
    });

    return {
      ...guide,
      products,
      selectedProductId: analysis.selectedProductId,
      matchConfidence: analysis.matchConfidence,
      message: analysis.selectedProductId
        ? 'La variante la plus proche de ta photo a été sélectionnée automatiquement.'
        : 'Compare ta carte avec les images. La langue, la rareté et le type d’illustration sont estimés à partir de chaque image de référence.',
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
      const references = await this.references(products);
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
          reasoning: 'low',
          providerOptions: { google: { mediaResolution: 'MEDIA_RESOLUTION_MEDIUM' } },
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

  private async analyzePhoto(photo: string, products: VariantProduct[]): Promise<Analysis> {
    const key = products.map(product => product.id).join(',');
    try {
      const references = await this.references(products);
      if (!references.length) return { metadata: this.metadataCache.get(key)?.value ?? [] };

      const image = this.decodePhoto(photo);
      const response = await withGeminiModel(this.config, model => generateText({
        model,
        system: MATCH_CARD_VARIANT_PROMPT,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: 'USER PHOTO' },
            { type: 'file', data: image.data, mediaType: image.mediaType },
            ...references.flatMap(({ product, data, mediaType }) => [
              { type: 'text' as const, text: `CARDMARKET REFERENCE ID: ${product.id}` },
              { type: 'file' as const, data, mediaType },
            ]),
          ],
        }],
        output: Output.object({ schema: VariantPhotoAnalysisSchema }),
        reasoning: 'low',
        providerOptions: { google: { mediaResolution: 'MEDIA_RESOLUTION_MEDIUM' } },
        maxOutputTokens: 2048,
        maxRetries: 0,
        abortSignal: AbortSignal.timeout(45000),
      }), this.config.get<string>('GEMINI_VARIANT_MODEL')?.trim() || FAST_GEMINI_MODEL);

      const metadata = response.output.items;
      this.metadataCache.set(key, { expires: Date.now() + ONE_DAY, value: metadata });
      const selected = products.find(product => String(product.id) === response.output.selectedId);
      return selected
        ? { metadata, selectedProductId: selected.id, matchConfidence: response.output.confidence }
        : { metadata };
    } catch {
      return { metadata: this.metadataCache.get(key)?.value ?? [] };
    }
  }

  private async references(products: VariantProduct[]): Promise<Reference[]> {
    const downloads = await Promise.allSettled(products.map(async product => ({
      product,
      ...await this.reference(product),
    })));
    return downloads.flatMap(result => result.status === 'fulfilled' ? [result.value] : []);
  }

  private decodePhoto(photo: string) {
    const match = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(photo);
    if (!match) throw new Error('Invalid user photo');
    return { data: Buffer.from(match[2], 'base64'), mediaType: match[1] };
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

  private async reference(product: VariantProduct): Promise<ReferenceImage> {
    const cached = this.referenceCache.get(product.id);
    if (cached && cached.expires > Date.now()) return cached.value;

    const response = await fetch(product.imageUrl, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error('Reference unavailable');

    const mediaType = response.headers.get('content-type')?.split(';')[0];
    if (!mediaType?.startsWith('image/')) throw new Error('Invalid reference');

    const data = Buffer.from(await response.arrayBuffer());
    if (data.length > 3 * 1024 * 1024) throw new Error('Reference too large');
    const value = { data, mediaType };
    this.referenceCache.set(product.id, { expires: Date.now() + ONE_DAY, value });
    return value;
  }
}
