import { Injectable, UnprocessableEntityException } from '@nestjs/common';

import { measureScan, scanContext } from '../recognition/scan-metrics.js';
import { CardmarketProvider } from '../pricing/providers/cardmarket.provider.js';
import { RecognitionService } from '../recognition/recognition.service.js';
import { CardVariantsService } from '../pricing/card-variants.service.js';
import type { CardRecognition } from '../recognition/card-recognition.schema.js';
import type { PriceResult } from '../pricing/price-result.js';
import type { CardNumberConfirmation } from './scan-card.schema.js';

@Injectable()
export class CardsService {

  constructor(
    private readonly recognitionService: RecognitionService,
    private readonly cardmarket: CardmarketProvider,
    private readonly cardVariants: CardVariantsService,
  ) {}

  async lookup(cardNumber: string) {
    const card = this.createCard(cardNumber);
    const guide = await this.cardmarket.getPrice(card);
    const products = guide.products?.map((product, index) => ({
      ...product,
      version: index + 1,
      imageUrl: `https://cardmarketapi.com/cards/${product.id}/image`,
    }));
    card.name = products?.[0]?.name ?? cardNumber;
    return { card, prices: { cardmarket: { ...guide, products } } };
  }

  async resolve(cardNumber: string, photo: string) {
    const card = this.createCard(cardNumber);
    const guide = await this.cardmarket.getPrice(card);
    const prices = { cardmarket: await this.cardVariants.variants(card, guide, photo) };
    this.fillCard(card, prices.cardmarket);
    const rarity = prices.cardmarket.products?.find(product => product.rarity && product.rarity !== 'Non déterminée')?.rarity;
    card.rarity = rarity ?? null;
    return { card, prices };
  }

  async scan(
    image: string,
    numberImage?: string,
  ) {
    return scanContext(async () => {
      const recognition = await this.recognitionService.identify(image, numberImage);
      if (isNumberConfirmation(recognition)) return recognition;
      let card = recognition;
      let guide = await measureScan('catalog', () => this.cardmarket.getPrice(card));
      if (guide.products?.length === 0 && this.recognitionService.canRetryNumber(card)) {
        card = await this.recognitionService.readNumberOnly(image);
        guide = await measureScan('catalog', () => this.cardmarket.getPrice(card));
      }
      if (guide.products?.length === 0 && this.recognitionService.optimized) {
        throw new UnprocessableEntityException('Aucune fiche trouvée pour ce numéro. Vérifie-le ou saisis-le manuellement.');
      }
      const prices = { cardmarket: await this.cardVariants.variants(card, guide, image) };
      if (this.recognitionService.optimized) this.fillCard(card, prices.cardmarket);
      return { card, prices };
    });
  }

  private createCard(cardNumber: string): CardRecognition {
    return { cardNumber, name: cardNumber, language: 'UNKNOWN', rarity: null, variant: 'unknown', confidence: 0 };
  }

  private fillCard(card: CardRecognition, price: PriceResult) {
    const selected = price.products?.find(product => product.id === price.selectedProductId);
    const product = selected ?? price.products?.[0];
    card.name = product?.name ?? card.cardNumber;
    card.rarity = product?.rarity && product.rarity !== 'Non déterminée' ? product.rarity : null;
    card.confidence = selected ? price.matchConfidence ?? 0 : 0;
    const languages: Record<string, CardRecognition['language']> = { Anglais: 'EN', Japonais: 'JP', Français: 'FR', Chinois: 'CN', Coréen: 'KR' };
    const variants: Record<string, CardRecognition['variant']> = { Standard: 'regular', Parallèle: 'parallel', 'Illustration alternative': 'alternate_art', Manga: 'manga', Promotionnelle: 'promo' };
    card.language = selected ? languages[selected.languageLabel ?? ''] ?? 'UNKNOWN' : 'UNKNOWN';
    card.variant = selected ? variants[selected.variantLabel ?? ''] ?? 'unknown' : 'unknown';
  }


}

function isNumberConfirmation(result: CardRecognition | CardNumberConfirmation): result is CardNumberConfirmation {
  return 'status' in result;
}
