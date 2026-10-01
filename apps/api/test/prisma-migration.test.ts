import 'reflect-metadata';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { backup, DatabaseSync } from 'node:sqlite';
import { after, test } from 'node:test';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { APP_GUARD } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import cookie from '@fastify/cookie';
import { preparerDatabase } from '../scripts/prepare-database.ts';
import { DatabaseModule } from '../dist/database/database.module.js';
import { DatabaseService } from '../dist/database/database.service.js';
import { AuthModule } from '../dist/auth/auth.module.js';
import { AuthService } from '../dist/auth/auth.service.js';
import { TokenSessionService } from '../dist/auth/token-session.service.js';
import { VerificationService } from '../dist/auth/verification.service.js';
import { VerificationRepository } from '../dist/auth/verification.repository.js';
import { EmailService } from '../dist/auth/email.service.js';
import { OriginGuard } from '../dist/auth/origin.guard.js';
import { tokenHash } from '../dist/auth/auth-crypto.js';
import { AuthRepository } from '../dist/auth/auth.repository.js';
import { PortfolioRepository } from '../dist/portfolio/portfolio.repository.js';
import { PortfolioController } from '../dist/portfolio/portfolio.controller.js';
import { PortfolioPriceUpdater } from '../dist/portfolio/portfolio-price-updater.service.js';
import { TcgdexProvider } from '../dist/pokemon/tcgdex.provider.js';
import type { CardmarketProvider } from '../dist/pricing/providers/cardmarket.provider.js';

const cache = resolve('../../.cache/prisma-verification');
mkdirSync(cache, { recursive: true });
const dossier = mkdtempSync(join(cache, 'verification-'));
const origine = 'http://localhost:5173';
const migrationInitiale = readFileSync(new URL('../prisma/migrations/0_initial/migration.sql', import.meta.url), 'utf8');
after(() => {
  assert.equal(dirname(resolve(dossier)), cache);
  rmSync(dossier, { recursive: true, force: true });
});

function empreinteDonnees(chemin: string) {
  const base = new DatabaseSync(chemin, { readOnly: true });
  try {
    const tables = base.prepare("SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name <> '_prisma_migrations' ORDER BY name").all();
    return tables.map(({ name }) => {
      assert.match(String(name), /^[a-z_]+$/);
      const colonnes = name === 'verification_sends' ? 'email, sent_at' : '*';
      const lignes = base.prepare(`SELECT ${colonnes} FROM ${name} ORDER BY rowid`).all();
      return { table: name, lignes: lignes.length, empreinte: createHash('sha256').update(JSON.stringify(lignes)).digest('hex') };
    });
  } finally { base.close(); }
}

test('reprise de la base active sur copie : données, contraintes et idempotence', async () => {
  const source = resolve('data/app.db');
  const copie = join(dossier, 'copie.db');
  if (existsSync(source)) {
    const base = new DatabaseSync(source, { readOnly: true });
    try { await backup(base, copie); } finally { base.close(); }
  } else {
    const base = new DatabaseSync(copie);
    base.exec(migrationInitiale);
    base.close();
  }
  const avant = empreinteDonnees(copie);
  const sauvegarde = await preparerDatabase(copie);
  assert.deepEqual(empreinteDonnees(copie), avant);
  if (sauvegarde) assert.deepEqual(empreinteDonnees(sauvegarde), avant);
  const contenu = createHash('sha256').update(readFileSync(copie)).digest('hex');
  assert.equal(await preparerDatabase(copie), undefined);
  assert.equal(createHash('sha256').update(readFileSync(copie)).digest('hex'), contenu);
  const controle = new DatabaseSync(copie, { readOnly: true });
  try {
    assert.equal(controle.prepare('PRAGMA integrity_check').get()!.integrity_check, 'ok');
    assert.equal(controle.prepare('PRAGMA foreign_key_check').all().length, 0);
  } finally { controle.close(); }
});

