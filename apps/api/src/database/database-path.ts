import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function cheminDatabase(chemin = process.env.DATABASE_PATH) {
  return resolve(chemin?.trim() || fileURLToPath(new URL('../../data/app.db', import.meta.url)));
}

export function urlDatabase(chemin = cheminDatabase()) {
  return `file:${chemin.replaceAll('\\', '/')}`;
}
