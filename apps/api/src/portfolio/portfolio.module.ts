import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { PortfolioController } from './portfolio.controller.js';
import { PortfolioRepository } from './portfolio.repository.js';
import { PortfolioPriceUpdater } from './portfolio-price-updater.service.js';
import { PricingModule } from '../pricing/pricing.module.js';

@Module({
  imports: [AuthModule, PricingModule],
  controllers: [PortfolioController],
  providers: [PortfolioRepository, PortfolioPriceUpdater],
})
export class PortfolioModule {}
