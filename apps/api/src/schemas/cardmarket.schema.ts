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

export type CardmarketData = {
  catalog: z.infer<typeof CardmarketCatalogSchema>;
  guide: z.infer<typeof CardmarketPriceGuideSchema>;
};
