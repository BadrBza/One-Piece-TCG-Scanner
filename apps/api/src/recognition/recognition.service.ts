import {
  BadGatewayException,
  BadRequestException,
  GatewayTimeoutException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APICallError, generateText, NoObjectGeneratedError, NoOutputGeneratedError, Output } from 'ai';

import { IDENTIFY_CARD_PROMPT } from './prompts/identify-card.prompt.js';
import { READ_CARD_NUMBER_PROMPT } from './prompts/read-card-number.prompt.js';
import { CardRecognitionSchema, type CardRecognition } from './card-recognition.schema.js';
import { CardNumberSchema, type CardNumberConfirmation } from '../cards/scan-card.schema.js';
import { isCardNumber, normalizeCardNumber } from './card-number.js';
import { unwrapProviderError, withGeminiModel } from './gemini-model.js';

type ImageData = { data: Buffer; mediaType: string };

const IMAGE_PATTERN = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/;

function decodeImage(value: string, maxBytes: number, errorMessage: string): ImageData {
  const match = IMAGE_PATTERN.exec(value);
  if (!match || match[2].length % 4 !== 0) throw new BadRequestException(errorMessage);

  const data = Buffer.from(match[2], 'base64');
  if (!data.length || data.length > maxBytes) throw new BadRequestException(errorMessage);
  return { data, mediaType: match[1] };
}

@Injectable()
export class RecognitionService {
  private readonly logger = new Logger(RecognitionService.name);

  constructor(private readonly config: ConfigService) {}

  async identify(image: string, numberImage?: string): Promise<CardRecognition | CardNumberConfirmation> {
    const photo = decodeImage(image, 7 * 1024 * 1024, 'Importe une photo JPG, PNG ou WebP de 7 Mo maximum.');
    const crop = numberImage === undefined
      ? undefined
      : decodeImage(numberImage, 3 * 1024 * 1024, 'Le gros plan du numéro est invalide ou trop volumineux.');

    if (!this.config.get<string>('GOOGLE_GENERATIVE_AI_API_KEY')?.trim()) {
      throw new ServiceUnavailableException('La clé Gemini est absente. Configure GOOGLE_GENERATIVE_AI_API_KEY dans le fichier .env du serveur.');
    }

    let card: CardRecognition;
    let readNumber = 'UNKNOWN';
    try {
      [card, readNumber] = await Promise.all([
        this.askGemini(photo, crop),
        this.readCardNumber(crop ?? photo).catch(error => {
          this.logger.warn(`Dedicated card-number reading failed: ${this.errorCategory(error)}`);
          return 'UNKNOWN';
        }),
      ]);
    } catch (error) {
      this.throwReadableError(error);
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

  private async askGemini(photo: ImageData, crop?: ImageData) {
    const response = await withGeminiModel(this.config, model => generateText({
      model,
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
    }));
    return response.output;
  }

  private async readCardNumber(image: ImageData) {
    const response = await withGeminiModel(this.config, model => generateText({
      model,
      system: READ_CARD_NUMBER_PROMPT,
      messages: [{ role: 'user', content: [{ type: 'file', data: image.data, mediaType: image.mediaType }] }],
      output: Output.object({ schema: CardNumberSchema }),
      reasoning: 'low',
      providerOptions: { google: { mediaResolution: 'MEDIA_RESOLUTION_HIGH' } },
      maxOutputTokens: 2048,
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(45000),
    }));
    return response.output.cardNumber;
  }

  private throwReadableError(error: unknown): never {
    const invalidObject = NoObjectGeneratedError.isInstance(error) ? error : undefined;
    if (invalidObject || NoOutputGeneratedError.isInstance(error)) {
      const reason = invalidObject?.finishReason ?? 'no-output';
      const tokens = invalidObject?.usage?.outputTokens;
      this.logger.warn(`Gemini returned invalid output (finishReason=${reason}, outputTokens=${tokens ?? 'unknown'})`);
      throw new BadGatewayException('Gemini n’a pas terminé correctement l’analyse. Réessaie le scan ou utilise la recherche par numéro.');
    }

    const providerError = unwrapProviderError(error);
    const status = APICallError.isInstance(providerError) ? providerError.statusCode : undefined;
    this.logger.warn(`Gemini recognition failed (${status ?? 'unknown'})`);

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

  private errorCategory(error: unknown) {
    const providerError = unwrapProviderError(error);
    if (APICallError.isInstance(providerError)) return `provider-${providerError.statusCode ?? 'unknown'}`;
    if (NoObjectGeneratedError.isInstance(error)) return `invalid-output-${error.finishReason}`;
    if (NoOutputGeneratedError.isInstance(error)) return 'no-output';
    return 'unknown';
  }
}
