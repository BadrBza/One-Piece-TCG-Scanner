import { Injectable } from '@nestjs/common';

import type {
  CardRecognition,
} from '../schemas/card-recognition.schema.js';
import { CardmarketProvider } from './providers/cardmarket.provider.js';
import { EbayProvider } from './providers/ebay.provider.js';

@Injectable()
export class PricingService {

  constructor(
    private readonly cardmarket: CardmarketProvider,
    private readonly ebay: EbayProvider,
  ) {}

  async getPrices(
    card: CardRecognition,
  ) {
    const [
      cardmarket,
      ebay,
    ] = await Promise.all([
      this.cardmarket.getPrice(card),
      this.ebay.getPrice(card),
    ]);

    return {
      cardmarket,
      ebay,
    };
  }
}
