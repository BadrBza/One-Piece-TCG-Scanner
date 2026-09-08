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

const apiUrl =
  import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';

export async function lookupCard(number: string): Promise<ScanCardResult> {
  let response: Response;
  try {
    response = await fetch(`${apiUrl}/cards/lookup?number=${encodeURIComponent(number.trim())}`);
  } catch {
    throw new Error('Le serveur est inaccessible. Vérifie que le backend est démarré.');
  }
  if (!response.ok) {
    throw new Error(response.status === 400 ? 'Numéro invalide. Exemple : OP01-001.' : 'La recherche a échoué. Réessaie dans un instant.');
  }
  return response.json() as Promise<ScanCardResult>;
}

export async function scanCard(
  image: string,
  numberImage?: string,
): Promise<ScanCardResult> {
  let response: Response;
  try {
    response = await fetch(`${apiUrl}/cards/scan`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      image,
      numberImage,
    }),
    });
  } catch {
    throw new Error('Le serveur de scan est inaccessible. Vérifie que le backend est démarré, puis réessaie.');
  }

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const message = body && typeof body === 'object' && 'message' in body && typeof body.message === 'string'
      ? body.message : `Le serveur n’a pas pu analyser la photo (erreur ${response.status}).`;
    throw new Error(message);
  }

  return response.json() as Promise<ScanCardResult>;
}
