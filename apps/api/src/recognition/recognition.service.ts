import {
  Injectable,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { ConfigService } from '@nestjs/config';
import type { LanguageModel } from 'ai';

import { IDENTIFY_CARD_PROMPT } from './prompts/identify-card.prompt.js';
import { READ_CARD_NUMBER_PROMPT } from './prompts/read-card-number.prompt.js';
import { CardRecognitionSchema, creerCarte, type CardRecognition } from './card-recognition.schema.js';
import { CardNumberSchema, type CardNumberConfirmation } from '../cards/scan-card.schema.js';
import { isCardNumber, normalizeCardNumber } from './card-number.js';
import { mesurerGeneration } from './scan-metrics.js';
import { genererStructure, reglagesLecture, verifierCleGemini, withGeminiModel } from './gemini-model.js';
import { errorCategory, throwReadableError } from './recognition-errors.js';
import { preparerImagesScan, type DecodedImage } from '../common/image-utils.js';

export type LectureCarte = { carte: CardRecognition; photo: DecodedImage; secoursUtilise: boolean };

@Injectable()
export class RecognitionService {
  private readonly logger = new Logger(RecognitionService.name);

  constructor(private readonly config: ConfigService) {}

  get optimized() { return this.config.get<string>('SCAN_OPTIMIZED') !== 'false'; }

  async identify(image: string, numberImage?: string): Promise<LectureCarte | CardNumberConfirmation> {
    const { photo, grosPlan } = preparerImagesScan(image, numberImage);
    verifierCleGemini(this.config);
    return this.optimized ? this.identifierNumero(photo, grosPlan) : this.identifierAncienParcours(photo, grosPlan);
  }

  readNumberOnly(photo: DecodedImage) {
    verifierCleGemini(this.config);
    return this.identifierNumero(photo, undefined, true);
  }

  private async identifierNumero(photo: DecodedImage, grosPlan?: DecodedImage, secoursUniquement = false): Promise<LectureCarte> {
    const lectures = secoursUniquement ? ['fallback'] as const : ['fast', 'fallback'] as const;
    for (const mode of lectures) {
      const numero = normalizeCardNumber(await this.lireNumero(mode === 'fast' ? grosPlan ?? photo : photo, mode)
        .catch(erreur => throwReadableError(erreur, this.logger)));
      if (!isCardNumber(numero)) continue;
      return { carte: creerCarte(numero), photo, secoursUtilise: mode === 'fallback' };
    }
    throw new UnprocessableEntityException('Le numéro de la carte est illisible. Reprends la photo ou saisis le numéro manuellement.');
  }

  private async identifierAncienParcours(photo: DecodedImage, grosPlan?: DecodedImage): Promise<LectureCarte | CardNumberConfirmation> {
    const [carte, lectureNumero] = await Promise.all([
      this.identifierAvecGemini(photo, grosPlan),
      this.lireNumero(grosPlan ?? photo).catch(erreur => {
        this.logger.warn(`Dedicated card-number reading failed: ${errorCategory(erreur)}`);
        return 'UNKNOWN';
      }),
    ]).catch(erreur => throwReadableError(erreur, this.logger));

    const numeroIdentifie = normalizeCardNumber(carte.cardNumber);
    const numeroLu = normalizeCardNumber(lectureNumero);
    const identificationValide = isCardNumber(numeroIdentifie);
    const lectureValide = isCardNumber(numeroLu);

    if (!identificationValide && !lectureValide) {
      throw new UnprocessableEntityException('Le numéro de la carte est illisible ou la photo ne montre pas une carte One Piece. Reprends la photo ou saisis le numéro manuellement.');
    }

    if (identificationValide && lectureValide && numeroIdentifie !== numeroLu) {
      return {
        status: 'number_confirmation_required',
        card: { ...carte, cardNumber: numeroIdentifie },
        numberCandidates: [numeroIdentifie, numeroLu],
      };
    }

    return { carte: { ...carte, cardNumber: lectureValide ? numeroLu : numeroIdentifie }, photo, secoursUtilise: false };
  }

  private async identifierAvecGemini(photo: DecodedImage, grosPlan?: DecodedImage) {
    const reponse = await mesurerGeneration('identify', () => withGeminiModel(this.config, model => genererStructure({
      model, stage: 'identify', schema: CardRecognitionSchema, system: IDENTIFY_CARD_PROMPT,
      content: [
        { type: 'text', text: 'Identifie cette carte à partir de la photo.' },
        { type: 'file', data: photo.data, mediaType: photo.mediaType },
        ...(grosPlan ? [
          { type: 'text' as const, text: 'Voici un gros plan du bas de la même carte pour lire son numéro. Ce n’est pas une deuxième carte.' },
          { type: 'file' as const, data: grosPlan.data, mediaType: grosPlan.mediaType },
        ] : []),
      ],
      resolution: 'MEDIA_RESOLUTION_HIGH',
      // Gemini partage cette limite entre son raisonnement et la réponse structurée.
      maxOutputTokens: 8192,
      maxRetries: 1,
      abortSignal: AbortSignal.timeout(120000),
    })));
    return reponse.output;
  }

  private async lireNumero(image: DecodedImage, mode: 'fast' | 'fallback' | 'legacy' = 'legacy') {
    const abortSignal = AbortSignal.timeout(45000);
    const stage = mode === 'legacy' ? 'number' : `number-${mode}`;
    const { modele, reasoning } = reglagesLecture(this.config, mode !== 'fast');
    const generer = (model: LanguageModel) => genererStructure({
      model, stage, schema: CardNumberSchema, system: READ_CARD_NUMBER_PROMPT,
      content: [{ type: 'file', data: image.data, mediaType: image.mediaType }],
      reasoning, resolution: 'MEDIA_RESOLUTION_HIGH', abortSignal,
    });
    // Les lectures optimisées ont un seul budget de deux tentatives, sans secours fournisseur supplémentaire.
    const reponse = await mesurerGeneration(stage, () => {
      if (mode === 'legacy') return withGeminiModel(this.config, generer);
      const google = createGoogleGenerativeAI({ apiKey: this.config.get<string>('GOOGLE_GENERATIVE_AI_API_KEY')?.trim() });
      return generer(google(modele));
    });
    return reponse.output.cardNumber;
  }
}
