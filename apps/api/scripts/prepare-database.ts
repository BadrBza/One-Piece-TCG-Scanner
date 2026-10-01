import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { backup, DatabaseSync } from 'node:sqlite';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { cheminDatabase } from '../src/database/database-path.ts';

const dossierApi = fileURLToPath(new URL('..', import.meta.url));
const dossierMigrations = join(dossierApi, 'prisma/migrations');
const cliPrisma = createRequire(import.meta.url).resolve('prisma/build/index.js');
const migrations = readdirSync(dossierMigrations, { withFileTypes: true })
  .filter(entree => entree.isDirectory()).map(entree => ({
    nom: entree.name, sql: readFileSync(join(dossierMigrations, entree.name, 'migration.sql'), 'utf8'),
  })).sort((a, b) => a.nom.localeCompare(b.nom));

function schema(base: DatabaseSync) {
  const objets = base.prepare(`SELECT type, name, sql FROM sqlite_schema
    WHERE name NOT LIKE 'sqlite_%' AND name <> '_prisma_migrations' ORDER BY type, name`).all();
  return objets.map(({ type, name, sql }) => ({ type, name,
    sql: String(sql).replaceAll('"', '').replace(/\s+/g, '').toLowerCase(),
  }));
}

function verifierSchema(base: DatabaseSync, nombreMigrations: number) {
  const reference = new DatabaseSync(':memory:');
  try {
    for (const migration of migrations.slice(0, nombreMigrations)) reference.exec(migration.sql);
    if (JSON.stringify(schema(base)) !== JSON.stringify(schema(reference))) {
      throw new Error('Schéma SQLite inattendu. Migration refusée ; aucune réinitialisation effectuée.');
    }
  } finally { reference.close(); }
}

function verifierIntegrite(base: DatabaseSync) {
  const controles = base.prepare('PRAGMA integrity_check').all();
  if (controles.length !== 1 || controles[0].integrity_check !== 'ok'
    || base.prepare('PRAGMA foreign_key_check').all().length) {
    throw new Error('La base présente une incohérence. Migration refusée ; restaurer une sauvegarde saine.');
  }
}

function etatMigration(chemin: string) {
  if (!existsSync(chemin)) return { vide: true, appliquees: 0 };
  const base = new DatabaseSync(chemin, { readOnly: true });
  try {
    verifierIntegrite(base);
    const historiqueExiste = base.prepare("SELECT name FROM sqlite_schema WHERE name = '_prisma_migrations'").get();
    const historique = historiqueExiste ? base.prepare(`SELECT migration_name, checksum, finished_at
      FROM _prisma_migrations WHERE rolled_back_at IS NULL ORDER BY migration_name`).all() : [];
    for (const [index, ligne] of historique.entries()) {
      const migration = migrations[index];
      if (!migration || ligne.migration_name !== migration.nom || !ligne.finished_at
        || ligne.checksum !== createHash('sha256').update(migration.sql).digest('hex')) {
        throw new Error('Historique Prisma inattendu ou migration inachevée. Vérifie prisma migrate status avant de continuer.');
      }
    }
    const vide = schema(base).length === 0;
    const version = base.prepare('PRAGMA user_version').get()!.user_version;
    if (vide && historique.length === 0 && version === 0) return { vide, appliquees: 0 };
    if (version !== 5) throw new Error(`Version SQLite ${version} non prise en charge : une base v5 est requise, sans réinitialisation.`);
    verifierSchema(base, historique.length || 1);
    return { vide: false, appliquees: historique.length };
  } finally { base.close(); }
}

export async function preparerDatabase(chemin = cheminDatabase()) {
  chemin = resolve(chemin);
  const etat = etatMigration(chemin);
  if (etat.appliquees === migrations.length) {
    console.log('Base Prisma déjà à jour.');
    return;
  }

  mkdirSync(dirname(chemin), { recursive: true });
  let sauvegarde: string | undefined;
  if (existsSync(chemin)) {
    sauvegarde = `${chemin}.backup-${new Date().toISOString().replaceAll(':', '-')}.db`;
    const base = new DatabaseSync(chemin, { readOnly: true });
    try { await backup(base, sauvegarde); } finally { base.close(); }
    console.log(`Sauvegarde : ${sauvegarde}`);
  } else {
    // Le moteur Prisma Windows attend un fichier pour une URL SQLite absolue.
    new DatabaseSync(chemin).close();
  }

  const prisma = (...argumentsCli: string[]) => execFileSync(process.execPath, [cliPrisma, ...argumentsCli], {
    cwd: dossierApi, env: { ...process.env, DATABASE_PATH: chemin }, stdio: 'inherit',
  });
  if (!etat.vide && etat.appliquees === 0) prisma('migrate', 'resolve', '--applied', migrations[0].nom);
  prisma('migrate', 'deploy');
  etatMigration(chemin);
  console.log('Base prête pour Prisma.');
  return sauvegarde;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.chdir(dossierApi);
  for (const fichier of ['.env', '../../.env']) if (existsSync(fichier)) process.loadEnvFile(fichier);
  try { await preparerDatabase(); }
  catch (erreur) {
    console.error(erreur instanceof Error ? erreur.message : 'Préparation de la base impossible.');
    process.exitCode = 1;
  }
}
