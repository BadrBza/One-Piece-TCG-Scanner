import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { OriginGuard } from './auth/origin.guard.js';

import { CardsModule } from './cards/cards.module.js';
import { AuthModule } from './auth/auth.module.js';
import { DatabaseModule } from './database/database.module.js';
import { PricingModule } from './pricing/pricing.module.js';
import { PortfolioModule } from './portfolio/portfolio.module.js';
import { RecognitionModule } from './recognition/recognition.module.js';

@Module({
  providers: [{ provide: APP_GUARD, useClass: OriginGuard }],
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    DatabaseModule,
    AuthModule,
    RecognitionModule,
    PricingModule,
    CardsModule,
    PortfolioModule,
  ],
})
export class AppModule {}
