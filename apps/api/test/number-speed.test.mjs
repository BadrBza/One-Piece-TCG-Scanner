import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ConfigService } from '@nestjs/config';
import { RecognitionService } from '../dist/recognition/recognition.service.js';
import { CardsService } from '../dist/cards/cards.service.js';

const photo = 'data:image/png;base64,aW1hZ2U=';
const crop = 'data:image/jpeg;base64,Y3JvcA==';
const reply = cardNumber => Response.json({ candidates: [{ content: { role: 'model', parts: [{ text: JSON.stringify({ cardNumber }) }] }, finishReason: 'STOP' }] });

function setup(t, replies, extra = {}) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), body: JSON.parse(options.body) });
    assert.ok(calls.length <= replies.length, 'Unexpected additional model attempt');
    return replies[calls.length - 1]();
  };
  t.after(() => { globalThis.fetch = original; });
  const recognition = new RecognitionService(new ConfigService({ GOOGLE_GENERATIVE_AI_API_KEY: 'test', ...extra }));
  return { calls, recognition };
}

function assertAttempt(call, model, reasoning, image) {
  assert.ok(call.url.includes(`${model}:generateContent`));
  assert.equal(call.body.generationConfig.thinkingConfig.thinkingLevel, reasoning);
  assert.equal(call.body.generationConfig.responseMimeType, 'application/json');
  assert.equal(call.body.contents[0].parts[0].inlineData.data, image.split(',')[1]);
}

test('fast number reading uses Lite/minimal independently of general and comparison models', async t => {
  const { recognition, calls } = setup(t, [() => reply(' op01-001 ')], { GEMINI_MODEL: 'another-model', GEMINI_VARIANT_MODEL: 'another-variant-model' });
  assert.equal((await recognition.identify(photo, crop)).cardNumber, 'OP01-001');
  assert.equal(calls.length, 1);
  assertAttempt(calls[0], 'gemini-3.5-flash-lite', 'minimal', crop);
});

test('both UNKNOWN and invalid format use one Flash/low full-photo fallback', async t => {
  for (const number of ['UNKNOWN', 'OP01-0010']) await t.test(number, async t => {
    const { recognition, calls } = setup(t, [() => reply(number), () => reply('OP01-001')]);
    const card = await recognition.identify(photo, crop);
    assert.equal(card.cardNumber, 'OP01-001');
    assert.equal(recognition.canRetryNumber(card), false);
    assertAttempt(calls[1], 'gemini-3.5-flash', 'low', photo);
    assert.equal(calls.length, 2);
  });
});

test('without a crop, an unreadable fast reading still gets the stronger fallback', async t => {
  const { recognition, calls } = setup(t, [() => reply('UNKNOWN'), () => reply('OP01-001')]);
  await recognition.identify(photo);
  assertAttempt(calls[0], 'gemini-3.5-flash-lite', 'minimal', photo);
  assertAttempt(calls[1], 'gemini-3.5-flash', 'low', photo);
});

test('catalog miss without a crop gets at most one stronger read', async t => {
  const { recognition, calls } = setup(t, [() => reply('OP01-001'), () => reply('OP01-002')]);
  const cards = new CardsService(recognition, { getPrice: async () => ({ products: [] }) }, { variants: () => assert.fail('No candidates') });
  await assert.rejects(cards.scan(photo), error => error.getStatus() === 422);
  assertAttempt(calls[1], 'gemini-3.5-flash', 'low', photo);
  assert.equal(calls.length, 2);
});

test('two invalid readings fail without a third attempt', async t => {
  const { recognition, calls } = setup(t, [() => reply('UNKNOWN'), () => reply('UNKNOWN')]);
  await assert.rejects(recognition.identify(photo, crop), error => error.getStatus() === 422);
  assert.equal(calls.length, 2);
});

test('provider errors never invoke automatic retries or the generic model fallback', async t => {
  for (const status of [400, 401, 404, 429, 503]) await t.test(String(status), async t => {
    const failure = () => Response.json({ error: { code: status, message: 'provider detail', status: 'ERROR' } }, { status });
    const { recognition, calls } = setup(t, [failure], { GEMINI_FALLBACK_MODEL: 'must-not-run' });
    await assert.rejects(recognition.identify(photo, crop));
    assert.equal(calls.length, 1);
  });
});

test('provider failure on the explicit fallback cannot start a third attempt', async t => {
  const { recognition, calls } = setup(t, [() => reply('UNKNOWN'), () => Response.json({ error: { code: 503, message: 'Unavailable' } }, { status: 503 })]);
  await assert.rejects(recognition.identify(photo, crop));
  assert.equal(calls.length, 2);
});

test('malformed structured output stays a provider error', async t => {
  const { recognition, calls } = setup(t, [() => Response.json({ candidates: [{ content: { role: 'model', parts: [{ text: '{broken' }] }, finishReason: 'STOP' }] })]);
  await assert.rejects(recognition.identify(photo, crop), error => error.getStatus() === 502);
  assert.equal(calls.length, 1);
});

test('previous model and reasoning can be restored through configuration', async t => {
  const { recognition, calls } = setup(t, [() => reply('OP01-001')], { GEMINI_NUMBER_MODEL: 'gemini-3.5-flash', SCAN_NUMBER_REASONING: 'low' });
  await recognition.identify(photo, crop);
  assertAttempt(calls[0], 'gemini-3.5-flash', 'low', crop);
});
