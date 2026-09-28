import ky from 'ky';
import { measureScan, mesurerGeneration } from '../recognition/scan-metrics.js';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { LanguageModel, UserContent } from 'ai';
import type { z } from 'zod';

import { MATCH_COMPACT_VARIANT_PROMPT } from './prompts/match-compact-variant.prompt.js';
import { MATCH_CARD_VARIANT_PROMPT } from './prompts/match-card-variant.prompt.js';
import { genererStructure, withGeminiModel } from '../recognition/gemini-model.js';
import { decodePhoto, decodeReferenceImage, resizeImage, type DecodedImage } from '../common/image-utils.js';
import type { CardRecognition } from '../recognition/card-recognition.schema.js';
import { CompactVariantSchema, OptcgCardsSchema, VariantPhotoAnalysisSchema, type VariantMetadata } from './card-variants.schema.js';
import { illustrerProduit, type PriceResult } from './price-result.js';

type VariantProduct = ReturnType<typeof illustrerProduit>;
type Reference = DecodedImage & { product: VariantProduct };
type Analysis = { message?: string; metadata: VariantMetadata; selectedProductId?: number; matchConfidence?: number };
type CardInfo = { rarity: string; setName: string };

const FAST_GEMINI_MODEL = 'gemini-3.5-flash-lite';

@Injectable()
export class CardVariantsService {
  private readonly http = ky.create({ timeout: 10_000, retry: 0 });
  constructor(private readonly config: ConfigService) {}

  async variants(card: CardRecognition, guide: PriceResult, photo: string | DecodedImage): Promise<PriceResult> {
    const variantes = (guide.products ?? []).toSorted((a, b) => a.id - b.id).map(illustrerProduit);
    if (!variantes.length) return guide;

    const informations = this.chargerInfosCarte(card.cardNumber);
    const analyse = await this.analyserPhoto(photo, variantes);
    return this.construireResultat(card, guide, variantes, analyse, await this.infosDisponibles(informations));
  }

  private get optimized() { return this.config.get<string>('SCAN_OPTIMIZED') !== 'false'; }
  private get variantModel() { return this.config.get<string>('GEMINI_VARIANT_MODEL')?.trim() || FAST_GEMINI_MODEL; }
  private get threshold() {
    const seuil = Number(this.config.get<string>('SCAN_MATCH_THRESHOLD') ?? '0.95');
    return Number.isFinite(seuil) && seuil >= 0 && seuil <= 1 ? seuil : 0.95;
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

  private async preparerComparaison(photo: DecodedImage, references: Reference[], detaille: boolean) {
    const images = await Promise.all(references.map(async reference => detaille
      ? reference
      : { product: reference.product, ...await resizeImage(reference, 600, 840) }));
    return { references: images, photo: detaille ? photo : await resizeImage(photo, 1000, 1400) };
  }

  private async comparerImages(image: DecodedImage, references: Reference[], detaille: boolean) {
    const preparation = await this.preparerComparaison(image, references, detaille);
    return this.genererComparaison({
      system: MATCH_COMPACT_VARIANT_PROMPT,
      content: [
        ...this.referenceMessages(preparation.references),
        { type: 'text', text: 'USER PHOTO' },
        { type: 'file', data: preparation.photo.data, mediaType: preparation.photo.mediaType },
      ],
      schema: CompactVariantSchema,
      stage: detaille ? 'compare-detailed' : 'compare',
      resolution: detaille ? 'MEDIA_RESOLUTION_HIGH' : 'MEDIA_RESOLUTION_MEDIUM',
      timeout: detaille ? 30_000 : 45_000,
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
    const { timeout, ...generation } = options;
    const generer = (model: LanguageModel) => genererStructure({
      ...generation, model, abortSignal: AbortSignal.timeout(timeout),
    });
    const reponse = await mesurerGeneration(options.stage, () => withGeminiModel(this.config, generer, this.variantModel));
    return reponse.output as z.infer<T>;
  }

  private referenceMessages(references: Reference[]): Exclude<UserContent, string> {
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
      const donnees = await this.http.get(`https://optcgapi.com/api/sets/card/${encodeURIComponent(cardNumber)}/`, { timeout: 15_000 }).json();
      const carte = OptcgCardsSchema.parse(donnees)[0];
      return carte ? { rarity: carte.rarity, setName: carte.set_name } : undefined;
    } catch { return undefined; }
  }

  private async reference(product: VariantProduct): Promise<DecodedImage> {
    return decodeReferenceImage(await this.http.get(product.imageUrl));
  }
}
