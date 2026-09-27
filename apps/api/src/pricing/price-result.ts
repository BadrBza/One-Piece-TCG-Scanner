export interface PriceResult {
  source: string;
  currency: string;
  message?: string;
  selectedProductId?: number;
  matchConfidence?: number;
  products?: Array<{
    id: number;
    name: string;
    version?: number;
    expansion?: string;
    imageUrl?: string;
    languageLabel?: string;
    rarity?: string;
    variantLabel?: string;
    trendPrice?: number;
  }>;
}

export function illustrerProduit(produit: NonNullable<PriceResult['products']>[number], index: number) {
  return { ...produit, version: index + 1, imageUrl: `https://cardmarketapi.com/cards/${produit.id}/image` };
}
