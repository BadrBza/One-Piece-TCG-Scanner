import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PokemonModule } from '../pokemon/pokemon.module.js';

import { PricingModule } from '../pricing/pricing.module.js';
import { RecognitionModule } from '../recognition/recognition.module.js';
import { CardsController } from './cards.controller.js';
import { CardsService } from './cards.service.js';

@Module({
  imports: [
    AuthModule,
    PokemonModule,
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
