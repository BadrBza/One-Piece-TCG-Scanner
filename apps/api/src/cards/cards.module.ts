import { Module } from '@nestjs/common';

import { PricingModule } from '../pricing/pricing.module.js';
import { RecognitionModule } from '../recognition/recognition.module.js';
import { CardsController } from './cards.controller.js';
import { CardsService } from './cards.service.js';
import { CardVariantsService } from '../pricing/card-variants.service.js';

@Module({
  imports: [
    RecognitionModule,
    PricingModule,
  ],
  controllers: [
    CardsController,
  ],
  providers: [
    CardsService,
    CardVariantsService,
  ],
})
export class CardsModule {}
