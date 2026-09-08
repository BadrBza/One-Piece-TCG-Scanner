import { request } from './http';

export interface CardRecognition {
  cardNumber: string;
  name: string;
  language: 'EN' | 'JP' | 'FR' | 'CN' | 'KR' | 'UNKNOWN';
  rarity: string | null;
  variant: 'regular' | 'parallel' | 'alternate_art' | 'manga' | 'promo' | 'unknown';
  confidence: number;
}

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

export interface ScanCardResult {
  card: CardRecognition;
  prices: {
    cardmarket: PriceResult;
    ebay: PriceResult;
  };
}

export async function lookupCard(number: string): Promise<ScanCardResult> {
  return request(`/cards/lookup?number=${encodeURIComponent(number.trim())}`);
}

export async function scanCard(
  image: string,
  numberImage?: string,
): Promise<ScanCardResult> {
  return request('/cards/scan', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      image,
      numberImage,
    }),
  });
}
