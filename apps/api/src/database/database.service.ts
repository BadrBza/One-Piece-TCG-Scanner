import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { DATABASE_SCHEMA, REPRISE_COLLECTION, SCHEMA_AUTHENTIFICATION, SCHEMA_PROFIL, SCHEMA_COLLECTION_MULTIJEUX } from './database.schema.js';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  readonly connection: DatabaseSync;

  constructor(config: ConfigService) {
    const cheminParDefaut = fileURLToPath(new URL('../../data/app.db', import.meta.url));
    const chemin = resolve(config.get<string>('DATABASE_PATH')?.trim() || cheminParDefaut);
    mkdirSync(dirname(chemin), { recursive: true });
    this.connection = new DatabaseSync(chemin);
    this.connection.exec('PRAGMA foreign_keys = ON');
    this.migrerCollection();
    this.migrerProfil();
    this.migrerAuthentification();
    if (this.versionSchema < 5) this.migration(() => this.connection.exec(SCHEMA_COLLECTION_MULTIJEUX));
  }

  onModuleDestroy() {
    this.connection.close();
  }

  transaction<T>(operation: () => T): T {
    this.connection.exec('SAVEPOINT auth_operation');
    try {
      const resultat = operation();
      this.connection.exec('RELEASE auth_operation');
      return resultat;
    } catch (erreur) {
      this.connection.exec('ROLLBACK TO auth_operation; RELEASE auth_operation');
      throw erreur;
    }
  }

  private get versionSchema() {
    return (this.connection.prepare('PRAGMA user_version').get() as { user_version: number }).user_version;
  }

  private migrerCollection() {
    const version = this.versionSchema;
    if (version >= 2) return;
    if (version === 1) {
      this.connection.exec('ALTER TABLE portfolio_cards ADD COLUMN price_updated_at TEXT; PRAGMA user_version = 2');
      return;
    }
    this.migration(() => {
      // Conserver les cartes antérieures aux comptes et retirer l’unicité globale des produits.
      const ancienneCollection = this.connection.prepare("SELECT name FROM sqlite_schema WHERE type = 'table' AND name = 'portfolio_cards'").get();
      if (ancienneCollection) this.connection.exec('ALTER TABLE portfolio_cards RENAME TO portfolio_cards_legacy');
      this.connection.exec(DATABASE_SCHEMA);
      if (ancienneCollection) this.connection.exec(REPRISE_COLLECTION);
      this.connection.exec('PRAGMA user_version = 2');
    });
  }

  private migrerProfil() {
    if (this.versionSchema >= 3) return;
    this.migration(() => this.connection.exec(SCHEMA_PROFIL));
  }

  private migrerAuthentification() {
    if (this.versionSchema >= 4) return;
    this.transaction(() => this.connection.exec(SCHEMA_AUTHENTIFICATION));
  }

  private migration(operation: () => void) {
    this.connection.exec('BEGIN IMMEDIATE');
    try {
      operation();
      this.connection.exec('COMMIT');
    } catch (erreur) {
      this.connection.exec('ROLLBACK');
      this.connection.close();
      throw erreur;
    }
  }
}
