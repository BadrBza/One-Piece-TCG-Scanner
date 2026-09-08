import { z } from 'zod';

const price = z.number().nonnegative().nullable().optional();

export const CardmarketCatalogSchema = z.object({
  products: z.array(z.object({
    idProduct: z.number(),
    name: z.string(),
    idExpansion: z.number(),
  })),
});

export const CardmarketPriceGuideSchema = z.object({
  createdAt: z.string(),
  priceGuides: z.array(z.object({
    idProduct: z.number(),
    low: price,
    trend: price,
    avg1: price,
    avg7: price,
    avg30: price,
  })),
});

export type CardmarketData = {
  catalog: z.infer<typeof CardmarketCatalogSchema>;
  guide: z.infer<typeof CardmarketPriceGuideSchema>;
};
