import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { CardsModule } from './cards/cards.module.js';
import { PricingModule } from './pricing/pricing.module.js';
import { RecognitionModule } from './recognition/recognition.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    RecognitionModule,
    PricingModule,
    CardsModule,
  ],
})
export class AppModule {}
