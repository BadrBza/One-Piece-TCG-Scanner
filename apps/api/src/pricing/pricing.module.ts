import { Module } from '@nestjs/common';

import { PricingService } from './pricing.service.js';
import { CardmarketProvider } from './providers/cardmarket.provider.js';
import { EbayProvider } from './providers/ebay.provider.js';

@Module({
  providers: [
    PricingService,
    CardmarketProvider,
    EbayProvider,
  ],
  exports: [
    PricingService,
  ],
})
export class PricingModule {}
