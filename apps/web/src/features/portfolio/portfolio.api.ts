import { request } from '../../lib/http';

export type NewPortfolioCard = {
  cardNumber: string;
  name: string;
  cardmarketProductId: number;
  imageUrl?: string;
  language?: string;
  rarity?: string;
  variant?: string;
  expansion?: string;
  trendPrice?: number;
};

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
    json: card,
  });
}

export async function removePortfolioCard(id: number) {
  await request(`/portfolio/${id}`, { method: 'DELETE' });
}
