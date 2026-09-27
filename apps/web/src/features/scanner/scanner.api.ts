import { request } from '../../lib/http';

export type CardGame = 'one-piece' | 'pokemon';
export type PokemonLanguage = 'FR' | 'EN' | 'JP';
export type PokemonSearch = { language: PokemonLanguage; name: string; set: string };
export type PokemonCandidate = {
  catalogId: string; cardNumber: string; name: string; language: PokemonLanguage; expansion: string; imageUrl?: string;
};
export type PokemonFinish = { id: string; label: string; cardmarketProductId?: number; trendPrice?: number; priceUpdatedAt?: string };
export type PokemonCard = PokemonCandidate & { rarity?: string; finishes: PokemonFinish[] };
export type PokemonResult = { game: 'pokemon'; card: PokemonCard };
export type PokemonConfirmation = { game: 'pokemon'; status: 'card_confirmation_required'; candidates: PokemonCandidate[] };

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
  game?: 'one-piece';
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

export type ScanCardResult = RecognizedScanResult | NumberConfirmationResult | PokemonResult | PokemonConfirmation;

export function lookupCard(number: string, game: CardGame = 'one-piece', pokemon?: PokemonSearch) {
  const params = new URLSearchParams({ number: number.trim(), game, ...(game === 'pokemon' ? pokemon : {}) });
  return request<RecognizedScanResult | PokemonResult | PokemonConfirmation>(`/cards/lookup?${params}`, {
    timeout: game === 'pokemon' ? 60_000 : 30_000,
  });
}

export function resolveCard(number: string, image: string) {
  return request<RecognizedScanResult>('/cards/resolve', {
    method: 'POST',
    timeout: ANALYSIS_TIMEOUT,
    json: { cardNumber: number, image },
  });
}

export function resolvePokemon(catalogId: string, language: PokemonLanguage) {
  return request<PokemonResult>('/cards/resolve', {
    method: 'POST', timeout: 60_000, json: { game: 'pokemon', catalogId, language },
  });
}

export function scanCard(image: string, numberImage?: string, game: CardGame = 'one-piece') {
  return request<ScanCardResult>('/cards/scan', {
    method: 'POST',
    timeout: ANALYSIS_TIMEOUT,
    json: { image, numberImage, game },
  });
}
