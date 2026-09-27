import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { CardmarketProvider } from '../pricing/providers/cardmarket.provider.js';
import { PortfolioRepository } from './portfolio.repository.js';
import { TcgdexProvider } from '../pokemon/tcgdex.provider.js';

const JOUR = 24 * 60 * 60 * 1000;

@Injectable()
export class PortfolioPriceUpdater implements OnApplicationBootstrap {
  private readonly logger = new Logger(PortfolioPriceUpdater.name);
  private actualisationEnCours = false;

  constructor(
    private readonly portfolio: PortfolioRepository,
    private readonly cardmarket: CardmarketProvider,
    private readonly pokemon: TcgdexProvider,
  ) {}

  onApplicationBootstrap() {
    const limite = new Date(Date.now() - JOUR).toISOString();
    return this.refresh(this.portfolio.productIds(limite), this.portfolio.cartesPokemon(limite));
  }

  @Cron('0 12 * * *', { timeZone: 'Europe/Brussels' })
  refreshDaily() {
    return this.refresh(this.portfolio.productIds(), this.portfolio.cartesPokemon());
  }

  async refresh(produits: number[], cartesPokemon: ReturnType<PortfolioRepository['cartesPokemon']> = []) {
    if (this.actualisationEnCours || produits.length + cartesPokemon.length === 0) return;
    this.actualisationEnCours = true;
    try {
      const resultats = await Promise.allSettled([
        this.actualiserOnePiece(produits), this.actualiserPokemon(cartesPokemon),
      ]);
      if (resultats.some(resultat => resultat.status === 'rejected')) {
        this.logger.warn('La mise à jour quotidienne des cotes Cardmarket a échoué.');
      }
    } finally {
      this.actualisationEnCours = false;
    }
  }

  private async actualiserOnePiece(produits: number[]) {
    if (!produits.length) return;
    const { prices, updatedAt } = await this.cardmarket.getTrendPrices(produits);
    for (const [produitId, prix] of prices) this.portfolio.updatePrice(produitId, prix, updatedAt);
  }

  private async actualiserPokemon(cartes: ReturnType<PortfolioRepository['cartesPokemon']>) {
    // Quatre fiches à la fois ; les finitions et les propriétaires partagent la même réponse.
    for (let debut = 0; debut < cartes.length; debut += 4) {
      const resultats = await Promise.allSettled(cartes.slice(debut, debut + 4).map(async ({ catalogId, language }) => {
        const carte = await this.pokemon.carte(catalogId, language, true);
        for (const finition of carte.finishes) {
          if (finition.trendPrice !== undefined && finition.priceUpdatedAt) {
            this.portfolio.actualiserPokemon(carte.catalogId, language, finition.id, finition.trendPrice, finition.priceUpdatedAt);
          }
        }
      }));
      if (resultats.some(resultat => resultat.status === 'rejected')) this.logger.warn('Certaines cotes Pokémon n’ont pas pu être actualisées.');
    }
  }
}
