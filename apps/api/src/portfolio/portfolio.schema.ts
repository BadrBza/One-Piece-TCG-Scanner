import { z } from 'zod';
import { isCardNumber, normalizeCardNumber } from '../recognition/card-number.js';

const texteFacultatif = z.string().trim().min(1).max(200).optional();

export const AddPortfolioCardSchema = z.object({
  cardNumber: z.string().max(20).transform(normalizeCardNumber).refine(isCardNumber),
  name: z.string().trim().min(1).max(200),
  cardmarketProductId: z.number().int().positive(),
  imageUrl: z.string().url().max(500).regex(/^https:\/\//).optional(),
  language: texteFacultatif,
  rarity: texteFacultatif,
  variant: texteFacultatif,
  expansion: texteFacultatif,
  trendPrice: z.number().nonnegative().optional(),
});

export type AddPortfolioCard = z.infer<typeof AddPortfolioCardSchema>;

export type PortfolioCard = AddPortfolioCard & {
  id: number;
  quantity: number;
  addedAt: string;
  priceUpdatedAt?: string;
};