test('base v5 : conserver les doublons d’envoi et refuser les schémas inconnus sans écriture', async () => {
  const chemin = join(dossier, 'doublons.db');
  const base = new DatabaseSync(chemin);
  base.exec(migrationInitiale);
  base.prepare('INSERT INTO verification_sends VALUES (?, ?)').run('doublon@example.test', Date.now());
  base.exec('INSERT INTO verification_sends SELECT * FROM verification_sends');
  base.close();
  const avant = empreinteDonnees(chemin);
  await preparerDatabase(chemin);
  assert.deepEqual(empreinteDonnees(chemin), avant);
  const controle = new DatabaseSync(chemin);
  assert.equal(controle.prepare('SELECT COUNT(DISTINCT id) AS n FROM verification_sends').get()!.n, 2);
  controle.exec('ALTER TABLE users ADD COLUMN surprise TEXT');
  controle.close();
  const empreinte = createHash('sha256').update(readFileSync(chemin)).digest('hex');
  await assert.rejects(preparerDatabase(chemin), /Schéma SQLite inattendu/);
  assert.equal(createHash('sha256').update(readFileSync(chemin)).digest('hex'), empreinte);
  const ancienne = join(dossier, 'ancienne.db');
  const version4 = new DatabaseSync(ancienne);
  version4.exec('PRAGMA user_version = 4');
  version4.close();
  await assert.rejects(preparerDatabase(ancienne), /Version SQLite 4/);
});

