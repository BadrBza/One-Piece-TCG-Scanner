import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { ConfigService } from '@nestjs/config';
import { generateText, Output } from 'ai';

import { IDENTIFY_CARD_PROMPT } from './prompts/identify-card.prompt.js';
import { READ_CARD_NUMBER_PROMPT } from './prompts/read-card-number.prompt.js';
import { CardRecognitionSchema, type CardRecognition } from './card-recognition.schema.js';
import { CardNumberSchema, type CardNumberConfirmation } from '../cards/scan-card.schema.js';
import { isCardNumber, normalizeCardNumber } from './card-number.js';
import { measureScan, recordUsage, scanTelemetry } from './scan-metrics.js';
import { withGeminiModel } from './gemini-model.js';
import { errorCategory, throwReadableError } from './recognition-errors.js';
import { decodeImage, type DecodedImage } from '../common/image-utils.js';

@Injectable()
export class RecognitionService {
  private readonly logger = new Logger(RecognitionService.name);

  constructor(private readonly config: ConfigService) {}

  private readonly fallbackReads = new WeakSet<CardRecognition>();

  canRetryNumber(card: CardRecognition) {
    return this.optimized && !this.fallbackReads.has(card);
  }

  get optimized() { return this.config.get<string>('SCAN_OPTIMIZED') !== 'false'; }

  async readNumberOnly(image: string): Promise<CardRecognition> {
    return this.identifyNumber(image, undefined, true);
  }

  private prepareImages(image: string, numberImage?: string) {
    const photo = decodeImage(image, 7 * 1024 * 1024, 'Importe une photo JPG, PNG ou WebP de 7 Mo maximum.');
    const crop = numberImage === undefined ? undefined : decodeImage(numberImage, 3 * 1024 * 1024, 'Le gros plan du numéro est invalide ou trop volumineux.');
    if (!this.config.get<string>('GOOGLE_GENERATIVE_AI_API_KEY')?.trim()) {
      throw new ServiceUnavailableException('La clé Gemini est absente. Configure GOOGLE_GENERATIVE_AI_API_KEY dans le fichier .env du serveur.');
    }
    return { photo, crop };
  }

  private async identifyNumber(image: string, numberImage?: string, fallbackOnly = false): Promise<CardRecognition> {
    const { photo, crop } = this.prepareImages(image, numberImage);
    let number: string;
    let usedFallback = fallbackOnly;
    try {
      number = normalizeCardNumber(await this.readCardNumber(fallbackOnly ? photo : crop ?? photo, fallbackOnly ? 'fallback' : 'fast'));
      if (!isCardNumber(number) && !usedFallback) {
        usedFallback = true;
        number = normalizeCardNumber(await this.readCardNumber(photo, 'fallback'));
      }
    } catch (error) { throwReadableError(error, this.logger); }
    if (!isCardNumber(number)) throw new UnprocessableEntityException('Le numéro de la carte est illisible. Reprends la photo ou saisis le numéro manuellement.');
    const card: CardRecognition = { cardNumber: number, name: number, language: 'UNKNOWN', rarity: null, variant: 'unknown', confidence: 0 };
    if (usedFallback) this.fallbackReads.add(card);
    return card;
  }

