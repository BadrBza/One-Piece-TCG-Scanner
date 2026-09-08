import { ConfigService } from '@nestjs/config';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { APICallError, type LanguageModel } from 'ai';

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
    const lastError = error && typeof error === 'object' && 'lastError' in error ? error.lastError : error;
    const status = APICallError.isInstance(lastError) ? lastError.statusCode : undefined;
    if (primary !== fallback && status !== undefined && (status === 404 || status === 429 || status >= 500)) {
      return run(google(fallback));
    }
    throw error;
  }
}
