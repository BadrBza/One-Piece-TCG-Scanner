import { request } from './http';

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

export async function getPortfolio(): Promise<PortfolioCard[]> {
  return request('/portfolio');
}

export async function addPortfolioCard(card: NewPortfolioCard): Promise<PortfolioCard> {
  return request('/portfolio', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(card),
  });
}

export async function removePortfolioCard(id: number): Promise<void> {
  await request(`/portfolio/${id}`, { method: 'DELETE' });
}
