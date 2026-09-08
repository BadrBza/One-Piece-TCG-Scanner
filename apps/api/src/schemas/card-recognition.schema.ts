import { z } from 'zod';

export const CardRecognitionSchema = z.object({
  cardNumber: z.string(),
  name: z.string(),
  language: z.enum([
    'EN',
    'JP',
    'FR',
    'CN',
    'KR',
    'UNKNOWN',
  ]).describe('Language of the printed rules text: EN English, JP Japanese, FR French, CN Chinese, KR Korean; UNKNOWN when unreadable. Never infer from artwork.'),
  rarity: z.string().nullable(),
  variant: z.enum([
    'regular',
    'parallel',
    'alternate_art',
    'manga',
    'promo',
    'unknown',
  ]),
  confidence: z
    .number()
    .min(0)
    .max(1),
});

export type CardRecognition =
  z.infer<typeof CardRecognitionSchema>;
