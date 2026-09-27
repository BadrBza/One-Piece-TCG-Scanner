import { BadRequestException, Injectable, Logger, ServiceUnavailableException, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText, Output } from 'ai';
import { decodeImage, type DecodedImage } from '../common/image-utils.js';
import { measureScan, recordUsage, scanContext, scanTelemetry } from '../recognition/scan-metrics.js';
import { throwReadableError } from '../recognition/recognition-errors.js';
import { TcgdexProvider } from './tcgdex.provider.js';
import { READ_POKEMON_PROMPT } from './read-pokemon.prompt.js';
import {
  PokemonLookupSchema, PokemonReadingSchema, type PokemonCandidate, type PokemonConfirmation,
  type PokemonLanguage, type PokemonLookup, type PokemonResult,
} from './pokemon.schema.js';

@Injectable()
export class PokemonService {
  private readonly logger = new Logger(PokemonService.name);
  constructor(private readonly config: ConfigService, private readonly catalogue: TcgdexProvider) {}

  async lookup(recherche: PokemonLookup) {
    const candidates = await this.rechercher(recherche);
    if (!candidates.length) throw new UnprocessableEntityException('Aucune carte Pokémon trouvée. Vérifie le numéro, le nom, la langue et l’extension.');
    return this.resultat(candidates);
  }

  async resolve(catalogId: string, language: PokemonLanguage): Promise<PokemonResult> {
    return { game: 'pokemon', card: await measureScan('pokemon-card', () => this.catalogue.carte(catalogId, language)) };
  }

  scan(image: string, numberImage?: string) {
    return scanContext(async () => {
      const photo = decodeImage(image, 7 * 1024 * 1024, 'Importe une photo JPG, PNG ou WebP de 7 Mo maximum.');
      const grosPlan = numberImage === undefined ? undefined : decodeImage(numberImage, 3 * 1024 * 1024, 'Le gros plan du numéro est invalide ou trop volumineux.');
      const cle = this.config.get<string>('GOOGLE_GENERATIVE_AI_API_KEY')?.trim();
      if (!cle) throw new ServiceUnavailableException('La clé Gemini est absente. Configure GOOGLE_GENERATIVE_AI_API_KEY dans le fichier .env du serveur.');
      // Un seul budget pour lecture illisible et numéro absent du catalogue.
      for (const secours of [false, true]) {
        const lecture = await this.lireCarte(photo, secours ? undefined : grosPlan, cle, secours);
        if (!lecture.number || lecture.language === 'UNKNOWN') continue;
        const recherche = PokemonLookupSchema.safeParse({
          number: lecture.total && !lecture.number.includes('/') ? `${lecture.number}/${lecture.total}` : lecture.number,
          language: lecture.language, name: lecture.name ?? '', set: lecture.set ?? '',
        });
        if (!recherche.success) continue;
        const { number, name, set } = recherche.data;
        if (!number.includes('/') && !name && !set) continue;
        const candidates = await this.rechercher(recherche.data).catch(erreur => {
          // Seule une référence incomplète justifie une nouvelle lecture, jamais une panne fournisseur.
          if (erreur instanceof BadRequestException && !secours) return [];
          throw erreur;
        });
        if (candidates.length) return this.resultat(candidates);
      }
      throw new UnprocessableEntityException('La carte Pokémon n’a pas pu être identifiée. Reprends la photo ou précise sa référence, son nom et son extension manuellement.');
    });
  }

  private rechercher(recherche: PokemonLookup) {
    return measureScan('pokemon-catalog', () => this.catalogue.rechercher(recherche));
  }

  private resultat(candidates: PokemonCandidate[]): Promise<PokemonResult> | PokemonConfirmation {
    return candidates.length === 1 ? this.resolve(candidates[0].catalogId, candidates[0].language)
      : { game: 'pokemon', status: 'card_confirmation_required', candidates };
  }

  private async lireCarte(photo: DecodedImage, grosPlan: DecodedImage | undefined, apiKey: string, secours: boolean) {
    const stage = secours ? 'pokemon-number-fallback' : 'pokemon-number-fast';
    const modele = secours
      ? this.config.get<string>('GEMINI_NUMBER_FALLBACK_MODEL')?.trim() || 'gemini-3.5-flash'
      : this.config.get<string>('GEMINI_NUMBER_MODEL')?.trim() || 'gemini-3.5-flash-lite';
    const google = createGoogleGenerativeAI({ apiKey });
    const reponse = await measureScan(stage, () => generateText({
      model: google(modele), system: READ_POKEMON_PROMPT, telemetry: scanTelemetry(stage),
      messages: [{ role: 'user', content: [
        { type: 'file', data: photo.data, mediaType: photo.mediaType },
        ...(grosPlan ? [{ type: 'file' as const, data: grosPlan.data, mediaType: grosPlan.mediaType }] : []),
      ] }],
      output: Output.object({ schema: PokemonReadingSchema }),
      reasoning: secours || this.config.get<string>('SCAN_NUMBER_REASONING') === 'low' ? 'low' : 'minimal',
      providerOptions: { google: { mediaResolution: 'MEDIA_RESOLUTION_HIGH' } },
      maxOutputTokens: 2048, maxRetries: 0, abortSignal: AbortSignal.timeout(45_000),
    })).catch(erreur => throwReadableError(erreur, this.logger));
    recordUsage(stage, reponse.usage, reponse.response.modelId);
    return reponse.output;
  }
}
