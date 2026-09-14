import sharp from 'sharp';
import ky from 'ky';
import { measureScan, recordUsage, scanTelemetry } from '../recognition/scan-metrics.js';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { generateText, Output, type LanguageModel } from 'ai';
import type { z } from 'zod';

import { MATCH_COMPACT_VARIANT_PROMPT } from './prompts/match-compact-variant.prompt.js';
import { MATCH_CARD_VARIANT_PROMPT } from './prompts/match-card-variant.prompt.js';
import { withGeminiModel } from '../recognition/gemini-model.js';
import { parseDataUrl } from '../recognition/decode-image.js';
import type { CardRecognition } from '../recognition/card-recognition.schema.js';
import { CompactVariantSchema, OptcgCardsSchema, VariantPhotoAnalysisSchema, type VariantMetadata } from './card-variants.schema.js';
import type { PriceResult } from './price-result.js';

type Product = NonNullable<PriceResult['products']>[number];
type VariantProduct = Product & { version: number; imageUrl: string };
type Reference = { product: VariantProduct; data: Buffer; mediaType: string };
type ReferenceImage = Omit<Reference, 'product'>;
type Analysis = { message?: string; metadata: VariantMetadata; selectedProductId?: number; matchConfidence?: number };
type CardInfo = { rarity: string; setName: string };
type UserContent = Array<{ type: 'text'; text: string } | { type: 'file'; data: Buffer; mediaType: string }>;

const FAST_GEMINI_MODEL = 'gemini-3.5-flash-lite';

@Injectable()
export class CardVariantsService {
  constructor(private readonly config: ConfigService) {}
  private get optimized() { return this.config.get<string>('SCAN_OPTIMIZED') !== 'false'; }
  private get variantModel() { return this.config.get<string>('GEMINI_VARIANT_MODEL')?.trim() || FAST_GEMINI_MODEL; }
  private get threshold() {
    const value = Number(this.config.get<string>('SCAN_MATCH_THRESHOLD') ?? '0.95');
    return Number.isFinite(value) && value >= 0 && value <= 1 ? value : 0.95;
  }

