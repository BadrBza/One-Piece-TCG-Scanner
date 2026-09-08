import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CardmarketProvider } from '../dist/pricing/providers/cardmarket.provider.js';

test('Cardmarket preserves distinct editions, missing prices and zero amounts; caches downloads', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async url => {
    calls++;
    return Response.json(url.includes('productList') ? { products: [
      { idProduct: 1, name: 'Zoro (OP01-001)', idExpansion: 10 },
      { idProduct: 2, name: 'Zoro (OP01-001)', idExpansion: 10 },
      { idProduct: 3, name: 'Other (OP01-0010)', idExpansion: 10 },
    ] } : { createdAt: '2026-09-07T02:00:00Z', priceGuides: [
      { idProduct: 1, low: 0, trend: 2.31, avg1: null, avg7: 2.5, avg30: 3 },
    ] });
  };
  try {
    const provider = new CardmarketProvider();
    const result = await provider.getPrice({ cardNumber: 'op01-001' });
    assert.deepEqual(result.products.map(product => product.id), [1, 2]);
    assert.equal(result.products[0].lowestPrice, 0);
    assert.equal(result.products[0].average1, undefined);
    assert.equal(result.products[1].trendPrice, undefined);
    assert.equal(result.updatedAt, '2026-09-07T02:00:00Z');
    assert.deepEqual((await provider.getPrice({ cardNumber: 'OP99-999' })).products, []);
    assert.equal(calls, 2);
  } finally { globalThis.fetch = original; }
});

test('unknown cards do not fetch prices; failed downloads remain retryable', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error('offline'); };
  try {
    const provider = new CardmarketProvider();
    assert.equal((await provider.getPrice({ cardNumber: 'UNKNOWN' })).products, undefined);
    assert.equal(calls, 0);
    const unavailable = await provider.getPrice({ cardNumber: 'OP01-001' });
    assert.match(unavailable.message, /indisponibles/);
    assert.equal(unavailable.products, undefined);
    await provider.getPrice({ cardNumber: 'OP01-001' });
    assert.equal(calls, 4);
  } finally { globalThis.fetch = original; }
});
