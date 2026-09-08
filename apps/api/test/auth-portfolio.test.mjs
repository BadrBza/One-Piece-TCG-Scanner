import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { FastifyAdapter } from '@nestjs/platform-fastify';

import { AppModule } from '../dist/app.module.js';
import { DatabaseService } from '../dist/database/database.service.js';
import { CardmarketProvider } from '../dist/pricing/providers/cardmarket.provider.js';
import { RecognitionService } from '../dist/recognition/recognition.service.js';
import { CardVariantsService } from '../dist/pricing/card-variants.service.js';
import { DATABASE_SCHEMA } from '../dist/schemas/database.schema.js';

const origin = 'http://localhost:5173';
const credentials = { email: 'alice@example.test', password: 'local-test-password' };
const card = {
  cardNumber: 'OP13-118', name: 'Monkey.D.Luffy', cardmarketProductId: 42,
  imageUrl: 'https://cardmarketapi.com/cards/42/image', language: 'Japonais',
  rarity: 'SEC', variant: 'Manga', expansion: 'Carrying On His Will', trendPrice: 0,
};

async function setup(t, prepareDatabase) {
  const directory = mkdtempSync(join(tmpdir(), 'opscan-tests-'));
  const path = join(directory, 'app.db');
  if (prepareDatabase) prepareDatabase(path);
  let app;
  let scanCalls = 0;
  async function open() {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ConfigService).useValue(new ConfigService({ DATABASE_PATH: path, FRONTEND_URL: origin }))
      .overrideProvider(CardmarketProvider).useValue({ getPrice: async () => ({ source: 'cardmarket', currency: 'EUR', products: [{ id: 42, ...card }] }) })
      .overrideProvider(CardVariantsService).useValue({ variants: async (_card, guide) => guide })
      .overrideProvider(RecognitionService).useValue({ identify: async () => {
        scanCalls++;
        return { cardNumber: card.cardNumber, name: card.name, language: 'JP', rarity: 'SEC', variant: 'manga', confidence: 0.99 };
      } })
      .compile();
    app = module.createNestApplication(new FastifyAdapter(), { logger: false });
    app.setGlobalPrefix('api');
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  }
  t.after(async () => {
    if (app) await app.close();
    assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
    assert.ok(directory.includes('opscan-tests-'));
    rmSync(directory, { recursive: true, force: true });
  });
  await open();
  return {
    get database() { return app.get(DatabaseService).connection; },
    get scanCalls() { return scanCalls; },
    call(method, route, payload, cookie, requestOrigin = origin) {
      return app.inject({ method, url: `/api${route}`, payload, headers: { origin: requestOrigin, ...(cookie ? { cookie } : {}) } });
    },
    async reopen() { await app.close(); app = undefined; await open(); },
  };
}

async function register(server, email = credentials.email) {
  const response = await server.call('POST', '/auth/register', { ...credentials, email });
  assert.equal(response.statusCode, 201);
  return { user: response.json(), cookie: response.headers['set-cookie'].split(';')[0], response };
}

test('login sessions protect scanner and portfolio, expire and are revoked by logout', async t => {
  const server = await setup(t);
  const anonymous = await server.call('GET', '/auth/me');
  assert.equal(anonymous.statusCode, 200);
  assert.equal(anonymous.json(), null);
  assert.equal(anonymous.headers['cache-control'], 'no-store');
  for (const [method, route, payload] of [
    ['GET', '/portfolio'], ['POST', '/portfolio', card],
    ['DELETE', '/portfolio/1'], ['POST', '/cards/scan', { image: 'test' }],
    ['GET', '/cards/lookup?number=OP13-118'],
  ]) assert.equal((await server.call(method, route, payload)).statusCode, 401);
  assert.equal(server.scanCalls, 0);

  const account = await register(server, ' Alice@Example.Test ');
  assert.equal(account.user.email, credentials.email);
  assert.deepEqual(Object.keys(account.user).sort(), ['email', 'id']);
  assert.match(account.response.headers['set-cookie'], /HttpOnly/);
  assert.match(account.response.headers['set-cookie'], /SameSite=Lax/);
  assert.equal(account.response.headers['cache-control'], 'no-store');
  const stored = server.database.prepare('SELECT password_hash FROM users').get();
  assert.notEqual(stored.password_hash, credentials.password);
  const session = server.database.prepare('SELECT token_hash FROM sessions').get();
  assert.notEqual(session.token_hash, account.cookie.split('=')[1]);
  assert.deepEqual((await server.call('GET', '/auth/me', undefined, account.cookie)).json(), account.user);
  assert.equal((await server.call('POST', '/cards/scan', { image: 'test' }, account.cookie)).statusCode, 201);
  assert.equal(server.scanCalls, 1);
  assert.equal((await server.call('POST', '/auth/login', { ...credentials, password: 'wrong-password' })).statusCode, 401);
  assert.equal((await server.call('POST', '/auth/login', { ...credentials, email: 'unknown@example.test' })).statusCode, 401);
  assert.equal((await server.call('POST', '/auth/register', credentials)).statusCode, 409);
  assert.equal((await server.call('POST', '/auth/register', { email: 'invalid', password: 'short' })).statusCode, 400);

  const logout = await server.call('POST', '/auth/logout', undefined, account.cookie);
  assert.equal(logout.statusCode, 201);
  assert.match(logout.headers['set-cookie'], /Max-Age=0/);
  assert.equal((await server.call('GET', '/portfolio', undefined, account.cookie)).statusCode, 401);
  const login = await server.call('POST', '/auth/login', credentials);
  assert.equal(login.statusCode, 201);
  const cookie = login.headers['set-cookie'].split(';')[0];
  server.database.prepare('UPDATE sessions SET expires_at = ?').run('2000-01-01T00:00:00.000Z');
  const expired = await server.call('GET', '/auth/me', undefined, cookie);
  assert.equal(expired.statusCode, 200);
  assert.equal(expired.json(), null);
  assert.equal((await server.call('POST', '/cards/scan', { image: 'test' }, cookie)).statusCode, 401);
});

