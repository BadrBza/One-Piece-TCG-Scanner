import ky from 'ky';
import { measureScan, recordUsage, scanTelemetry } from '../recognition/scan-metrics.js';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { generateText, Output, type LanguageModel } from 'ai';
import type { z } from 'zod';

import { MATCH_COMPACT_VARIANT_PROMPT } from './prompts/match-compact-variant.prompt.js';
import { MATCH_CARD_VARIANT_PROMPT } from './prompts/match-card-variant.prompt.js';
import { withGeminiModel } from '../recognition/gemini-model.js';
import { decodePhoto, decodeReferenceImage, resizeImage, type DecodedImage } from '../common/image-utils.js';
import type { CardRecognition } from '../recognition/card-recognition.schema.js';
import { CompactVariantSchema, OptcgCardsSchema, VariantPhotoAnalysisSchema, type VariantMetadata } from './card-variants.schema.js';
import { illustrerProduit, type PriceResult } from './price-result.js';

type VariantProduct = ReturnType<typeof illustrerProduit>;
type Reference = DecodedImage & { product: VariantProduct };
type Analysis = { message?: string; metadata: VariantMetadata; selectedProductId?: number; matchConfidence?: number };
type CardInfo = { rarity: string; setName: string };
type UserContent = Array<{ type: 'text'; text: string } | { type: 'file'; data: Buffer; mediaType: string }>;

const FAST_GEMINI_MODEL = 'gemini-3.5-flash-lite';

@Injectable()
export class CardVariantsService {
  constructor(private readonly config: ConfigService) {}

  async variants(card: CardRecognition, guide: PriceResult, photo: string | DecodedImage): Promise<PriceResult> {
    const variants = [...(guide.products ?? [])].sort((a, b) => a.id - b.id).map(illustrerProduit);
    if (!variants.length) return guide;

    const infoPromise = this.chargerInfosCarte(card.cardNumber);
    const analysis = await this.analyserPhoto(photo, variants);
    const cardInfo = await this.infosDisponibles(infoPromise);
    return this.construireResultat(card, guide, variants, analysis, cardInfo);
  }

  private get optimized() { return this.config.get<string>('SCAN_OPTIMIZED') !== 'false'; }
  private get variantModel() { return this.config.get<string>('GEMINI_VARIANT_MODEL')?.trim() || FAST_GEMINI_MODEL; }
  private get threshold() {
    const value = Number(this.config.get<string>('SCAN_MATCH_THRESHOLD') ?? '0.95');
    return Number.isFinite(value) && value >= 0 && value <= 1 ? value : 0.95;
  }

  private infosDisponibles(infos: Promise<CardInfo | undefined>) {
    // En mode optimisé, utiliser seulement les métadonnées déjà disponibles après la comparaison.
    return this.optimized ? Promise.race([infos, Promise.resolve(undefined)]) : infos;
  }

  private construireResultat(card: CardRecognition, guide: PriceResult, variants: VariantProduct[], analysis: Analysis, cardInfo?: CardInfo): PriceResult {
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

  private async analyserPhoto(photo: string | DecodedImage, products: VariantProduct[]): Promise<Analysis> {
    try {
      const references = await measureScan('references', () => this.references(products));
      if (this.optimized && references.length !== products.length) {
        return { metadata: [], message: 'Certaines images de référence sont indisponibles. La variante ne peut pas être confirmée automatiquement.' };
      }
      if (!references.length) return { metadata: [] };
      const image = typeof photo === 'string' ? decodePhoto(photo) : photo;
      return this.optimized
        ? await this.comparerParcoursOptimise(image, products, references)
        : await this.comparerAncienParcours(image, products, references);
    } catch { return { metadata: [] }; }
  }

  private async comparerAncienParcours(image: DecodedImage, products: VariantProduct[], references: Reference[]): Promise<Analysis> {
    const output = await this.genererComparaison({
      system: MATCH_CARD_VARIANT_PROMPT,
      content: [
        { type: 'text', text: 'USER PHOTO' },
        { type: 'file', data: image.data, mediaType: image.mediaType },
        ...this.referenceMessages(references),
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
  }

  private async comparerParcoursOptimise(image: DecodedImage, products: VariantProduct[], references: Reference[]): Promise<Analysis> {
    for (const detaille of [false, true]) {
      const resultat = await this.comparerImages(image, references, detaille);
      if (resultat.confidence < this.threshold) continue;
      const produit = products.find(product => String(product.id) === resultat.selectedId);
      if (!produit) continue;
      return {
        metadata: [{ id: String(produit.id), language: resultat.language, variant: resultat.variant }],
        selectedProductId: produit.id,
        matchConfidence: resultat.confidence,
      };
    }
    return { metadata: [] };
  }

  private async comparerImages(image: DecodedImage, references: Reference[], detailed: boolean) {
    const prepared = await Promise.all(references.map(async reference => ({
      product: reference.product,
      ...(detailed ? reference : await resizeImage(reference, 600, 840)),
    })));
    const userImage = detailed ? image : await resizeImage(image, 1000, 1400);
    return this.genererComparaison({
      system: MATCH_COMPACT_VARIANT_PROMPT,
      content: [
        ...this.referenceMessages(prepared),
        { type: 'text', text: 'USER PHOTO' },
        { type: 'file', data: userImage.data, mediaType: userImage.mediaType },
      ],
      schema: CompactVariantSchema,
      stage: detailed ? 'compare-detailed' : 'compare',
      resolution: detailed ? 'MEDIA_RESOLUTION_HIGH' : 'MEDIA_RESOLUTION_MEDIUM',
      timeout: detailed ? 30_000 : 45_000,
    });
  }

  private async genererComparaison<T extends z.ZodType>(options: {
    system: string;
    content: UserContent;
    schema: T;
    stage: string;
    resolution?: 'MEDIA_RESOLUTION_MEDIUM' | 'MEDIA_RESOLUTION_HIGH';
    timeout: number;
  }): Promise<z.infer<T>> {
    const generate = (model: LanguageModel) => generateText({
      model,
      telemetry: scanTelemetry(options.stage),
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
    const response = await measureScan(options.stage, run);
    recordUsage(options.stage, response.usage, response.response.modelId);
    return response.output as z.infer<T>;
  }

  private referenceMessages(references: Reference[]): UserContent {
    return references.flatMap(({ product, data, mediaType }) => [
      { type: 'text', text: `CARDMARKET REFERENCE ID: ${product.id}` },
      { type: 'file', data, mediaType },
    ]);
  }

  private async references(products: VariantProduct[]): Promise<Reference[]> {
    const downloads = await Promise.allSettled(products.map(async product => ({
      product,
      ...await this.reference(product),
    })));
    return downloads.flatMap(result => result.status === 'fulfilled' ? [result.value] : []);
  }

  private async chargerInfosCarte(cardNumber: string): Promise<CardInfo | undefined> {
    try {
      const payload = await ky.get(`https://optcgapi.com/api/sets/card/${encodeURIComponent(cardNumber)}/`, { timeout: 15_000, retry: 0 }).json();
      const card = OptcgCardsSchema.parse(payload)[0];
      return card ? { rarity: card.rarity, setName: card.set_name } : undefined;
    } catch { return undefined; }
  }

  private async reference(product: VariantProduct): Promise<DecodedImage> {
    const response = await ky.get(product.imageUrl, { timeout: 10_000, retry: 0 });
    return decodeReferenceImage(response);
  }
}
