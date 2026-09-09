import { z } from 'zod';

const VariantItemSchema = z.object({
  id: z.string(),
  language: z.enum(['Japonais', 'Anglais', 'Français', 'Chinois', 'Coréen', 'Non déterminée']),
  variant: z.enum(['Standard', 'Parallèle', 'Illustration alternative', 'Manga', 'Affiche Wanted', 'Promotionnelle', 'Non déterminée']),
});

export const VariantMetadataSchema = z.object({ items: z.array(VariantItemSchema) });

export const VariantPhotoAnalysisSchema = z.object({
  selectedId: z.string(),
  confidence: z.number().min(0).max(1),
  items: z.array(VariantItemSchema),
});

export const OptcgCardsSchema = z.array(z.object({
  rarity: z.enum(['C', 'UC', 'R', 'SR', 'SEC', 'L', 'P']),
  set_name: z.string().min(1),
}));

export type VariantMetadata = z.infer<typeof VariantMetadataSchema>['items'];
