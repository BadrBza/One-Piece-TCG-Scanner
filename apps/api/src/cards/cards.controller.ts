import {
  Body,
  Controller,
  Post,
  Get,
  Query,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';

import { valider } from '../common/validation.js';
import { CardsService } from './cards.service.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { isCardNumber, normalizeCardNumber } from '../recognition/card-number.js';
import { ResolveCardSchema, ScanCardSchema } from './scan-card.schema.js';

@Controller('cards')
@UseGuards(AuthGuard)
export class CardsController {

  constructor(
    private readonly cardsService: CardsService,
  ) {}

  @Get('lookup')
  lookup(@Query('number') number: string) {
    // Accept the common zero/O typo only in the OP prefix of manual input.
    const normalized = normalizeCardNumber(number ?? '').replace(/^0P(?=\d{2}-\d{3}$)/, 'OP');
    if (!isCardNumber(normalized)) {
      throw new BadRequestException('Numéro invalide. Exemple : OP01-001.');
    }
    return this.cardsService.lookup(normalized);
  }

  @Post('scan')
  scan(@Body() body: unknown) {
    const { image, numberImage } = valider(ScanCardSchema, body, 'Importe une photo valide pour lancer le scan.');
    return this.cardsService.scan(image, numberImage);
  }

  @Post('resolve')
  resolve(@Body() body: unknown) {
    const { cardNumber, image } = valider(ResolveCardSchema, body, 'Le numéro ou la photo est invalide.');
    return this.cardsService.resolve(cardNumber, image);
  }
}
