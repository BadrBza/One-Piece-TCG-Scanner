import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';

import { PricingModule } from '../pricing/pricing.module.js';
import { RecognitionModule } from '../recognition/recognition.module.js';
import { CardsController } from './cards.controller.js';
import { CardsService } from './cards.service.js';

@Module({
  imports: [
    AuthModule,
    RecognitionModule,
    PricingModule,
  ],
  controllers: [
    CardsController,
  ],
  providers: [
    CardsService,
  ],
})
export class CardsModule {}
