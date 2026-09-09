import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { CardmarketProvider } from '../pricing/providers/cardmarket.provider.js';
import { PortfolioRepository } from './portfolio.repository.js';

const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class PortfolioPriceUpdater implements OnApplicationBootstrap {
  private readonly logger = new Logger(PortfolioPriceUpdater.name);
  private refreshing = false;

  constructor(
    private readonly portfolio: PortfolioRepository,
    private readonly cardmarket: CardmarketProvider,
  ) {}

  onApplicationBootstrap() {
    const cutoff = new Date(Date.now() - ONE_WEEK).toISOString();
    return this.refresh(this.portfolio.productIds(cutoff));
  }

  @Cron('0 3 * * 0', { timeZone: 'Europe/Brussels' })
  refreshWeekly() {
    return this.refresh(this.portfolio.productIds());
  }

  async refresh(productIds: number[]) {
    if (this.refreshing || productIds.length === 0) return;
    this.refreshing = true;
    try {
      const { prices, updatedAt } = await this.cardmarket.getTrendPrices(productIds);
      for (const [productId, trendPrice] of prices) {
        this.portfolio.updatePrice(productId, trendPrice, updatedAt);
      }
    } catch {
      this.logger.warn('La mise à jour hebdomadaire des cotes Cardmarket a échoué.');
    } finally {
      this.refreshing = false;
    }
  }
}
