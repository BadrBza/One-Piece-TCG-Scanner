import { Injectable } from '@nestjs/common';

import type {
  CardRecognition,
} from '../../schemas/card-recognition.schema.js';
import type {
  PriceProvider,
  PriceResult,
} from '../price-provider.interface.js';

@Injectable()
export class EbayProvider
  implements PriceProvider {

  async getPrice(
    _card: CardRecognition,
  ): Promise<PriceResult> {
    // TODO: call eBay search/completed listings.
    return {
      source: 'ebay',
      currency: 'EUR',
    };
  }
}
