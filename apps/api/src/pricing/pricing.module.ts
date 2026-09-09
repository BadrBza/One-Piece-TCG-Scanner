import { Module } from '@nestjs/common';

import { CardVariantsService } from './card-variants.service.js';
import { CardmarketProvider } from './providers/cardmarket.provider.js';

@Module({
  providers: [
    CardmarketProvider,
    CardVariantsService,
  ],
  exports: [
    CardmarketProvider,
    CardVariantsService,
  ],
})
export class PricingModule {}