  async identify(image: string, numberImage?: string): Promise<CardRecognition | CardNumberConfirmation> {
    if (this.optimized) return this.identifyNumber(image, numberImage);
    const { photo, crop } = this.prepareImages(image, numberImage);

    let card: CardRecognition;
    let readNumber: string;
    try {
      [card, readNumber] = await Promise.all([
        this.askGemini(photo, crop),
        this.readCardNumber(crop ?? photo).catch(error => {
          this.logger.warn(`Dedicated card-number reading failed: ${errorCategory(error)}`);
          return 'UNKNOWN';
        }),
      ]);
    } catch (error) {
      throwReadableError(error, this.logger);
    }

    const identifiedNumber = normalizeCardNumber(card.cardNumber);
    const dedicatedNumber = normalizeCardNumber(readNumber);
    const identifiedIsValid = isCardNumber(identifiedNumber);
    const dedicatedIsValid = isCardNumber(dedicatedNumber);

    if (!identifiedIsValid && !dedicatedIsValid) {
      throw new UnprocessableEntityException('Le numéro de la carte est illisible ou la photo ne montre pas une carte One Piece. Reprends la photo ou saisis le numéro manuellement.');
    }

    if (identifiedIsValid && dedicatedIsValid && identifiedNumber !== dedicatedNumber) {
      return {
        status: 'number_confirmation_required',
        card: { ...card, cardNumber: identifiedNumber },
        numberCandidates: [identifiedNumber, dedicatedNumber],
      };
    }

    return { ...card, cardNumber: dedicatedIsValid ? dedicatedNumber : identifiedNumber };
  }

  private async askGemini(photo: DecodedImage, crop?: DecodedImage) {
    const response = await measureScan('identify', () => withGeminiModel(this.config, model => generateText({
      model,
      telemetry: scanTelemetry('identify'),
      system: IDENTIFY_CARD_PROMPT,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: 'Identifie cette carte à partir de la photo.' },
          { type: 'file', data: photo.data, mediaType: photo.mediaType },
          ...(crop ? [
            { type: 'text' as const, text: 'Voici un gros plan du bas de la même carte pour lire son numéro. Ce n’est pas une deuxième carte.' },
            { type: 'file' as const, data: crop.data, mediaType: crop.mediaType },
          ] : []),
        ],
      }],
      output: Output.object({ schema: CardRecognitionSchema }),
      reasoning: 'low',
      providerOptions: { google: { mediaResolution: 'MEDIA_RESOLUTION_HIGH' } },
      // Gemini partage cette limite entre son raisonnement et la réponse structurée.
      maxOutputTokens: 8192,
      maxRetries: 1,
      abortSignal: AbortSignal.timeout(120000),
    })));
    recordUsage('identify', response.usage, response.response.modelId);
    return response.output;
  }

  private async readCardNumber(image: DecodedImage, mode: 'fast' | 'fallback' | 'legacy' = 'legacy') {
    const abortSignal = AbortSignal.timeout(45000);
    const stage = mode === 'legacy' ? 'number' : `number-${mode}`;
    const reasoning = mode === 'fast' && this.config.get<string>('SCAN_NUMBER_REASONING') !== 'low' ? 'minimal' : 'low';
    const run = (model: import('ai').LanguageModel) => generateText({
      model,
      telemetry: scanTelemetry(stage),
      system: READ_CARD_NUMBER_PROMPT,
      messages: [{ role: 'user', content: [{ type: 'file', data: image.data, mediaType: image.mediaType }] }],
      output: Output.object({ schema: CardNumberSchema }),
      reasoning,
      providerOptions: { google: { mediaResolution: 'MEDIA_RESOLUTION_HIGH' } },
      maxOutputTokens: 2048,
      maxRetries: 0,
      abortSignal,
    });
    // Optimized reads have an explicit two-attempt budget. Do not stack the
    // generic provider fallback on top of the full-photo fallback.
    const response = await measureScan(stage, () => {
      if (mode === 'legacy') return withGeminiModel(this.config, run);
      const google = createGoogleGenerativeAI({ apiKey: this.config.get<string>('GOOGLE_GENERATIVE_AI_API_KEY')?.trim() });
      const model = mode === 'fast'
        ? this.config.get<string>('GEMINI_NUMBER_MODEL')?.trim() || 'gemini-3.5-flash-lite'
        : this.config.get<string>('GEMINI_NUMBER_FALLBACK_MODEL')?.trim() || 'gemini-3.5-flash';
      return run(google(model));
    });
    recordUsage(stage, response.usage, response.response.modelId);
    return response.output.cardNumber;
  }
}