test('authentification et collection avec Prisma, sans fournisseur réel', async t => {
  const chemin = join(dossier, 'fonctionnel.db');
  await preparerDatabase(chemin);
  assert.equal(await preparerDatabase(chemin), undefined);
  const codes = new Map<string, string>();
  let panneSmtp = false;
  const emails = {
    configuration: () => ({ from: 'test@example.test', transport: { host: 'local.invalid' } }),
    envoyerCode: async (email: string, code: string) => {
      if (panneSmtp) throw new Error('SMTP simulé indisponible');
      codes.set(email, code);
    },
  };
  let appelsPokemon = 0;
  let panneCatalogue = false;
  const pokemon = { carte: async (catalogId: string, language: string) => {
    appelsPokemon++;
    if (panneCatalogue) throw new Error('Catalogue simulé indisponible');
    return { game: 'pokemon', catalogId, language, name: 'Pikachu', cardNumber: '025',
      finishes: [
        { id: 'normal', label: 'Normal', trendPrice: 4, priceUpdatedAt: '2026-09-30T12:00:00Z' },
        { id: 'holo', label: 'Holo' },
      ],
    };
  } };
  const module = await Test.createTestingModule({
    imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, ignoreEnvVars: true,
      load: [() => ({ DATABASE_PATH: chemin, AUTH_VERIFICATION_SECRET: 'test-uniquement-'.repeat(3), FRONTEND_URL: origine })] }),
    DatabaseModule, AuthModule],
    controllers: [PortfolioController],
    providers: [PortfolioRepository, { provide: TcgdexProvider, useValue: pokemon }, { provide: APP_GUARD, useClass: OriginGuard }],
  }).overrideProvider(EmailService).useValue(emails).compile();
  const app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), { logger: false });
  await app.register(cookie);
  app.setGlobalPrefix('api');
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  t.after(() => app.close());
  const db = app.get(DatabaseService).client;
  const verification = app.get(VerificationService);
  const inscriptions = app.get(VerificationRepository);
  const sessions = app.get(TokenSessionService);
  const auth = app.get(AuthService);
  const collection = app.get(PortfolioRepository);
  const identifiants = { email: 'alice@example.test', password: 'mot-de-passe-test', nickname: 'Alice' };
  const statut = (code: number) => (erreur: unknown) => (erreur as { getStatus(): number }).getStatus() === code;
  const appeler = (method: 'GET' | 'POST' | 'DELETE', route: string, payload?: object, cookies?: string) => app.inject({
    method, url: `/api${route}`, payload, headers: { origin: origine, ...(cookies ? { cookie: cookies } : {}) },
  });

  const inscription = await verification.register(identifiants);
  assert.equal(inscription.emailSent, true);
  await assert.rejects(auth.login(identifiants), statut(401));
  const code = codes.get(identifiants.email)!;
  const incorrect = code === '000000' ? '111111' : '000000';
  await assert.rejects(verification.verify(inscription.token, incorrect), statut(400));
  assert.equal((await inscriptions.trouver(tokenHash(inscription.token)))!.tentatives, 1);
  const compte = await verification.verify(inscription.token, code);
  assert.deepEqual(Object.keys(compte.user).sort(), ['avatar', 'email', 'id', 'nickname']);
  assert.equal(await inscriptions.trouver(tokenHash(inscription.token)), null);
  assert.equal((await sessions.currentUser(compte.tokens.accessToken))!.id, compte.user.id);
  assert.ok(Math.abs(compte.tokens.accessExpiresAt - Date.now() - 3_600_000) < 3_000);
  await assert.rejects(verification.register(identifiants), statut(409));
  await assert.rejects(auth.login({ ...identifiants, password: 'incorrect' }), statut(401));
  assert.equal((await auth.login(identifiants)).user.id, compte.user.id);
  await db.$transaction(async transaction => {
    const doublon = await app.get(AuthRepository).createUser(identifiants.email, 'jamais enregistré', 'Doublon', null, transaction);
    assert.equal(doublon, undefined);
    assert.equal(await transaction.utilisateur.count({ where: { email: identifiants.email } }), 1);
  });

  // Deux demandes concurrentes ne doivent émettre qu’une paire de tokens.
  const rotations = await Promise.allSettled([sessions.refresh(compte.tokens.refreshToken), sessions.refresh(compte.tokens.refreshToken)]);
  assert.equal(rotations.filter(resultat => resultat.status === 'fulfilled').length, 1);
  const refus = rotations.find(resultat => resultat.status === 'rejected');
  assert.ok(refus?.status === 'rejected' && statut(409)(refus.reason));
  await db.jetonRenouvellement.update({ where: { empreinte: tokenHash(compte.tokens.refreshToken) }, data: { utiliseLe: BigInt(Date.now() - 11_000) } });
  await assert.rejects(sessions.refresh(compte.tokens.refreshToken), statut(401));
  assert.equal(await sessions.currentUser(compte.tokens.accessToken), undefined);
  const expire = await sessions.create(compte.user.id);
  await db.jetonAcces.update({ where: { empreinte: tokenHash(expire.accessToken) }, data: { expiration: BigInt(Date.now() - 1) } });
  assert.equal(await sessions.currentUser(expire.accessToken), undefined);
  const sessionExpiree = await db.jetonRenouvellement.findUniqueOrThrow({ where: { empreinte: tokenHash(expire.refreshToken) } });
  await db.sessionAuthentification.update({ where: { id: sessionExpiree.sessionId }, data: { expiration: BigInt(Date.now() - 1) } });
  await assert.rejects(sessions.refresh(expire.refreshToken), statut(401));

  const inscriptionLimitee = await verification.register({ ...identifiants, email: 'limite@example.test' });
  const cleLimitee = tokenHash(inscriptionLimitee.token);
  await assert.rejects(verification.send(inscriptionLimitee.token), statut(429));
  const fauxCode = codes.get('limite@example.test') === '000000' ? '111111' : '000000';
  for (let n = 0; n < 5; n++) await assert.rejects(verification.verify(inscriptionLimitee.token, fauxCode), statut(400));
  await assert.rejects(verification.verify(inscriptionLimitee.token, codes.get('limite@example.test')!), statut(400));
  assert.equal((await inscriptions.trouver(cleLimitee))!.tentatives, 5);
  await db.inscriptionEnAttente.update({ where: { empreinte: cleLimitee }, data: { tentatives: 0, expirationCode: BigInt(Date.now() - 1) } });
  await assert.rejects(verification.verify(inscriptionLimitee.token, codes.get('limite@example.test')!), statut(400));
  await db.envoiVerification.updateMany({ where: { email: 'limite@example.test' }, data: { envoi: BigInt(Date.now() - 61_000) } });
  await db.envoiVerification.createMany({ data: Array.from({ length: 4 }, () => ({ email: 'limite@example.test', envoi: BigInt(Date.now() - 61_000) })) });
  await assert.rejects(verification.send(inscriptionLimitee.token), statut(429));
  panneSmtp = true;
  const nonEnvoyee = await verification.register({ ...identifiants, email: 'smtp@example.test' });
  assert.equal(nonEnvoyee.emailSent, false);
  assert.equal((await verification.status(nonEnvoyee.token))!.emailSent, false);
  panneSmtp = false;
  await db.envoiVerification.deleteMany({ where: { email: 'limite@example.test' } });
  const renvois = await Promise.allSettled([verification.send(inscriptionLimitee.token), verification.send(inscriptionLimitee.token)]);
  assert.equal(renvois.filter(resultat => resultat.status === 'fulfilled').length, 1);
  assert.equal(renvois.filter(resultat => resultat.status === 'rejected' && statut(429)(resultat.reason)).length, 1);

  const autreInscription = await verification.register({ ...identifiants, email: 'bob@example.test' });
  const autre = await verification.verify(autreInscription.token, codes.get('bob@example.test')!);
  const carte = { game: 'one-piece' as const, cardNumber: 'OP01-001', name: 'Luffy', cardmarketProductId: 42, trendPrice: 0 };
  // Une opération indépendante ne doit ni lire ni rejoindre une transaction annulée.
  const demarree = Promise.withResolvers<void>();
  const terminer = Promise.withResolvers<void>();
  const annulation = db.$transaction(async transaction => {
    await transaction.utilisateur.update({ where: { id: compte.user.id }, data: { pseudo: 'Non validé' } });
    demarree.resolve();
    await terminer.promise;
    throw new Error('Annulation simulée');
  });
  const annulationAttendue = assert.rejects(annulation, /Annulation simulée/);
  await demarree.promise;
  const lectureConcurrente = Promise.resolve(app.get(AuthRepository).findUserByEmail(identifiants.email));
  const ajoutConcurrent = collection.add(compte.user.id, { ...carte, cardmarketProductId: 777 });
  await new Promise<void>(resolve => setTimeout(resolve, 25));
  terminer.resolve();
  await annulationAttendue;
  assert.equal((await lectureConcurrente)!.pseudo, 'Alice');
  const carteConcurrente = await ajoutConcurrent;
  assert.ok((await collection.list(compte.user.id)).some(carte => carte.id === carteConcurrente.id));
  await collection.remove(compte.user.id, carteConcurrente.id);
  const ajouts = await Promise.all(Array.from({ length: 8 }, () => collection.add(compte.user.id, carte)));
  assert.equal(new Set(ajouts.map(carte => carte.id)).size, 1);
  assert.equal((await collection.list(compte.user.id))[0].quantity, 8);
  await collection.add(compte.user.id, { ...carte, trendPrice: 12.5 });
  const sansPrix = await collection.add(compte.user.id, { ...carte, name: 'Nom différent', trendPrice: undefined });
  assert.equal(sansPrix.quantity, 10);
  assert.equal(sansPrix.trendPrice, 12.5);
  assert.equal(sansPrix.name, 'Luffy');
  assert.equal(await collection.remove(autre.user.id, sansPrix.id), false);
  assert.equal((await collection.list(compte.user.id)).length, 1);

  const cartePokemon = { game: 'pokemon' as const, catalogId: 'base1-25', cardNumber: '025', name: 'Pikachu', language: 'FR' as const, finishId: 'normal', cardmarketProductId: 99, trendPrice: 2 };
  const normal = await collection.add(compte.user.id, cartePokemon);
  const holo = await collection.add(compte.user.id, { ...cartePokemon, finishId: 'holo', trendPrice: 6 });
  await collection.add(autre.user.id, cartePokemon);
  await collection.add(compte.user.id, { ...cartePokemon, language: 'EN' });
  await collection.add(compte.user.id, { ...cartePokemon, language: 'JP', cardmarketProductId: undefined });
  assert.notEqual(normal.id, holo.id);
  assert.equal((await collection.cartesPokemon()).length, 3);
  const fournisseur = { getTrendPrices: async () => {
    if (panneCatalogue) throw new Error('Catalogue simulé indisponible');
    return { prices: new Map([[42, 15]]), updatedAt: '2026-09-30T12:00:00Z' };
  } } as unknown as CardmarketProvider;
  const actualisation = new PortfolioPriceUpdater(collection, fournisseur, pokemon as unknown as TcgdexProvider);
  await actualisation.refreshDaily();
  assert.equal(appelsPokemon, 3);
  let cartes = await collection.list(compte.user.id);
  assert.equal(cartes.find(carte => carte.id === sansPrix.id)!.trendPrice, 15);
  assert.equal(cartes.find(carte => carte.id === normal.id)!.trendPrice, 4);
  assert.equal(cartes.find(carte => carte.id === holo.id)!.trendPrice, 6);
  panneCatalogue = true;
  await actualisation.refreshDaily();
  assert.deepEqual(await collection.list(compte.user.id), cartes);
  panneCatalogue = false;

  assert.equal((await appeler('GET', '/portfolio')).statusCode, 401);
  assert.equal((await appeler('GET', '/auth/me')).statusCode, 401);
  const inscriptionHttp = await appeler('POST', '/auth/register', { ...identifiants, email: 'http@example.test' });
  assert.equal(inscriptionHttp.statusCode, 201);
  assert.deepEqual(Object.keys(inscriptionHttp.json()).sort(), ['email', 'emailSent', 'status']);
  const attenteCookie = inscriptionHttp.cookies.find(cookie => cookie.name === 'pending_registration')!;
  const validationHttp = await appeler('POST', '/auth/verify', { code: codes.get('http@example.test') }, `pending_registration=${attenteCookie.value}`);
  assert.equal(validationHttp.statusCode, 201);
  assert.deepEqual(Object.keys(validationHttp.json()).sort(), ['avatar', 'email', 'id', 'nickname']);
  assert.ok(validationHttp.cookies.some(cookie => cookie.name === 'access_token' && cookie.httpOnly));
  const connexion = await appeler('POST', '/auth/login', identifiants);
  assert.equal(connexion.statusCode, 201);
  const cookies = connexion.cookies.filter(cookie => cookie.value).map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
  const entetesCookies = String(connexion.headers['set-cookie']);
  assert.match(entetesCookies, /HttpOnly/);
  assert.match(entetesCookies, /SameSite=Lax/);
  assert.equal((await appeler('GET', '/auth/me', undefined, cookies)).json().id, compte.user.id);
  const suppressionInterdite = await appeler('DELETE', `/portfolio/${sansPrix.id}`, undefined, `access_token=${autre.tokens.accessToken}`);
  assert.equal(suppressionInterdite.statusCode, 404);
  assert.equal((await appeler('POST', '/auth/refresh', undefined, cookies)).statusCode, 201);
  assert.equal((await appeler('POST', '/auth/logout', undefined, cookies)).statusCode, 201);
  assert.equal((await appeler('GET', '/portfolio', undefined, cookies)).statusCode, 401);
  assert.equal(await collection.remove(compte.user.id, sansPrix.id), true);

  // Les contraintes SQL restent actives avec le pilote Prisma, cascades comprises.
  await assert.rejects(db.carteCollection.update({ where: { id: normal.id }, data: { quantite: 0 } }));
  await assert.rejects(db.carteCollection.update({ where: { id: normal.id }, data: { jeu: 'inconnu' } }));
  await assert.rejects(db.carteCollection.update({ where: { id: normal.id }, data: { catalogueId: null } }));
  await assert.rejects(db.carteCollection.create({ data: { utilisateurId: 999999, jeu: 'one-piece', identite: '1', numero: 'OP01-001', nom: 'Invalide', produitCardmarketId: 1 } }));
  const jetonAutre = await db.jetonAcces.findUniqueOrThrow({ where: { empreinte: tokenHash(autre.tokens.accessToken) } });
  await db.utilisateur.delete({ where: { id: autre.user.id } });
  assert.equal(await db.sessionAuthentification.count({ where: { id: jetonAutre.sessionId } }), 0);
  assert.equal(await db.jetonAcces.count({ where: { sessionId: jetonAutre.sessionId } }), 0);
  assert.equal((await collection.list(autre.user.id)).length, 0);
});
