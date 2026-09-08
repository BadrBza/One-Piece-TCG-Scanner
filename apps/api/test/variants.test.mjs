import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ConfigService } from '@nestjs/config';
import { CardVariantsService } from '../dist/pricing/card-variants.service.js';

test('each variant retains its own image, price, rarity and language; no automatic selection', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async url => String(url).includes('optcgapi.com')
    ? Response.json([{ rarity: 'SEC', set_name: 'Carrying On His Will' }])
    : Response.json({ candidates: [{ content: { role: 'model', parts: [{ text: JSON.stringify({ items: [
      { id: '1', language: 'Japonais', rarity: 'SEC', variant: 'Manga' },
      { id: '2', language: 'Chinois', rarity: 'SEC', variant: 'Standard' },
    ] }) }] }, finishReason: 'STOP' }] });
  try {
    const service = new CardVariantsService(new ConfigService({ GOOGLE_GENERATIVE_AI_API_KEY: 'test' }));
    service.reference = async () => ({ data: Buffer.from('test'), mediaType: 'image/png' });
    const result = await service.variants({ cardNumber: 'OP13-118' }, { source: 'cardmarket', currency: 'EUR', products: [{ id: 1, name: 'Luffy', expansionId: 1, trendPrice: 99 }, { id: 2, name: 'Luffy', expansionId: 1, trendPrice: 5 }] });
    assert.equal(result.products.length, 2);
    assert.equal(result.products[0].languageLabel, 'Japonais');
    assert.equal(result.products[0].rarity, 'SEC');
    assert.equal(result.products[0].variantLabel, 'Manga');
    assert.equal(result.products[0].trendPrice, 99);
    assert.equal(result.products[0].version, 1);
    assert.equal(result.products[0].expansion, 'Carrying On His Will');
    assert.equal(result.products[1].languageLabel, 'Chinois');
    assert.equal(result.products[1].trendPrice, 5);
  } finally { globalThis.fetch = original; }
});
