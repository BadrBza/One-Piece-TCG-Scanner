import { z } from 'zod';

export const CardmarketCatalogSchema = z.object({
  products: z.array(z.object({
    idProduct: z.number(),
    name: z.string(),
  })),
});

export const CardmarketPriceGuideSchema = z.object({
  createdAt: z.string(),
  priceGuides: z.array(z.object({
    idProduct: z.number(),
    trend: z.number().nonnegative().nullable().optional(),
  })),
});

export const CardmarketDataSchema = z.object({
  catalog: CardmarketCatalogSchema,
  guide: CardmarketPriceGuideSchema,
});
export type CardmarketData = z.infer<typeof CardmarketDataSchema>;
