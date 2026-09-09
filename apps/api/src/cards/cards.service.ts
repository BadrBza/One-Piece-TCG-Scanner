import { Injectable } from '@nestjs/common';

import { CardmarketProvider } from '../pricing/providers/cardmarket.provider.js';
import { RecognitionService } from '../recognition/recognition.service.js';
import { CardVariantsService } from '../pricing/card-variants.service.js';
import type { CardRecognition } from '../schemas/card-recognition.schema.js';
import type { CardNumberConfirmation } from '../schemas/scan-card.schema.js';

@Injectable()
export class CardsService {

  constructor(
    private readonly recognitionService: RecognitionService,
    private readonly cardmarket: CardmarketProvider,
    private readonly cardVariants: CardVariantsService,
  ) {}

  async lookup(cardNumber: string, photo?: string) {
    const card: CardRecognition = { cardNumber, name: 'Recherche par numéro', language: 'UNKNOWN',
      rarity: null, variant: 'unknown', confidence: 0 };
    const prices = await this.getPrices(card, photo);
    card.name = prices.cardmarket.products?.[0]?.name ?? cardNumber;
    const rarity = prices.cardmarket.products?.find(product => product.rarity && product.rarity !== 'Non déterminée')?.rarity;
    card.rarity = rarity ?? null;
    return { card, prices };
  }

  async scan(
    image: string,
    numberImage?: string,
  ) {
    const recognition = await this.recognitionService.identify(image, numberImage);
    if (isNumberConfirmation(recognition)) return recognition;

    const card = recognition;
    const prices = await this.getPrices(card, image);
    return { card, prices };
  }

  private async getPrices(card: CardRecognition, photo?: string) {
    const prices = await this.cardmarket.getPrice(card);
    return { cardmarket: await this.cardVariants.variants(card, prices, photo) };
  }
}

function isNumberConfirmation(result: CardRecognition | CardNumberConfirmation): result is CardNumberConfirmation {
  return 'status' in result;
}
