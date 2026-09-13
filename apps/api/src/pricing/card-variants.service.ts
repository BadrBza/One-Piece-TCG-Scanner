import sharp from 'sharp';
import { ScanCache } from './scan-cache.js';
import { measureScan, recordUsage, scanTelemetry } from '../recognition/scan-metrics.js';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { generateText, Output } from 'ai';

import { VARIANT_METADATA_PROMPT } from './prompts/variant-metadata.prompt.js';
import { MATCH_COMPACT_VARIANT_PROMPT } from './prompts/match-compact-variant.prompt.js';
import { MATCH_CARD_VARIANT_PROMPT } from './prompts/match-card-variant.prompt.js';
import { withGeminiModel } from '../recognition/gemini-model.js';
import type { CardRecognition } from '../recognition/card-recognition.schema.js';
import { CompactVariantSchema, OptcgCardsSchema, VariantMetadataSchema, VariantPhotoAnalysisSchema, type VariantMetadata } from './card-variants.schema.js';
import type { PriceResult } from './price-result.js';

type Product = NonNullable<PriceResult['products']>[number];
type VariantProduct = Product & { version: number; imageUrl: string };
type Reference = { product: VariantProduct; data: Buffer; mediaType: string };
type ReferenceImage = Omit<Reference, 'product'>;
type Analysis = { message?: string; metadata: VariantMetadata; selectedProductId?: number; matchConfidence?: number };

type CardInfo = { rarity: string; setName: string };
type CacheEntry<T> = { expires: number; value: T };

const ONE_DAY = 24 * 60 * 60 * 1000;
const FAST_GEMINI_MODEL = 'gemini-3.5-flash-lite';

@Injectable()
export class CardVariantsService {
  private readonly metadataCache = new Map<string, CacheEntry<VariantMetadata>>();

  private readonly disk: ScanCache;
  constructor(private readonly config: ConfigService) {
    this.disk = new ScanCache(config.get<string>('SCAN_CACHE_DIR') || '.cache/scanner');
  }
  private get optimized() { return this.config.get<string>('SCAN_OPTIMIZED') !== 'false'; }
  private get threshold() {
    const value = Number(this.config.get<string>('SCAN_MATCH_THRESHOLD') ?? '0.95');
    return Number.isFinite(value) && value >= 0 && value <= 1 ? value : 0.95;
  }

