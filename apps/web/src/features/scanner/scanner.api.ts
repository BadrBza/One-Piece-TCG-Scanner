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

export function lookupCard(number: string) {
  return request<RecognizedScanResult>(`/cards/lookup?number=${encodeURIComponent(number.trim())}`, {
    timeout: 30_000,
  });
}

export function resolveCard(number: string, image: string) {
  return request<RecognizedScanResult>('/cards/resolve', {
    method: 'POST',
    timeout: ANALYSIS_TIMEOUT,
    json: { cardNumber: number, image },
  });
}

export function scanCard(image: string, numberImage?: string) {
  return request<ScanCardResult>('/cards/scan', {
    method: 'POST',
    timeout: ANALYSIS_TIMEOUT,
    json: { image, numberImage },
  });
}
