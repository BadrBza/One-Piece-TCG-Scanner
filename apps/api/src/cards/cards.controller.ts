import {
  Body,
  Controller,
  Post,
  Get,
  Query,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';

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
    const normalized = normalizeCardNumber(number ?? '');
    if (!isCardNumber(normalized)) {
      throw new BadRequestException('Numéro invalide. Exemple : OP01-001.');
    }
    return this.cardsService.lookup(normalized);
  }

  @Post('scan')
  scan(@Body() body: unknown) {
    const request = ScanCardSchema.safeParse(body);
    if (!request.success) {
      throw new BadRequestException('Importe une photo valide pour lancer le scan.');
    }
    return this.cardsService.scan(request.data.image, request.data.numberImage);
  }

  @Post('resolve')
  resolve(@Body() body: unknown) {
    const request = ResolveCardSchema.safeParse(body);
    if (!request.success) throw new BadRequestException('Le numéro ou la photo est invalide.');
    return this.cardsService.lookup(request.data.cardNumber, request.data.image);
  }
}
