import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { ConfigService } from '@nestjs/config';
import { RecognitionService } from '../dist/recognition/recognition.service.js';
import { CardsService } from '../dist/cards/cards.service.js';
import { CardVariantsService } from '../dist/pricing/card-variants.service.js';

const png = await sharp({ create: { width: 12, height: 18, channels: 3, background: '#884422' } }).png().toBuffer();
const photo = `data:image/png;base64,${png.toString('base64')}`;
const crop = `data:image/jpeg;base64,${(await sharp(png).jpeg().toBuffer()).toString('base64')}`;
const products = [{ id: 1, name: 'Luffy (OP01-001)', trendPrice: 2 }, { id: 2, name: 'Luffy alternate (OP01-001)', trendPrice: 100 }];
const guide = { source: 'cardmarket', currency: 'EUR', products };
const match = { selectedId: '2', confidence: 0.98, language: 'Anglais', variant: 'Illustration alternative' };
const config = extra => new ConfigService({ GOOGLE_GENERATIVE_AI_API_KEY: 'test', ...extra });
const reply = value => Response.json({ candidates: [{ content: { role: 'model', parts: [{ text: JSON.stringify(value) }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 8, totalTokenCount: 20 } });
const requestUrl = input => typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

async function setup(t, results = [match]) {
  const directory = await mkdtemp(join(tmpdir(), 'scanner-test-'));
  const original = globalThis.fetch;
  const requests = [];
  let downloads = 0;
  globalThis.fetch = async (url, options) => {
    const target = requestUrl(url);
    if (target.includes('optcgapi.com')) return Response.json([{ rarity: 'L', set_name: 'Set' }]);
    if (target.includes('cardmarketapi.com')) {
      downloads++;
      return new Response(png, { headers: { 'content-type': 'image/png' } });
    }
    const request = JSON.parse(options.body);
    requests.push(request);
    return reply(results[Math.min(requests.length - 1, results.length - 1)]);
  };
  t.after(() => { globalThis.fetch = original; });
  const settings = config();
  return { directory, requests, downloads: () => downloads, settings, service: new CardVariantsService(settings) };
}

test('normal scan uses exactly two AI calls and preserves the selected product price and identity', async t => {
  const state = await setup(t, [{ cardNumber: 'OP01-001' }, match]);
  const cards = new CardsService(new RecognitionService(state.settings), { getPrice: async () => guide }, state.service);
  const result = await cards.scan(photo, crop);
  assert.equal(state.requests.length, 2);
  assert.equal(state.requests[0].contents[0].parts[0].inlineData.mimeType, 'image/jpeg');
  const comparison = state.requests[1];
  assert.equal(comparison.contents[0].parts[0].text, 'CARDMARKET REFERENCE ID: 1');
  assert.equal(comparison.contents[0].parts.at(-2).text, 'USER PHOTO');
  assert.ok(!('items' in (comparison.generationConfig.responseJsonSchema ?? comparison.generationConfig.responseSchema).properties));
  assert.equal(result.card.name, products[1].name);
  assert.equal(result.card.language, 'EN');
  assert.equal(result.card.variant, 'alternate_art');
  assert.equal(result.card.confidence, 0.98);
  assert.equal(result.prices.cardmarket.selectedProductId, 2);
  assert.equal(result.prices.cardmarket.products[1].trendPrice, 100);
});

test('unreadable crop retries the full photograph once', async t => {
  const { settings, requests } = await setup(t, [{ cardNumber: 'UNKNOWN' }, { cardNumber: 'OP01-001' }]);
  const recognition = new RecognitionService(settings);
  const card = await recognition.identify(photo, crop);
  assert.equal(card.cardNumber, 'OP01-001');
  assert.equal(requests.length, 2);
  assert.equal(requests[1].contents[0].parts[0].inlineData.mimeType, 'image/png');
  assert.equal(recognition.canRetryNumber(card, crop), false);
});

test('a missing catalog entry retries the number but an unavailable catalog does not', async t => {
  const { settings, requests } = await setup(t, [{ cardNumber: 'OP01-002' }, { cardNumber: 'OP01-001' }]);
  let queries = 0;
  const cards = new CardsService(new RecognitionService(settings), { getPrice: async () => ++queries === 1 ? { ...guide, products: [] } : guide }, { variants: async (_card, value) => value });
  assert.equal((await cards.scan(photo, crop)).card.cardNumber, 'OP01-001');
  assert.equal(requests.length, 2);
  const unavailable = new CardsService(new RecognitionService(settings), { getPrice: async () => ({ source: 'cardmarket', currency: 'EUR', message: 'Unavailable' }) }, { variants: async (_card, value) => value });
  await unavailable.scan(photo, crop);
  assert.equal(requests.length, 3);
});

test('unreadable numbers fail without comparing, and number retry is bounded', async t => {
  const { settings, requests } = await setup(t, [{ cardNumber: 'UNKNOWN' }]);
  await assert.rejects(new RecognitionService(settings).identify(photo, crop), error => error.getStatus() === 422);
  assert.equal(requests.length, 2);
});

test('a successful full-photo retry with no catalog entry never starts a third number read', async t => {
  const { settings, requests } = await setup(t, [{ cardNumber: 'UNKNOWN' }, { cardNumber: 'OP01-001' }]);
  const cards = new CardsService(new RecognitionService(settings), { getPrice: async () => ({ ...guide, products: [] }) }, { variants: async () => assert.fail('No candidates to compare') });
  await assert.rejects(cards.scan(photo, crop), error => error.getStatus() === 422);
  assert.equal(requests.length, 2);
});

test('a sole catalog candidate is still visually verified', async t => {
  const { service, requests } = await setup(t, [{ ...match, selectedId: '1' }]);
  const result = await service.variants({ cardNumber: 'OP01-001' }, { ...guide, products: [products[0]] }, photo);
  assert.equal(result.selectedProductId, 1);
  assert.equal(requests.length, 1);
});

test('unknown language stays unknown when the model cannot determine it', async t => {
  const { service } = await setup(t, [{ ...match, language: 'Non déterminée' }]);
  const cards = new CardsService({ optimized: true }, { getPrice: async () => guide }, service);
  const result = await cards.lookup('OP01-001', photo);
  assert.equal(result.card.language, 'UNKNOWN');
  assert.equal(result.prices.cardmarket.products[1].languageLabel, 'Non déterminée');
});

test('ambiguous match gets exactly one high resolution comparison', async t => {
  const { service, requests } = await setup(t, [{ ...match, confidence: 0.6 }, match]);
  const result = await service.variants({ cardNumber: 'OP01-001' }, guide, photo);
  assert.equal(result.selectedProductId, 2);
  assert.equal(requests.length, 2);
  assert.equal(requests[0].generationConfig.mediaResolution, 'MEDIA_RESOLUTION_MEDIUM');
  assert.equal(requests[1].generationConfig.mediaResolution, 'MEDIA_RESOLUTION_HIGH');
  assert.equal(requests[1].contents[0].parts.at(-1).inlineData.mimeType, 'image/png');
});

test('low confidence, no match and invented IDs never auto-select', async t => {
  for (const result of [{ ...match, confidence: 0.3 }, { ...match, selectedId: null }, { ...match, selectedId: '999' }]) {
    await t.test(String(result.selectedId) + result.confidence, async t => {
      const { service, requests } = await setup(t, [result]);
      const value = await service.variants({ cardNumber: 'OP01-001' }, guide, photo);
      assert.equal(value.selectedProductId, undefined);
      assert.equal(value.products.length, 2);
      assert.equal(requests.length, 2);
    });
  }
});

test('one missing reference prevents selection and explains the incomplete comparison', async t => {
  const { service, requests } = await setup(t);
  service.reference = async product => {
    if (product.id === 1) throw new Error('offline');
    return { data: png, mediaType: 'image/png' };
  };
  const result = await service.variants({ cardNumber: 'OP01-001' }, guide, photo);
  assert.equal(result.selectedProductId, undefined);
  assert.match(result.message, /indisponibles/);
  assert.equal(requests.length, 0);
});

test('Gemini errors preserve all candidates', async t => {
  const { service } = await setup(t);
  service.reference = async () => ({ data: png, mediaType: 'image/png' });
  globalThis.fetch = async () => { throw new Error('offline'); };
  const result = await service.variants({ cardNumber: 'OP01-001' }, guide, photo);
  assert.equal(result.selectedProductId, undefined);
  assert.equal(result.products.length, 2);
});

test('references are downloaded on every scan', async t => {
  const { service, downloads } = await setup(t);
  await service.variants({ cardNumber: 'OP01-001' }, guide, photo);
  await service.variants({ cardNumber: 'OP01-001' }, guide, photo);
  assert.equal(downloads(), 4);
});

test('optional card information does not hold up a match', async t => {
  const { service } = await setup(t);
  service.getCardInfo = () => new Promise(() => {});
  assert.equal((await service.variants({ cardNumber: 'OP01-001' }, guide, photo)).selectedProductId, 2);
});
