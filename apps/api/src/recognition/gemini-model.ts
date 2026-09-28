import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { APICallError, generateText, Output, type LanguageModel, type UserContent } from 'ai';
import type { z } from 'zod';
import { scanTelemetry } from './scan-metrics.js';

type ReponseStructuree<T> = Pick<Awaited<ReturnType<typeof generateText>>, 'usage' | 'response'> & { output: T };

export function verifierCleGemini(config: ConfigService) {
  const cle = config.get<string>('GOOGLE_GENERATIVE_AI_API_KEY')?.trim();
  if (!cle) throw new ServiceUnavailableException('La clé Gemini est absente. Configure GOOGLE_GENERATIVE_AI_API_KEY dans le fichier .env du serveur.');
  return cle;
}

export function reglagesLecture(config: ConfigService, secours: boolean) {
  return {
    modele: secours
      ? config.get<string>('GEMINI_NUMBER_FALLBACK_MODEL')?.trim() || 'gemini-3.5-flash'
      : config.get<string>('GEMINI_NUMBER_MODEL')?.trim() || 'gemini-3.5-flash-lite',
    reasoning: secours || config.get<string>('SCAN_NUMBER_REASONING') === 'low' ? 'low' as const : 'minimal' as const,
  };
}

export function genererStructure<T>({
  schema, stage, content, resolution = 'MEDIA_RESOLUTION_MEDIUM', reasoning = 'low',
  maxOutputTokens = 2048, maxRetries = 0, ...options
}: {
  model: LanguageModel; schema: z.ZodType<T>; stage: string; system: string; content: UserContent; abortSignal: AbortSignal;
  resolution?: 'MEDIA_RESOLUTION_MEDIUM' | 'MEDIA_RESOLUTION_HIGH';
  reasoning?: 'low' | 'minimal'; maxOutputTokens?: number; maxRetries?: number;
}): Promise<ReponseStructuree<T>> {
  return generateText({
    ...options, reasoning, maxOutputTokens, maxRetries,
    messages: [{ role: 'user', content }], output: Output.object<T>({ schema }),
    telemetry: scanTelemetry(stage), providerOptions: { google: { mediaResolution: resolution } },
  });
}

/** A model-specific quota must not make an otherwise available scanner unusable. */
export async function withGeminiModel<T>(
  config: ConfigService,
  run: (model: LanguageModel) => Promise<T>,
  preferredModel?: string,
): Promise<T> {
  const primary = preferredModel || config.get<string>('GEMINI_MODEL')?.trim() || 'gemini-3.5-flash';
  const fallback = config.get<string>('GEMINI_FALLBACK_MODEL')?.trim() || 'gemini-3.5-flash-lite';
  const google = createGoogleGenerativeAI({ apiKey: config.get<string>('GOOGLE_GENERATIVE_AI_API_KEY')?.trim() });
  try {
    return await run(google(primary));
  } catch (error) {
    const lastError = unwrapProviderError(error);
    const status = APICallError.isInstance(lastError) ? lastError.statusCode : undefined;
    if (primary !== fallback && status !== undefined && (status === 404 || status === 429 || status >= 500)) {
      return run(google(fallback));
    }
    throw error;
  }
}

export function unwrapProviderError(error: unknown) {
  return error && typeof error === 'object' && 'lastError' in error ? error.lastError : error;
}
