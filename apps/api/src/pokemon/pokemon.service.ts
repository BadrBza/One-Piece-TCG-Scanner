import { BadRequestException, Injectable, Logger, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { preparerImagesScan, type DecodedImage } from '../common/image-utils.js';
import { measureScan, mesurerGeneration, scanContext } from '../recognition/scan-metrics.js';
import { genererStructure, reglagesLecture, verifierCleGemini } from '../recognition/gemini-model.js';
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
      const { photo, grosPlan } = preparerImagesScan(image, numberImage);
      const cle = verifierCleGemini(this.config);
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
    const { modele, reasoning } = reglagesLecture(this.config, secours);
    const google = createGoogleGenerativeAI({ apiKey });
    const reponse = await mesurerGeneration(stage, () => genererStructure({
      model: google(modele), system: READ_POKEMON_PROMPT, schema: PokemonReadingSchema, stage,
      content: [
        { type: 'file', data: photo.data, mediaType: photo.mediaType },
        ...(grosPlan ? [{ type: 'file' as const, data: grosPlan.data, mediaType: grosPlan.mediaType }] : []),
      ],
      reasoning, resolution: 'MEDIA_RESOLUTION_HIGH', abortSignal: AbortSignal.timeout(45_000),
    })).catch(erreur => throwReadableError(erreur, this.logger));
    return reponse.output;
  }
}
