import { z } from 'zod';
import { isCardNumber, normalizeCardNumber } from '../recognition/card-number.js';
import { PokemonLanguageSchema, PokemonNumberSchema } from '../pokemon/pokemon.schema.js';

const texteFacultatif = z.string().trim().min(1).max(200).optional();

const InformationsCarteSchema = z.object({
  name: z.string().trim().min(1).max(200),
  imageUrl: z.string().url().max(500).regex(/^https:\/\//).optional(),
  language: texteFacultatif,
  rarity: texteFacultatif,
  variant: texteFacultatif,
  expansion: texteFacultatif,
  trendPrice: z.number().nonnegative().optional(),
});

export const AddPortfolioCardSchema = z.union([
  InformationsCarteSchema.extend({
    game: z.literal('one-piece').default('one-piece'),
    cardNumber: z.string().max(20).transform(normalizeCardNumber).refine(isCardNumber),
    cardmarketProductId: z.number().int().positive(),
  }),
  InformationsCarteSchema.extend({
    game: z.literal('pokemon'),
    cardNumber: PokemonNumberSchema,
    catalogId: z.string().regex(/^[a-zA-Z0-9.-]+$/).max(100),
    finishId: z.string().min(1).max(150),
    language: PokemonLanguageSchema,
    cardmarketProductId: z.number().int().positive().optional(),
    priceUpdatedAt: z.string().datetime({ offset: true }).optional(),
  }),
]);

export type AddPortfolioCard = z.infer<typeof AddPortfolioCardSchema>;

export type PortfolioCard = AddPortfolioCard & {
  id: number;
  quantity: number;
  addedAt: string;
  priceUpdatedAt?: string;
};
