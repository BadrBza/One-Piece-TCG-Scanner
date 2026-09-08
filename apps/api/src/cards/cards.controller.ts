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
  scan(
    @Body() body: { image?: unknown; numberImage?: unknown } | null,
  ) {
    return this.cardsService.scan(body?.image, body?.numberImage);
  }
}
