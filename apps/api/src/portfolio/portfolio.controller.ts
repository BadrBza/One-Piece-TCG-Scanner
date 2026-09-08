import { BadRequestException, Body, Controller, Delete, Get, Header, NotFoundException, Param, ParseIntPipe, Post, Req, UseGuards } from '@nestjs/common';

import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard.js';
import { PortfolioRepository } from './portfolio.repository.js';
import { AddPortfolioCardSchema } from '../schemas/portfolio.schema.js';

@Controller('portfolio')
@UseGuards(AuthGuard)
export class PortfolioController {
  constructor(private readonly portfolio: PortfolioRepository) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  list(@Req() request: AuthenticatedRequest) {
    return this.portfolio.list(request.user.id);
  }

  @Post()
  add(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const card = AddPortfolioCardSchema.safeParse(body);
    if (!card.success) throw new BadRequestException('Les informations de la carte sont invalides.');
    return this.portfolio.add(request.user.id, card.data);
  }

  @Delete(':id')
  remove(@Req() request: AuthenticatedRequest, @Param('id', ParseIntPipe) id: number) {
    if (!this.portfolio.remove(request.user.id, id)) {
      throw new NotFoundException('Cette carte ne fait pas partie de la collection.');
    }
    return { removed: true };
  }
}
