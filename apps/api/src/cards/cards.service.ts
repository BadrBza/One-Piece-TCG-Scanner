import { Injectable, UnprocessableEntityException } from '@nestjs/common';

import { measureScan, scanContext } from '../recognition/scan-metrics.js';
import { CardmarketProvider } from '../pricing/providers/cardmarket.provider.js';
import { RecognitionService, type LectureCarte } from '../recognition/recognition.service.js';
import { CardVariantsService } from '../pricing/card-variants.service.js';
import { creerCarte, type CardRecognition } from '../recognition/card-recognition.schema.js';
import { illustrerProduit, type PriceResult } from '../pricing/price-result.js';

@Injectable()
export class CardsService {
  constructor(
    private readonly recognitionService: RecognitionService,
    private readonly cardmarket: CardmarketProvider,
    private readonly cardVariants: CardVariantsService,
  ) {}

  async lookup(numero: string) {
    const carte = creerCarte(numero);
    const catalogue = await this.cardmarket.getPrice(carte);
    const produits = catalogue.products?.map(illustrerProduit);
    return {
      card: { ...carte, name: produits?.[0]?.name ?? numero },
      prices: { cardmarket: { ...catalogue, products: produits } },
    };
  }

  async resolve(numero: string, photo: string) {
    const carte = creerCarte(numero);
    const catalogue = await this.cardmarket.getPrice(carte);
    const cote = await this.cardVariants.variants(carte, catalogue, photo);
    const rarete = cote.products?.find(produit => produit.rarity && produit.rarity !== 'Non déterminée')?.rarity;
    return { card: { ...this.completerCarte(carte, cote), rarity: rarete ?? null }, prices: { cardmarket: cote } };
  }

  scan(image: string, numberImage?: string) {
    return scanContext(async () => {
      const lecture = await this.recognitionService.identify(image, numberImage);
      if ('status' in lecture) return lecture;

      const { carte, catalogue } = await this.rechercherApresLecture(lecture);
      if (catalogue.products?.length === 0 && this.recognitionService.optimized) {
        throw new UnprocessableEntityException('Aucune fiche trouvée pour ce numéro. Vérifie-le ou saisis-le manuellement.');
      }
      const cote = await this.cardVariants.variants(carte, catalogue, lecture.photo);
      return {
        card: this.recognitionService.optimized ? this.completerCarte(carte, cote) : carte,
        prices: { cardmarket: cote },
      };
    });
  }

  private async rechercherApresLecture({ carte, photo, secoursUtilise }: LectureCarte) {
    const catalogue = await measureScan('catalog', () => this.cardmarket.getPrice(carte));
    if (catalogue.products?.length !== 0 || secoursUtilise || !this.recognitionService.optimized) {
      return { carte, catalogue };
    }
    const { carte: secours } = await this.recognitionService.readNumberOnly(photo);
    return { carte: secours, catalogue: await measureScan('catalog', () => this.cardmarket.getPrice(secours)) };
  }

  private completerCarte(carte: CardRecognition, cote: PriceResult): CardRecognition {
    const selection = cote.products?.find(produit => produit.id === cote.selectedProductId);
    const produit = selection ?? cote.products?.[0];
    const langues: Record<string, CardRecognition['language']> = { Anglais: 'EN', Japonais: 'JP', Français: 'FR', Chinois: 'CN', Coréen: 'KR' };
    const variantes: Record<string, CardRecognition['variant']> = { Standard: 'regular', Parallèle: 'parallel', 'Illustration alternative': 'alternate_art', Manga: 'manga', Promotionnelle: 'promo' };
    return {
      ...carte,
      name: produit?.name ?? carte.cardNumber,
      rarity: produit?.rarity && produit.rarity !== 'Non déterminée' ? produit.rarity : null,
      confidence: selection ? cote.matchConfidence ?? 0 : 0,
      language: selection ? langues[selection.languageLabel ?? ''] ?? 'UNKNOWN' : 'UNKNOWN',
      variant: selection ? variantes[selection.variantLabel ?? ''] ?? 'unknown' : 'unknown',
    };
  }
}
