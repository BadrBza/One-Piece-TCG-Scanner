import { Injectable, type OnModuleInit } from '@nestjs/common';
import ky from 'ky';
import { isCardNumber, normalizeCardNumber } from '../../recognition/card-number.js';
import type { CardRecognition } from '../../recognition/card-recognition.schema.js';
import { CardmarketCatalogSchema, CardmarketPriceGuideSchema, type CardmarketData } from '../cardmarket.schema.js';
import type { PriceResult } from '../price-result.js';

@Injectable()
export class CardmarketProvider implements OnModuleInit {
  private productsByNumber = new Map<string, NonNullable<PriceResult['products']>>();
  private pricesById = new Map<number, number>();

  onModuleInit() {
    void this.load().catch(() => undefined);
  }

  private async load(): Promise<CardmarketData> {
    const base = 'https://downloads.s3.cardmarket.com/productCatalog';
    const [catalogJson, guideJson] = await Promise.all([
      ky.get(base + '/productList/products_singles_18.json', { timeout: 20_000, retry: 0 }).json(),
      ky.get(base + '/priceGuide/price_guide_18.json', { timeout: 20_000, retry: 0 }).json(),
    ]);
    const data = {
      catalog: CardmarketCatalogSchema.parse(catalogJson),
      guide: CardmarketPriceGuideSchema.parse(guideJson),
    };
    const prices = new Map(data.guide.priceGuides.map(price => [price.idProduct, price]));
    const productsByNumber = new Map<string, NonNullable<PriceResult['products']>>();
    for (const product of data.catalog.products) {
      const number = /\(([A-Z]+\d*-\d+)\)/.exec(product.name.toUpperCase())?.[1];
      if (!number || !isCardNumber(number)) continue;
      const list = productsByNumber.get(number) ?? [];
      list.push({ id: product.idProduct, name: product.name, trendPrice: prices.get(product.idProduct)?.trend ?? undefined });
      productsByNumber.set(number, list);
    }
    this.productsByNumber = productsByNumber;
    this.pricesById = new Map(data.guide.priceGuides.filter(price => price.trend != null).map(price => [price.idProduct, price.trend!]));
    return data;
  }

  async getPrice(card: CardRecognition): Promise<PriceResult> {
    const base = { source: 'cardmarket', currency: 'EUR' };
    const number = normalizeCardNumber(card.cardNumber);
    if (!isCardNumber(number)) {
      return { ...base, message: 'Saisis le numéro de la carte pour consulter Cardmarket.' };
    }
    try {
      await this.load();
      const products = (this.productsByNumber.get(number) ?? []).map(product => ({ ...product }));
      return { ...base, products,
        message: products.length
          ? 'Fiches correspondant au numéro. Vérifie l’édition et la langue sur Cardmarket : le catalogue ne permet pas de confirmer la variante photographiée. Prix du guide, sans frais de port.'
          : 'Aucune fiche Cardmarket trouvée pour ce numéro.',
      };
    } catch {
      return { ...base, message: 'Les données Cardmarket sont temporairement indisponibles. Réessaie dans un instant.' };
    }
  }

  async getTrendPrices(productIds: number[]) {
    const { guide } = await this.load();
    const prices = new Map<number, number>();
    for (const id of productIds) {
      const price = this.pricesById.get(id);
      if (price !== undefined) prices.set(id, price);
    }
    return { prices, updatedAt: guide.createdAt };
  }
}
