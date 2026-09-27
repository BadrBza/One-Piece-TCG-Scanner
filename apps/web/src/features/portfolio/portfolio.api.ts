import { request } from '../../lib/http';
import type { PokemonLanguage } from '../scanner/scanner.api';

export type NewPortfolioCard = {
  cardNumber: string;
  name: string;
  imageUrl?: string;
  language?: string;
  rarity?: string;
  variant?: string;
  expansion?: string;
  trendPrice?: number;
} & ({ game?: 'one-piece'; cardmarketProductId: number } | {
  game: 'pokemon'; catalogId: string; finishId: string; language: PokemonLanguage;
  cardmarketProductId?: number; priceUpdatedAt?: string;
});

export type PortfolioCard = NewPortfolioCard & {
  id: number;
  quantity: number;
  addedAt: string;
  priceUpdatedAt?: string;
};

export function getPortfolio() {
  return request<PortfolioCard[]>('/portfolio');
}

export function addPortfolioCard(card: NewPortfolioCard) {
  return request<PortfolioCard>('/portfolio', {
    method: 'POST',
    ...(card.game === 'pokemon' ? { timeout: 60_000 } : {}),
    json: card,
  });
}

export async function removePortfolioCard(id: number) {
  await request(`/portfolio/${id}`, { method: 'DELETE' });
}
