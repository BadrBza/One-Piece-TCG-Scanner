import { BadRequestException, Body, Controller, Delete, Get, Header, NotFoundException, Param, ParseIntPipe, Post, Req, UseGuards } from '@nestjs/common';

import { valider } from '../common/validation.js';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard.js';
import { PortfolioRepository } from './portfolio.repository.js';
import { AddPortfolioCardSchema } from './portfolio.schema.js';
import { TcgdexProvider } from '../pokemon/tcgdex.provider.js';

@Controller('portfolio')
@UseGuards(AuthGuard)
export class PortfolioController {
  constructor(private readonly portfolio: PortfolioRepository, private readonly pokemon: TcgdexProvider) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  list(@Req() request: AuthenticatedRequest) {
    return this.portfolio.list(request.user.id);
  }

  @Post()
  async add(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const carte = valider(AddPortfolioCardSchema, body, 'Les informations de la carte sont invalides.');
    if (carte.game === 'pokemon') {
      const fiche = await this.pokemon.carte(carte.catalogId, carte.language);
      const finition = fiche.finishes.find(finition => finition.id === carte.finishId);
      if (!finition) throw new BadRequestException('Cette finition Pokémon n’est plus disponible. Relance la recherche.');
      return this.portfolio.add(request.user.id, {
        game: 'pokemon', catalogId: fiche.catalogId, finishId: finition.id,
        cardNumber: fiche.cardNumber, name: fiche.name, language: fiche.language,
        imageUrl: fiche.imageUrl, rarity: fiche.rarity, expansion: fiche.expansion, variant: finition.label,
        cardmarketProductId: finition.cardmarketProductId, trendPrice: finition.trendPrice, priceUpdatedAt: finition.priceUpdatedAt,
      });
    }
    return this.portfolio.add(request.user.id, carte);
  }

  @Delete(':id')
  remove(@Req() request: AuthenticatedRequest, @Param('id', ParseIntPipe) id: number) {
    if (!this.portfolio.remove(request.user.id, id)) {
      throw new NotFoundException('Cette carte ne fait pas partie de la collection.');
    }
    return { removed: true };
  }
}
