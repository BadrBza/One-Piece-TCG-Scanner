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
