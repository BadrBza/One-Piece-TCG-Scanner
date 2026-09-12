import { z } from 'zod';
import { isCardNumber, normalizeCardNumber } from '../recognition/card-number.js';

export const ScanCardSchema = z.object({
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
