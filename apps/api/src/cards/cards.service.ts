import { Injectable } from '@nestjs/common';

import { PricingService } from '../pricing/pricing.service.js';
import { RecognitionService } from '../recognition/recognition.service.js';
import { CardVariantsService } from '../pricing/card-variants.service.js';
import type { CardRecognition } from '../schemas/card-recognition.schema.js';

@Injectable()
export class CardsService {

  constructor(
    private readonly recognitionService: RecognitionService,
    private readonly pricingService: PricingService,
    private readonly cardVariants: CardVariantsService,
  ) {}

  async lookup(cardNumber: string) {
    const card: CardRecognition = { cardNumber, name: 'Recherche par numéro', language: 'UNKNOWN',
      rarity: null, variant: 'unknown', confidence: 0 };
    const prices = await this.getPrices(card);
    card.name = prices.cardmarket.products?.[0]?.name ?? cardNumber;
    const rarity = prices.cardmarket.products?.find(product => product.rarity && product.rarity !== 'Non déterminée')?.rarity;
    card.rarity = rarity ?? null;
    return { card, prices };
  }

  async scan(
    image: unknown,
    numberImage?: unknown,
  ) {
    const card = await this.recognitionService.identify(image, numberImage);
    const prices = await this.getPrices(card);
    return { card, prices };
  }

  private async getPrices(card: CardRecognition) {
    const prices = await this.pricingService.getPrices(card);
    prices.cardmarket = await this.cardVariants.variants(card, prices.cardmarket);
    return prices;
  }
}
