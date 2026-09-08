import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ConfigService } from '@nestjs/config';
import { RecognitionService } from '../dist/recognition/recognition.service.js';
import { CardsService } from '../dist/cards/cards.service.js';

const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5V8AAAAASUVORK5CYII=';
const card = { cardNumber: 'OP01-001', name: 'Roronoa Zoro', language: 'EN', rarity: 'L', variant: 'regular', confidence: 0.95 };
const config = new ConfigService({ GOOGLE_GENERATIVE_AI_API_KEY: 'test-key', GEMINI_MODEL: 'gemini-3.5-flash' });
const modelReply = (text, finishReason = 'STOP') => Response.json({ candidates: [{ content: { role: 'model', parts: [{ text }] }, finishReason }], usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 10, totalTokenCount: 20 } });
const reply = value => modelReply(JSON.stringify(value));

test('AI SDK sends the image to Gemini, validates the structured result and passes it to pricing', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    assert.match(String(url), /gemini-3\.5-flash:generateContent/);
    const request = JSON.parse(options.body);
    assert.equal(request.contents[0].parts[1].inlineData.mimeType, 'image/png');
    assert.equal(request.contents[0].parts[1].inlineData.data, image.split(',')[1]);
    assert.equal(request.generationConfig.responseMimeType, 'application/json');
    assert.equal(request.generationConfig.maxOutputTokens, 8192);
    return reply(card);
  };
  try {
    let priced;
    const service = new CardsService(new RecognitionService(config), {
      getPrices: async recognized => { priced = recognized; return { cardmarket: { source: 'cardmarket', currency: 'EUR' } }; },
    }, {
      variants: async (_card, guide) => guide,
    });
    const result = await service.scan(image);
    assert.deepEqual(result.card, card);
    assert.deepEqual(priced, card);
  } finally { globalThis.fetch = original; }
});

test('the number crop is labeled as a detail of the same card and sent in one call', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (_url, options) => {
    calls++;
    const parts = JSON.parse(options.body).contents[0].parts;
    assert.equal(parts.filter(part => part.inlineData).length, 2);
    assert.match(parts[2].text, /même carte/);
    assert.equal(parts[3].inlineData.data, image.split(',')[1]);
    return reply(card);
  };
  try {
    assert.deepEqual(await new RecognitionService(config).identify(image, image), card);
    assert.equal(calls, 1);
  } finally { globalThis.fetch = original; }
});

test('truncated or invalid Gemini output is a provider failure, not an unreadable card', async () => {
  const original = globalThis.fetch;
  try {
    for (const [text, finishReason] of [
      ['{"cardNumber":', 'MAX_TOKENS'],
      ['secret-provider-detail', 'STOP'],
      [JSON.stringify({ ...card, language: 'invalid-language' }), 'STOP'],
    ]) {
      globalThis.fetch = async () => modelReply(text, finishReason);
      await assert.rejects(new RecognitionService(config).identify(image), error => {
        assert.equal(error.getStatus(), 502);
        assert.match(error.message, /Gemini n’a pas terminé/);
        assert.doesNotMatch(error.message, /secret-provider-detail|photo nette/);
        return true;
      });
    }
  } finally { globalThis.fetch = original; }
});

test('an unreadable number still returns 422 without inventing a card identity', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => reply({ ...card, cardNumber: 'UNKNOWN', confidence: 0 });
  try {
    await assert.rejects(new RecognitionService(config).identify(image), error => {
      assert.equal(error.getStatus(), 422);
      assert.match(error.message, /numéro de la carte est illisible/);
      return true;
    });
  } finally { globalThis.fetch = original; }
});

test('invalid image and missing key fail before contacting Gemini', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => assert.fail('Must not call Gemini');
  try {
    const service = new RecognitionService(new ConfigService({}));
    for (const invalid of [undefined, 'https://example.com/photo.png', 'data:image/png;base64,xxx']) {
      await assert.rejects(service.identify(invalid), error => error.getStatus() === 400);
    }
    await assert.rejects(service.identify(image), error => error.getStatus() === 503);
  } finally { globalThis.fetch = original; }
});

test('provider errors are actionable without leaking provider responses', async () => {
  const original = globalThis.fetch;
  try {
    for (const [status, message, expected] of [
      [400, 'API key not valid. secret-provider-detail', /clé Gemini est invalide/],
      [429, 'secret-provider-detail', /quota Gemini/],
      [404, 'secret-provider-detail', /modèle Gemini/],
    ]) {
      globalThis.fetch = async () => Response.json({ error: { code: status, message, status: 'INVALID_ARGUMENT' } }, { status });
      await assert.rejects(new RecognitionService(config).identify(image), error => {
        assert.equal(error.getStatus(), 503);
        assert.match(error.message, expected);
        assert.doesNotMatch(error.message, /secret-provider-detail/);
        return true;
      });
    }
  } finally { globalThis.fetch = original; }
});

test('temporary Gemini errors are retried once through AI SDK', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => ++calls === 1
    ? Response.json({ error: { code: 503, message: 'Unavailable', status: 'UNAVAILABLE' } }, { status: 503 })
    : reply(card);
  try {
    assert.deepEqual(await new RecognitionService(config).identify(image), card);
    assert.equal(calls, 2);
  } finally { globalThis.fetch = original; }
});

test('a quota error falls back to the configured model without weakening structured validation', async () => {
  const original = globalThis.fetch;
  const models = [];
  globalThis.fetch = async input => {
    const url = String(input);
    if (url.includes('gemini-3.1-pro-preview')) {
      models.push('pro');
      return Response.json({ error: { code: 429, message: 'Quota exceeded', status: 'RESOURCE_EXHAUSTED' } }, { status: 429 });
    }
    assert.match(url, /gemini-3\.5-flash-lite/);
    models.push('flash');
    return reply(card);
  };
  try {
    const proConfig = new ConfigService({ GOOGLE_GENERATIVE_AI_API_KEY: 'test-key', GEMINI_MODEL: 'gemini-3.1-pro-preview', GEMINI_FALLBACK_MODEL: 'gemini-3.5-flash-lite' });
    assert.deepEqual(await new RecognitionService(proConfig).identify(image), card);
    assert.equal(models.at(-1), 'flash');
    assert.ok(models.includes('pro'));
  } finally { globalThis.fetch = original; }
});
