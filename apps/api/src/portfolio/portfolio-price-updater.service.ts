import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { CardmarketProvider } from '../pricing/providers/cardmarket.provider.js';
import { PortfolioRepository } from './portfolio.repository.js';

const JOUR = 24 * 60 * 60 * 1000;

@Injectable()
export class PortfolioPriceUpdater implements OnApplicationBootstrap {
  private readonly logger = new Logger(PortfolioPriceUpdater.name);
  private actualisationEnCours = false;

  constructor(
    private readonly portfolio: PortfolioRepository,
    private readonly cardmarket: CardmarketProvider,
  ) {}

  onApplicationBootstrap() {
    const limite = new Date(Date.now() - JOUR).toISOString();
    return this.refresh(this.portfolio.productIds(limite));
  }

  @Cron('0 12 * * *', { timeZone: 'Europe/Brussels' })
  refreshDaily() {
    return this.refresh(this.portfolio.productIds());
  }

  async refresh(produits: number[]) {
    if (this.actualisationEnCours || produits.length === 0) return;
    this.actualisationEnCours = true;
    try {
      const { prices, updatedAt } = await this.cardmarket.getTrendPrices(produits);
      for (const [produitId, prix] of prices) {
        this.portfolio.updatePrice(produitId, prix, updatedAt);
      }
    } catch {
      this.logger.warn('La mise à jour quotidienne des cotes Cardmarket a échoué.');
    } finally {
      this.actualisationEnCours = false;
    }
  }
}
