import { request } from '../../lib/http';

// Allow for number reading, catalog downloads and variant comparison fallbacks.
const ANALYSIS_TIMEOUT = 5 * 60_000;

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

export interface RecognizedScanResult {
  card: CardRecognition;
  prices: {
    cardmarket: PriceResult;
  };
}

export interface NumberConfirmationResult {
  status: 'number_confirmation_required';
  card: CardRecognition;
  numberCandidates: [string, string];
}

export type ScanCardResult = RecognizedScanResult | NumberConfirmationResult;

export function isNumberConfirmation(result: ScanCardResult): result is NumberConfirmationResult {
  return 'status' in result;
}

export async function lookupCard(number: string): Promise<RecognizedScanResult> {
  return request(`/cards/lookup?number=${encodeURIComponent(number.trim())}`, {
    timeout: 30_000,
    retry: 0,
  });
}

export async function resolveCard(number: string, image: string): Promise<RecognizedScanResult> {
  return request('/cards/resolve', {
    method: 'POST',
    timeout: ANALYSIS_TIMEOUT,
    retry: 0,
    json: { cardNumber: number, image },
  });
}

export async function scanCard(
  image: string,
  numberImage?: string,
): Promise<ScanCardResult> {
  return request('/cards/scan', {
    method: 'POST',
    timeout: ANALYSIS_TIMEOUT,
    retry: 0,
    json: { image, numberImage },
  });
}
