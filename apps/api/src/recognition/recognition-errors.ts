import { BadGatewayException, GatewayTimeoutException, ServiceUnavailableException, type Logger } from '@nestjs/common';
import { APICallError, NoObjectGeneratedError, NoOutputGeneratedError } from 'ai';

import { unwrapProviderError } from './gemini-model.js';

export function throwReadableError(error: unknown, logger: Pick<Logger, 'warn'>): never {
  const invalidObject = NoObjectGeneratedError.isInstance(error) ? error : undefined;
  if (invalidObject || NoOutputGeneratedError.isInstance(error)) {
    const reason = invalidObject?.finishReason ?? 'no-output';
    const tokens = invalidObject?.usage?.outputTokens;
    logger.warn(`Gemini returned invalid output (finishReason=${reason}, outputTokens=${tokens ?? 'unknown'})`);
    throw new BadGatewayException('Gemini n’a pas terminé correctement l’analyse. Réessaie le scan ou utilise la recherche par numéro.');
  }

  const providerError = unwrapProviderError(error);
  const status = APICallError.isInstance(providerError) ? providerError.statusCode : undefined;
  logger.warn(`Gemini recognition failed (${status ?? 'unknown'})`);

  if (APICallError.isInstance(providerError)) {
    const invalidKey = status === 401 || status === 403 ||
      (status === 400 && /API_KEY_INVALID|API key not valid/i.test(providerError.responseBody ?? ''));
    if (invalidKey) throw new ServiceUnavailableException('La clé Gemini est invalide ou son accès est refusé. Remplace-la par la clé complète de Google AI Studio dans .env, puis redémarre le backend.');
    if (status === 429) throw new ServiceUnavailableException('Le quota Gemini est atteint. Vérifie les quotas et la facturation dans Google AI Studio.');
    if (status === 404) throw new ServiceUnavailableException('Le modèle Gemini configuré est indisponible pour ce projet. Vérifie GEMINI_MODEL et les modèles accessibles dans AI Studio.');
    if (status === undefined || status >= 500) throw new ServiceUnavailableException('Les modèles Gemini principal et de secours sont temporairement indisponibles. Réessaie dans un instant.');
  }

  if (error instanceof Error && /Timeout|Abort/i.test(error.name)) {
    throw new GatewayTimeoutException('Gemini met trop de temps à répondre. Réessaie avec une photo plus légère.');
  }
  throw new BadGatewayException('La réponse de Gemini n’a pas pu être traitée. Réessaie ou utilise la recherche par numéro.');
}

export function errorCategory(error: unknown) {
  const providerError = unwrapProviderError(error);
  if (APICallError.isInstance(providerError)) return `provider-${providerError.statusCode ?? 'unknown'}`;
  if (NoObjectGeneratedError.isInstance(error)) return `invalid-output-${error.finishReason}`;
  if (NoOutputGeneratedError.isInstance(error)) return 'no-output';
  return 'unknown';
}
