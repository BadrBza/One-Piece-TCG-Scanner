import { Injectable, type OnModuleInit } from '@nestjs/common';
import { isCardNumber, normalizeCardNumber } from '../../recognition/card-number.js';
import type { CardRecognition } from '../../recognition/card-recognition.schema.js';
import { CardmarketCatalogSchema, CardmarketPriceGuideSchema, type CardmarketData } from '../cardmarket.schema.js';
import type { PriceResult } from '../price-result.js';

@Injectable()
export class CardmarketProvider implements OnModuleInit {
  private cache?: { data: CardmarketData; expires: number };
  private productsByNumber = new Map<string, NonNullable<PriceResult['products']>>();
  private pricesById = new Map<number, number>();
  private pending?: Promise<CardmarketData>;

  onModuleInit() {
    void this.load().catch(() => undefined);
  }

  private async load(): Promise<CardmarketData> {
    if (this.cache && this.cache.expires > Date.now()) return this.cache.data;
    if (this.pending) return this.pending;
    this.pending = (async () => {
      const base = 'https://downloads.s3.cardmarket.com/productCatalog';
      const responses = await Promise.all([
        fetch(base + '/productList/products_singles_18.json', { signal: AbortSignal.timeout(20000) }),
        fetch(base + '/priceGuide/price_guide_18.json', { signal: AbortSignal.timeout(20000) }),
      ]);
      if (responses.some(response => !response.ok)) throw new Error('Cardmarket unavailable');
      const data = {
        catalog: CardmarketCatalogSchema.parse(await responses[0].json()),
        guide: CardmarketPriceGuideSchema.parse(await responses[1].json()),
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
      this.cache = { data, expires: Date.now() + 60 * 60 * 1000 };
      return data;
    })();
    try { return await this.pending; } finally { this.pending = undefined; }
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
