import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../database/database.service.js';
import type { AddPortfolioCard, PortfolioCard } from '../schemas/portfolio.schema.js';

type PortfolioRow = {
  id: number;
  card_number: string;
  name: string;
  cardmarket_product_id: number;
  image_url: string | null;
  language: string | null;
  rarity: string | null;
  variant: string | null;
  expansion: string | null;
  trend_price: number | null;
  quantity: number;
  added_at: string;
};

@Injectable()
export class PortfolioRepository {
  constructor(private readonly database: DatabaseService) {}

  list(userId: number): PortfolioCard[] {
    const rows = this.database.connection.prepare(
      'SELECT * FROM portfolio_cards WHERE user_id = ? ORDER BY added_at DESC, id DESC',
    ).all(userId) as PortfolioRow[];
    return rows.map(toPortfolioCard);
  }

  add(userId: number, card: AddPortfolioCard): PortfolioCard {
    const row = this.database.connection.prepare(`
      INSERT INTO portfolio_cards (
        user_id, card_number, name, cardmarket_product_id, image_url,
        language, rarity, variant, expansion, trend_price
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, cardmarket_product_id) DO UPDATE SET
        quantity = quantity + 1,
        trend_price = COALESCE(excluded.trend_price, portfolio_cards.trend_price)
      RETURNING *
    `).get(
      userId,
      card.cardNumber,
      card.name,
      card.cardmarketProductId,
      card.imageUrl ?? null,
      card.language ?? null,
      card.rarity ?? null,
      card.variant ?? null,
      card.expansion ?? null,
      card.trendPrice ?? null,
    ) as PortfolioRow;

    return toPortfolioCard(row);
  }

  remove(userId: number, id: number): boolean {
    return this.database.connection.prepare(
      'DELETE FROM portfolio_cards WHERE id = ? AND user_id = ?',
    ).run(id, userId).changes > 0;
  }

}

function toPortfolioCard(row: PortfolioRow): PortfolioCard {
  return {
    id: row.id,
    cardNumber: row.card_number,
    name: row.name,
    cardmarketProductId: row.cardmarket_product_id,
    imageUrl: row.image_url ?? undefined,
    language: row.language ?? undefined,
    rarity: row.rarity ?? undefined,
    variant: row.variant ?? undefined,
    expansion: row.expansion ?? undefined,
    trendPrice: row.trend_price ?? undefined,
    quantity: row.quantity,
    addedAt: row.added_at,
  };
}