  async variants(card: CardRecognition, guide: PriceResult, photo: string): Promise<PriceResult> {
    const variants = this.addVariantDetails(guide.products ?? []);
    if (!variants.length) return guide;

    const infoPromise = this.getCardInfo(card.cardNumber);
    const analysis = await this.analyzePhoto(photo, variants);
    // Optimized photo scans must not wait on optional OPTCG metadata.
    const cardInfo = this.optimized
      ? await Promise.race([infoPromise, Promise.resolve(undefined)])
      : await infoPromise;

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

  private async variantGenerate<T extends z.ZodType>(options: {
    system: string;
    content: UserContent;
    schema: T;
    stage?: string;
    resolution?: 'MEDIA_RESOLUTION_MEDIUM' | 'MEDIA_RESOLUTION_HIGH';
    timeout: number;
  }): Promise<z.infer<T>> {
    const generate = (model: LanguageModel) => generateText({
      model,
      ...(options.stage ? { telemetry: scanTelemetry(options.stage) } : {}),
      system: options.system,
      messages: [{ role: 'user', content: options.content }],
      output: Output.object({ schema: options.schema }),
      reasoning: 'low',
      providerOptions: { google: { mediaResolution: options.resolution ?? 'MEDIA_RESOLUTION_MEDIUM' } },
      maxOutputTokens: 2048,
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(options.timeout),
    });
    const run = () => withGeminiModel(this.config, generate, this.variantModel);
    const response = options.stage ? await measureScan(options.stage, run) : await run();
    if (options.stage) recordUsage(options.stage, response.usage, response.response.modelId);
    return response.output as z.infer<T>;
  }

  private async analyzePhoto(photo: string, products: VariantProduct[]): Promise<Analysis> {
    if (this.optimized) return this.analyzeCompact(photo, products);
    try {
      const references = await measureScan('references', () => this.references(products));
      if (!references.length) return { metadata: [] };
      const image = this.decodePhoto(photo);
      const output = await this.variantGenerate({
        system: MATCH_CARD_VARIANT_PROMPT,
        content: [
          { type: 'text', text: 'USER PHOTO' },
          { type: 'file', data: image.data, mediaType: image.mediaType },
          ...references.flatMap(({ product, data, mediaType }) => [
            { type: 'text' as const, text: `CARDMARKET REFERENCE ID: ${product.id}` },
            { type: 'file' as const, data, mediaType },
          ]),
        ],
        schema: VariantPhotoAnalysisSchema,
        stage: 'compare-legacy',
        timeout: 45_000,
      });
      const metadata = output.items;
      const selected = products.find(product => String(product.id) === output.selectedId);
      return selected
        ? { metadata, selectedProductId: selected.id, matchConfidence: output.confidence }
        : { metadata };
    } catch {
      return { metadata: [] };
    }
  }

  private async analyzeCompact(photo: string, products: VariantProduct[]): Promise<Analysis> {
    const metadata: VariantMetadata = [];
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
        return this.variantGenerate({
          system: MATCH_COMPACT_VARIANT_PROMPT,
          content: [
            ...prepared.flatMap(({ product, data, mediaType }) => [
              { type: 'text' as const, text: `CARDMARKET REFERENCE ID: ${product.id}` },
              { type: 'file' as const, data, mediaType },
            ]),
            { type: 'text', text: 'USER PHOTO' },
            { type: 'file', data: userImage.data, mediaType: userImage.mediaType },
          ],
          schema: CompactVariantSchema,
          stage: detailed ? 'compare-detailed' : 'compare',
          resolution: detailed ? 'MEDIA_RESOLUTION_HIGH' : 'MEDIA_RESOLUTION_MEDIUM',
          timeout: detailed ? 30_000 : 45_000,
        });
      };
      let result = await compare(false);
      const accepted = () => result.confidence >= this.threshold && products.some(product => String(product.id) === result.selectedId);
      if (!accepted()) result = await compare(true);
      if (!accepted()) return { metadata };
      const selected = products.find(product => String(product.id) === result.selectedId)!;
      const item = { id: String(selected.id), language: result.language, variant: result.variant };
      return { metadata: [item], selectedProductId: selected.id, matchConfidence: result.confidence };
    } catch { return { metadata }; }
  }

  private async thumbnail(reference: Reference): Promise<ReferenceImage> {
    return {
      data: await sharp(reference.data).rotate().resize({ width: 600, height: 840, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer(),
      mediaType: 'image/jpeg',
    };
  }

  private async references(products: VariantProduct[]): Promise<Reference[]> {
    const downloads = await Promise.allSettled(products.map(async product => ({
      product,
      ...await this.reference(product),
    })));
    return downloads.flatMap(result => result.status === 'fulfilled' ? [result.value] : []);
  }

  private decodePhoto(photo: string) {
    const image = parseDataUrl(photo);
    if (!image) throw new Error('Invalid user photo');
    return image;
  }

  private async getCardInfo(cardNumber: string): Promise<CardInfo | undefined> {
    try {
      const payload = await ky.get(`https://optcgapi.com/api/sets/card/${encodeURIComponent(cardNumber)}/`, { timeout: 15_000, retry: 0 }).json();
      const card = OptcgCardsSchema.parse(payload)[0];
      if (!card) throw new Error('Card information missing');
      return { rarity: card.rarity, setName: card.set_name };
    } catch { return undefined; }
  }

  private async reference(product: VariantProduct): Promise<ReferenceImage> {
    const response = await ky.get(product.imageUrl, { timeout: 10_000, retry: 0 });
    const mediaType = response.headers.get('content-type')?.split(';')[0];
    if (!mediaType || !['image/jpeg', 'image/png', 'image/webp'].includes(mediaType)) throw new Error('Invalid reference');
    const data = Buffer.from(await response.arrayBuffer());
    if (!data.length || data.length > 3 * 1024 * 1024) throw new Error('Reference too large');
    return { data, mediaType };
  }
}
