import {
  Body,
  Controller,
  Post,
  Get,
  Query,
  Param,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';

import { valider } from '../common/validation.js';
import { CardsService } from './cards.service.js';
import { CardImagesService } from './card-images.service.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { isCardNumber, normalizeCardNumber } from '../recognition/card-number.js';
import { CardImageParamsSchema, GameSelectionSchema, LookupCardSchema, ResolveCardSchema, ScanCardSchema } from './scan-card.schema.js';
import { PokemonLookupSchema, PokemonResolveSchema } from '../pokemon/pokemon.schema.js';

@Controller('cards')
@UseGuards(AuthGuard)
export class CardsController {

  constructor(
    private readonly cardsService: CardsService,
    private readonly images: CardImagesService,
  ) {}

  @Get(':productId/image')
  image(@Param() params: unknown) {
    const { productId } = valider(CardImageParamsSchema, params, 'Identifiant Cardmarket invalide.');
    return this.images.charger(productId);
  }

  @Get('lookup')
  lookup(@Query() query: unknown) {
    const { game, number } = valider(LookupCardSchema, query, 'Les paramètres de recherche sont invalides.');
    if (game === 'pokemon') {
      const recherche = valider(PokemonLookupSchema, query, 'La référence ou la langue Pokémon est invalide.');
      return this.cardsService.lookup(recherche.number, game, recherche);
    }
    // Accept the common zero/O typo only in the OP prefix of manual input.
    const normalized = normalizeCardNumber(number ?? '').replace(/^0P(?=\d{2}-\d{3}$)/, 'OP');
    if (!isCardNumber(normalized)) {
      throw new BadRequestException('Numéro invalide. Exemple : OP01-001.');
    }
    return this.cardsService.lookup(normalized);
  }

  @Post('scan')
  scan(@Body() body: unknown) {
    const { image, numberImage, game } = valider(ScanCardSchema, body, 'Importe une photo valide pour lancer le scan.');
    return this.cardsService.scan(image, numberImage, game);
  }

  @Post('resolve')
  resolve(@Body() body: unknown) {
    const { game } = valider(GameSelectionSchema, body, 'Le jeu est invalide.');
    if (game === 'pokemon') {
      const { catalogId, language } = valider(PokemonResolveSchema, body, 'La carte ou la langue Pokémon est invalide.');
      return this.cardsService.resolvePokemon(catalogId, language);
    }
    const { cardNumber, image } = valider(ResolveCardSchema, body, 'Le numéro ou la photo est invalide.');
    return this.cardsService.resolve(cardNumber, image);
  }
}
