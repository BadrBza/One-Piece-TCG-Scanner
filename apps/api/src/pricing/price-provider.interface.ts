import type {
  CardRecognition,
} from '../schemas/card-recognition.schema.js';

export interface PriceResult {
  source: string;
  lowestPrice?: number;
  averagePrice?: number;
  trendPrice?: number;
  currency: string;
  message?: string;
  updatedAt?: string;
  products?: Array<{
    id: number;
    name: string;
    expansionId: number;
    version?: number;
    expansion?: string;
    imageUrl?: string;
    languageLabel?: string;
    rarity?: string;
    variantLabel?: string;
    metadataEstimated?: boolean;
    lowestPrice?: number;
    trendPrice?: number;
    average1?: number;
    average7?: number;
    average30?: number;
  }>;
}

export interface PriceProvider {
  getPrice(
    card: CardRecognition,
  ): Promise<PriceResult>;
}
