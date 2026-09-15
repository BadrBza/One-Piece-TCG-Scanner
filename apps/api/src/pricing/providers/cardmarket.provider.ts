import { Injectable, Logger, type OnModuleInit, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LRUCache } from 'lru-cache';
import { measureScan } from '../../recognition/scan-metrics.js';
import { readSnapshot, writeSnapshot } from './cardmarket-snapshot.js';
import ky from 'ky';
import { isCardNumber, normalizeCardNumber } from '../../recognition/card-number.js';
import type { CardRecognition } from '../../recognition/card-recognition.schema.js';
import { CardmarketCatalogSchema, CardmarketPriceGuideSchema, type CardmarketData } from '../cardmarket.schema.js';
import type { PriceResult } from '../price-result.js';

type IndexedCatalog = {
  productsByNumber: Map<string, NonNullable<PriceResult['products']>>;
  pricesById: Map<number, number>;
  updatedAt: string;
};

@Injectable()
export class CardmarketProvider implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CardmarketProvider.name);
  private readonly enabled: boolean;
  private readonly ttl: number;
  private readonly cache: LRUCache<string, IndexedCatalog>;
  private initialization?: Promise<void>;
  private pendingWrite: Promise<void> = Promise.resolve();

  constructor(config: ConfigService) {
    this.enabled = config.get<string>('CARDMARKET_CACHE_ENABLED') !== 'false';
    const ttl = Number(config.get<string>('CARDMARKET_CACHE_TTL_MS') ?? 3_600_000);
    this.ttl = Number.isFinite(ttl) && ttl > 0 ? ttl : 3_600_000;
    this.cache = new LRUCache({
      max: 1,
      ttl: this.ttl,
      noDeleteOnFetchRejection: true,
      fetchMethod: async () => {
        try { return await this.download(); }
        catch (error) {
          this.logger.warn('Actualisation Cardmarket échouée ; la dernière version valide est conservée.');
          throw error;
        }
      },
    });
  }

  onModuleInit() {
    void this.load().catch(() => undefined);
  }

  async onModuleDestroy() {
    await this.pendingWrite;
  }

  private initialize() {
    return this.initialization ??= (async () => {
      const snapshot = await measureScan('catalog-disk', () => readSnapshot());
      if (!snapshot) return;
      const indexed = await measureScan('catalog-index', async () => this.index(snapshot));
      const remaining = this.ttl - (Date.now() - snapshot.fetchedAt);
      this.cache.set('catalog', indexed, {
        ttl: Math.max(1, remaining),
        // Expired disk data must trigger a background refresh immediately.
        ...(remaining <= 0 ? { start: performance.now() - 2 } : {}),
      });
    })();
  }

  private async load(fresh = false): Promise<IndexedCatalog> {
    if (!this.enabled) return this.download();
    await this.initialize();
    return measureScan(fresh ? 'catalog-fresh' : 'catalog-cache', async () => {
      const status: LRUCache.Status<string, IndexedCatalog> = {};
      const data = await this.cache.fetch('catalog', { allowStale: !fresh, forceRefresh: fresh, status });
      this.logger.log(JSON.stringify({ cache: 'cardmarket', result: status.fetch, stale: status.returnedStale ?? false }));
      if (!data) throw new Error('Cardmarket data unavailable');
      return data;
    });
  }

  private async download(): Promise<IndexedCatalog> {
    const base = 'https://downloads.s3.cardmarket.com/productCatalog';
    const [catalogJson, guideJson] = await Promise.all([
      measureScan('catalog-download', () => ky.get(base + '/productList/products_singles_18.json', { timeout: 20_000, retry: 0 }).json()),
      measureScan('prices-download', () => ky.get(base + '/priceGuide/price_guide_18.json', { timeout: 20_000, retry: 0 }).json()),
    ]);
    const snapshot = await measureScan('catalog-validate', async () => ({
      version: 1 as const,
      fetchedAt: Date.now(),
      catalog: CardmarketCatalogSchema.parse(catalogJson),
      guide: CardmarketPriceGuideSchema.parse(guideJson),
    }));
    const indexed = await measureScan('catalog-index', async () => this.index(snapshot));
    if (this.enabled) {
      // Serialize atomic writes without making scans wait for disk I/O.
      this.pendingWrite = this.pendingWrite.then(() => writeSnapshot(snapshot)).catch(() => {
        this.logger.warn('Sauvegarde du cache Cardmarket impossible ; le cache mémoire reste disponible.');
      });
    }
    return indexed;
  }

  private index(data: CardmarketData): IndexedCatalog {
    const pricesById = new Map(data.guide.priceGuides.filter(price => price.trend != null).map(price => [price.idProduct, price.trend!]));
    const guideById = new Map(data.guide.priceGuides.map(price => [price.idProduct, price]));
    const productsByNumber = new Map<string, NonNullable<PriceResult['products']>>();
    for (const product of data.catalog.products) {
      const number = /\(([A-Z]+\d*-\d+)\)/.exec(product.name.toUpperCase())?.[1];
      if (!number || !isCardNumber(number)) continue;
      const list = productsByNumber.get(number) ?? [];
      list.push({ id: product.idProduct, name: product.name, trendPrice: guideById.get(product.idProduct)?.trend ?? undefined });
      productsByNumber.set(number, list);
    }
    return { productsByNumber, pricesById, updatedAt: data.guide.createdAt };
  }

  async getPrice(card: CardRecognition): Promise<PriceResult> {
    const base = { source: 'cardmarket', currency: 'EUR' };
    const number = normalizeCardNumber(card.cardNumber);
    if (!isCardNumber(number)) {
      return { ...base, message: 'Saisis le numéro de la carte pour consulter Cardmarket.' };
    }
    try {
      const data = await this.load();
      const products = (data.productsByNumber.get(number) ?? []).map(product => ({ ...product }));
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
    const data = await this.load(true);
    const prices = new Map<number, number>();
    for (const id of productIds) {
      const price = data.pricesById.get(id);
      if (price !== undefined) prices.set(id, price);
    }
    return { prices, updatedAt: data.updatedAt };
  }
}
