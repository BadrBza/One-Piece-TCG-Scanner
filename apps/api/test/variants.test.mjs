import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ConfigService } from '@nestjs/config';
import { CardVariantsService } from '../dist/pricing/card-variants.service.js';

const photo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5V8AAAAASUVORK5CYII=';
const products = [{ id: 1, name: 'Luffy', expansionId: 1, trendPrice: 99 }, { id: 2, name: 'Luffy', expansionId: 1, trendPrice: 5 }];

test('manual lookup retains every variant and does not select one automatically', async () => {
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
    const result = await service.variants({ cardNumber: 'OP13-118' }, { source: 'cardmarket', currency: 'EUR', products });
    assert.equal(result.products.length, 2);
    assert.equal(result.products[0].languageLabel, 'Japonais');
    assert.equal(result.products[0].rarity, 'SEC');
    assert.equal(result.products[0].variantLabel, 'Manga');
    assert.equal(result.products[0].trendPrice, 99);
    assert.equal(result.products[0].version, 1);
    assert.equal(result.products[0].expansion, 'Carrying On His Will');
    assert.equal(result.products[1].languageLabel, 'Chinois');
    assert.equal(result.products[1].trendPrice, 5);
    assert.equal(result.selectedProductId, undefined);
  } finally { globalThis.fetch = original; }
});

test('photo comparison selects the exact Cardmarket product and downloads each reference once', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async url => String(url).includes('optcgapi.com')
    ? Response.json([{ rarity: 'SEC', set_name: 'Carrying On His Will' }])
    : Response.json({ candidates: [{ content: { role: 'model', parts: [{ text: JSON.stringify({
      selectedId: '2', confidence: 0.97, items: [
        { id: '1', language: 'Japonais', variant: 'Manga' },
        { id: '2', language: 'Anglais', variant: 'Illustration alternative' },
      ],
    }) }] }, finishReason: 'STOP' }] });
  try {
    let downloads = 0;
    const service = new CardVariantsService(new ConfigService({ GOOGLE_GENERATIVE_AI_API_KEY: 'test' }));
    service.reference = async () => { downloads++; return { data: Buffer.from('reference'), mediaType: 'image/png' }; };
    const result = await service.variants({ cardNumber: 'OP13-118' }, { source: 'cardmarket', currency: 'EUR', products }, photo);
    assert.equal(result.selectedProductId, 2);
    assert.equal(result.matchConfidence, 0.97);
    assert.equal(result.products[1].variantLabel, 'Illustration alternative');
    assert.equal(downloads, 2);
  } finally { globalThis.fetch = original; }
});

test('an invented product id or unavailable references falls back to the variant list', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async url => String(url).includes('optcgapi.com')
    ? Response.json([{ rarity: 'SEC', set_name: 'Set' }])
    : Response.json({ candidates: [{ content: { role: 'model', parts: [{ text: JSON.stringify({
      selectedId: '999', confidence: 1, items: [],
    }) }] }, finishReason: 'STOP' }] });
  try {
    const service = new CardVariantsService(new ConfigService({ GOOGLE_GENERATIVE_AI_API_KEY: 'test' }));
    service.reference = async () => ({ data: Buffer.from('reference'), mediaType: 'image/png' });
    assert.equal((await service.variants({ cardNumber: 'OP13-118' }, { source: 'cardmarket', currency: 'EUR', products }, photo)).selectedProductId, undefined);

    service.reference = async () => { throw new Error('unavailable'); };
    assert.equal((await service.variants({ cardNumber: 'OP13-051' }, { source: 'cardmarket', currency: 'EUR', products }, photo)).selectedProductId, undefined);
  } finally { globalThis.fetch = original; }
});

test('Cardmarket reference images are reused between scans', async () => {
  const original = globalThis.fetch;
  let imageDownloads = 0;
  globalThis.fetch = async url => {
    const target = String(url);
    if (target.includes('optcgapi.com')) {
      return Response.json([{ rarity: 'SEC', set_name: 'Set' }]);
    }
    if (target.includes('cardmarketapi.com/cards/')) {
      imageDownloads++;
      return new Response(Buffer.from('reference'), { headers: { 'content-type': 'image/png' } });
    }
    return Response.json({ candidates: [{ content: { role: 'model', parts: [{ text: JSON.stringify({
      selectedId: '2', confidence: 0.95, items: [],
    }) }] }, finishReason: 'STOP' }] });
  };

  try {
    const service = new CardVariantsService(new ConfigService({ GOOGLE_GENERATIVE_AI_API_KEY: 'test' }));
    const guide = { source: 'cardmarket', currency: 'EUR', products };
    await service.variants({ cardNumber: 'OP13-118' }, guide, photo);
    await service.variants({ cardNumber: 'OP13-118' }, guide, photo);
    assert.equal(imageDownloads, 2);
  } finally { globalThis.fetch = original; }
});