  async variants(card: CardRecognition, guide: PriceResult, photo?: string): Promise<PriceResult> {
    const variants = this.addVariantDetails(guide.products ?? []);
    if (!variants.length) return guide;

    if (this.optimized && photo) void this.getCardInfo(card.cardNumber);
    let [cardInfo, analysis] = await Promise.all([
      this.optimized && photo ? this.disk.peek<CardInfo>(`info-v1:${card.cardNumber}`) : this.getCardInfo(card.cardNumber),
      photo ? this.analyzePhoto(photo, variants) : this.getMetadata(variants).then<Analysis>(metadata => ({ metadata })),
    ]);

    if (!cardInfo && this.optimized && photo) cardInfo = await this.disk.peek<CardInfo>(`info-v1:${card.cardNumber}`);
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
      message: analysis.message ?? (analysis.selectedProductId
        ? 'La variante la plus proche de ta photo a été sélectionnée automatiquement.'
        : 'Compare ta carte avec les images et choisis la variante correspondante. Les informations inconnues restent à confirmer.'),
    };
  }

  private addVariantDetails(products: Product[]): VariantProduct[] {
    return [...products].sort((a, b) => a.id - b.id).map((product, index) => ({
      ...product,
      version: index + 1,
      imageUrl: `https://cardmarketapi.com/cards/${product.id}/image`,
    }));
  }

  private async getMetadata(products: VariantProduct[]): Promise<VariantMetadata> {
    try {
      return await this.disk.get(`metadata-v1:${products.map(product => product.id).join(',')}`, ONE_DAY, async () => {
        const metadata = await this.generateMetadata(products);
        if (!metadata.length) throw new Error('Metadata unavailable');
        return metadata;
      });
    } catch { return []; }
  }

  private async generateMetadata(products: VariantProduct[]): Promise<VariantMetadata> {
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
    if (this.optimized) return this.analyzeCompact(photo, products);
    const key = products.map(product => product.id).join(',');
    try {
      const references = await measureScan('references', () => this.references(products));
      if (!references.length) return { metadata: this.metadataCache.get(key)?.value ?? [] };

      const image = this.decodePhoto(photo);
      const response = await measureScan('compare-legacy', () => withGeminiModel(this.config, model => generateText({
        model,
        telemetry: scanTelemetry('compare-legacy'),
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
      }), this.config.get<string>('GEMINI_VARIANT_MODEL')?.trim() || FAST_GEMINI_MODEL));
      recordUsage('compare-legacy', response.usage, response.response.modelId);

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

  private async analyzeCompact(photo: string, products: VariantProduct[]): Promise<Analysis> {
    const descriptions = await this.disk.peek<VariantMetadata>(`metadata-v1:${products.map(product => product.id).join(',')}`) ?? [];
    const selectedDescriptions = (await Promise.all(products.map(product => this.disk.peek<VariantMetadata[number]>(`selected-v1:${product.id}`))))
      .filter((item): item is VariantMetadata[number] => !!item);
    const metadata = [...new Map([...descriptions, ...selectedDescriptions].map(item => [item.id, item])).values()];
    try {
      const references = await measureScan('references', () => this.references(products));
      // A partial candidate set cannot establish the exact version.
      if (references.length !== products.length) return { metadata, message: 'Certaines images de référence sont indisponibles. La variante ne peut pas être confirmée automatiquement.' };
      const image = this.decodePhoto(photo);
      const compare = async (detailed: boolean) => {
        const prepared = await Promise.all(references.map(async reference => ({
          product: reference.product,
          ...(detailed ? reference : await this.thumbnail(reference)),
        })));
        const userImage = detailed ? image : { data: await sharp(image.data).rotate().resize({ width: 1000, height: 1400, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer(), mediaType: 'image/jpeg' };
        const abortSignal = AbortSignal.timeout(detailed ? 30000 : 45000);
        return measureScan(detailed ? 'compare-detailed' : 'compare', () => withGeminiModel(this.config, async model => {
          const response = await generateText({
            model,
            telemetry: scanTelemetry(detailed ? 'compare-detailed' : 'compare'),
            system: MATCH_COMPACT_VARIANT_PROMPT,
            messages: [{ role: 'user', content: [
              ...prepared.flatMap(({ product, data, mediaType }) => [
                { type: 'text' as const, text: `CARDMARKET REFERENCE ID: ${product.id}` },
                { type: 'file' as const, data, mediaType },
              ]),
              { type: 'text', text: 'USER PHOTO' },
              { type: 'file', data: userImage.data, mediaType: userImage.mediaType },
            ] }],
            output: Output.object({ schema: CompactVariantSchema }),
            reasoning: 'low',
            providerOptions: { google: { mediaResolution: detailed ? 'MEDIA_RESOLUTION_HIGH' : 'MEDIA_RESOLUTION_MEDIUM' } },
            maxOutputTokens: 2048,
            maxRetries: 0,
            abortSignal,
          });
          recordUsage(detailed ? 'compare-detailed' : 'compare', response.usage, response.response.modelId);
          return response.output;
        }, this.config.get<string>('GEMINI_VARIANT_MODEL')?.trim() || FAST_GEMINI_MODEL));
      };
      let result = await compare(false);
      const accepted = () => result.confidence >= this.threshold && products.some(product => String(product.id) === result.selectedId);
      if (!accepted()) result = await compare(true);
      if (!accepted()) return { metadata };
      const selected = products.find(product => String(product.id) === result.selectedId)!;
      const item = { id: String(selected.id), language: result.language, variant: result.variant };
      // Only persist known metadata; an unreadable photo must not erase known data.
      if (item.language !== 'Non déterminée' && item.variant !== 'Non déterminée') {
        await this.disk.get(`selected-v1:${selected.id}`, ONE_DAY, async () => item);
      }
      return { metadata: [...metadata.filter(entry => entry.id !== item.id), item], selectedProductId: selected.id, matchConfidence: result.confidence };
    } catch { return { metadata }; }
  }

  private async thumbnail(reference: Reference): Promise<ReferenceImage> {
    const value = await this.disk.get(`thumb-v1:${reference.product.id}`, ONE_DAY, async () => ({
      data: (await sharp(reference.data).rotate().resize({ width: 600, height: 840, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer()).toString('base64'),
      mediaType: 'image/jpeg',
    }));
    return { data: Buffer.from(value.data, 'base64'), mediaType: value.mediaType };
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
    try {
      const value = await this.disk.get(`info-v1:${cardNumber}`, ONE_DAY, async () => {
        const response = await fetch(`https://optcgapi.com/api/sets/card/${encodeURIComponent(cardNumber)}/`, { signal: AbortSignal.timeout(15000) });
        if (!response.ok) throw new Error('Card information unavailable');
        const card = OptcgCardsSchema.parse(await response.json())[0];
        if (!card) throw new Error('Card information missing');
        return { rarity: card.rarity, setName: card.set_name };
      });
      return value;
    } catch { return undefined; }
  }

  private async reference(product: VariantProduct): Promise<ReferenceImage> {
    const stored = await this.disk.get(`reference-v1:${product.id}`, ONE_DAY, async () => {
      const response = await fetch(product.imageUrl, { signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error('Reference unavailable');
      const mediaType = response.headers.get('content-type')?.split(';')[0];
      if (!mediaType || !['image/jpeg', 'image/png', 'image/webp'].includes(mediaType)) throw new Error('Invalid reference');
      const data = Buffer.from(await response.arrayBuffer());
      if (!data.length || data.length > 3 * 1024 * 1024) throw new Error('Reference too large');
      return { data: data.toString('base64'), mediaType };
    });
    const value = { data: Buffer.from(stored.data, 'base64'), mediaType: stored.mediaType };
    return value;
  }
}
