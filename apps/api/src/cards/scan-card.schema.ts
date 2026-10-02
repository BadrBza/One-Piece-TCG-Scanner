import { z } from 'zod';
import { isCardNumber, normalizeCardNumber } from '../recognition/card-number.js';

export const GameSchema = z.enum(['one-piece', 'pokemon']);
export type CardGame = z.infer<typeof GameSchema>;
export const GameSelectionSchema = z.object({ game: GameSchema.default('one-piece') });
export const LookupCardSchema = GameSelectionSchema.extend({ number: z.string().default('') });
export const CardImageParamsSchema = z.object({ productId: z.string().regex(/^[1-9]\d{0,9}$/).transform(Number) });

export const ScanCardSchema = GameSelectionSchema.extend({
  image: z.string(),
  numberImage: z.string().optional(),
});

export const CardNumberSchema = z.object({
  cardNumber: z.string(),
});

export const ResolveCardSchema = z.object({
  cardNumber: z.string().transform(normalizeCardNumber).refine(isCardNumber),
  image: z.string().regex(/^data:image\/(?:jpeg|png|webp);base64,/).max(10_000_000),
});

export type CardNumberConfirmation = {
  status: 'number_confirmation_required';
  card: import('../recognition/card-recognition.schema.js').CardRecognition;
  numberCandidates: [string, string];
};