test('two accounts can own the same variant without reading or deleting each other’s collection', async t => {
  const server = await setup(t);
  const alice = await register(server);
  const bob = await register(server, 'bob@example.test');
  const first = await server.call('POST', '/portfolio', { ...card, userId: bob.user.id }, alice.cookie);
  assert.equal(first.statusCode, 201);
  const id = first.json().id;
  assert.equal(first.json().quantity, 1);
  assert.equal((await server.call('POST', '/portfolio', card, alice.cookie)).json().quantity, 2);
  const bobCards = await server.call('GET', '/portfolio', undefined, bob.cookie);
  assert.deepEqual(bobCards.json(), []);
  assert.equal((await server.call('DELETE', `/portfolio/${id}`, undefined, bob.cookie)).statusCode, 404);
  const second = await server.call('POST', '/portfolio', card, bob.cookie);
  assert.equal(second.statusCode, 201);
  assert.equal(second.json().quantity, 1);
  assert.notEqual(second.json().id, id);
  assert.equal((await server.call('GET', '/portfolio', undefined, alice.cookie)).json()[0].quantity, 2);

  const withoutPrice = { ...card };
  delete withoutPrice.trendPrice;
  assert.equal((await server.call('POST', '/portfolio', withoutPrice, alice.cookie)).json().trendPrice, 0);
  await server.reopen();
  assert.equal((await server.call('GET', '/auth/me', undefined, alice.cookie)).json().email, credentials.email);
  const persisted = (await server.call('GET', '/portfolio', undefined, alice.cookie)).json()[0];
  assert.equal(persisted.quantity, 3);
  for (const key of Object.keys(card)) assert.equal(persisted[key], card[key]);
  assert.equal((await server.call('DELETE', `/portfolio/${id}`, undefined, alice.cookie)).statusCode, 200);
  assert.deepEqual((await server.call('GET', '/portfolio', undefined, alice.cookie)).json(), []);
  assert.equal((await server.call('GET', '/portfolio', undefined, bob.cookie)).json().length, 1);
});

test('portfolio validates input and browser writes reject untrusted origins; login attempts are bounded', async t => {
  const server = await setup(t);
  const alice = await register(server);
  for (const payload of [{ ...card, trendPrice: -1 }, { ...card, cardNumber: 'WRONG' }, { ...card, imageUrl: 'javascript:alert(1)' }]) {
    assert.equal((await server.call('POST', '/portfolio', payload, alice.cookie)).statusCode, 400);
  }
  assert.equal((await server.call('POST', '/portfolio', { ...card, cardNumber: 'p-001' }, alice.cookie)).statusCode, 201);
  for (const route of ['/auth/login', '/auth/register', '/auth/logout', '/portfolio']) {
    assert.equal((await server.call('POST', route, credentials, alice.cookie, 'https://untrusted.example')).statusCode, 403);
  }
  for (let attempt = 0; attempt < 19; attempt++) {
    assert.equal((await server.call('POST', '/auth/login', { ...credentials, password: 'wrong-password' })).statusCode, 401);
  }
  assert.equal((await server.call('POST', '/auth/login', credentials)).statusCode, 429);
});

test('database upgrade preserves an existing card and permits a second owner of its variant', async t => {
  const server = await setup(t, path => {
    const database = new DatabaseSync(path);
    database.exec(DATABASE_SCHEMA.replace('cardmarket_product_id INTEGER NOT NULL,', 'cardmarket_product_id INTEGER NOT NULL UNIQUE,'));
    database.prepare('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)').run(1, 'legacy@example.test', 'unused-test-hash');
    database.prepare('INSERT INTO portfolio_cards (user_id, card_number, name, cardmarket_product_id) VALUES (?, ?, ?, ?)').run(1, card.cardNumber, card.name, 42);
    database.close();
  });
  assert.equal(server.database.prepare('PRAGMA user_version').get().user_version, 1);
  assert.equal(server.database.prepare('SELECT quantity FROM portfolio_cards WHERE user_id = 1').get().quantity, 1);
  const bob = await register(server, 'bob@example.test');
  assert.equal((await server.call('POST', '/portfolio', card, bob.cookie)).statusCode, 201);
  assert.equal(server.database.prepare('SELECT COUNT(*) AS total FROM portfolio_cards').get().total, 2);
});
