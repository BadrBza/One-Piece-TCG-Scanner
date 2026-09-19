import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { DATABASE_SCHEMA } from './database.schema.js';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  readonly connection: DatabaseSync;

  constructor(config: ConfigService) {
    const defaultPath = fileURLToPath(new URL('../../data/app.db', import.meta.url));
    const databasePath = resolve(config.get<string>('DATABASE_PATH')?.trim() || defaultPath);
    mkdirSync(dirname(databasePath), { recursive: true });
    this.connection = new DatabaseSync(databasePath);
    this.connection.exec('PRAGMA foreign_keys = ON');
    this.migrate();
    this.migrateProfile();
    this.migrateAuthentication();
  }

  onModuleDestroy() {
    this.connection.close();
  }

  transaction<T>(run: () => T): T {
    this.connection.exec('SAVEPOINT auth_operation');
    try {
      const result = run();
      this.connection.exec('RELEASE auth_operation');
      return result;
    } catch (error) {
      this.connection.exec('ROLLBACK TO auth_operation; RELEASE auth_operation');
      throw error;
    }
  }

  private migrateAuthentication() {
    const { user_version: version } = this.connection.prepare('PRAGMA user_version').get() as { user_version: number };
    if (version >= 4) return;
    this.transaction(() => {
      this.connection.exec(`
        ALTER TABLE users ADD COLUMN email_verified_at TEXT;
        ALTER TABLE users ADD COLUMN verification_exempt INTEGER NOT NULL DEFAULT 0;
        UPDATE users SET verification_exempt = 1;
        DELETE FROM sessions;
        CREATE TABLE auth_sessions (
          id TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          expires_at INTEGER NOT NULL
        );
        CREATE TABLE access_tokens (
          hash TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES auth_sessions(id) ON DELETE CASCADE,
          expires_at INTEGER NOT NULL
        );
        CREATE TABLE refresh_tokens (
          hash TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES auth_sessions(id) ON DELETE CASCADE,
          used_at INTEGER
        );
        CREATE INDEX access_session ON access_tokens(session_id);
        CREATE INDEX refresh_session ON refresh_tokens(session_id);
        CREATE TABLE pending_registrations (
          hash TEXT PRIMARY KEY, email TEXT NOT NULL, password_hash TEXT NOT NULL,
          nickname TEXT NOT NULL, avatar TEXT, expires_at INTEGER NOT NULL,
          code_hash TEXT, code_expires_at INTEGER NOT NULL DEFAULT 0,
          attempts INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE verification_sends (email TEXT NOT NULL, sent_at INTEGER NOT NULL);
        CREATE INDEX verification_sends_email ON verification_sends(email, sent_at);
        PRAGMA user_version = 4;
      `);
    });
  }

  private migrateProfile() {
    const { user_version: version } = this.connection.prepare('PRAGMA user_version').get() as { user_version: number };
    if (version >= 3) return;
    this.connection.exec('BEGIN IMMEDIATE');
    try {
      this.connection.exec(`
        ALTER TABLE users ADD COLUMN nickname TEXT;
        ALTER TABLE users ADD COLUMN avatar TEXT;
        PRAGMA user_version = 3;
        COMMIT;
      `);
    } catch (error) {
      this.connection.exec('ROLLBACK');
      this.connection.close();
      throw error;
    }
  }

  private migrate() {
    const { user_version: version } = this.connection.prepare('PRAGMA user_version').get() as { user_version: number };
    if (version >= 2) return;

    if (version === 1) {
      this.connection.exec('ALTER TABLE portfolio_cards ADD COLUMN price_updated_at TEXT; PRAGMA user_version = 2');
      return;
    }

    this.connection.exec('BEGIN IMMEDIATE');
    try {
      // Preserve cards created before accounts were fully wired up, and remove the global product uniqueness.
      const previousTable = this.connection.prepare("SELECT name FROM sqlite_schema WHERE type = 'table' AND name = 'portfolio_cards'").get();
      if (previousTable) this.connection.exec('ALTER TABLE portfolio_cards RENAME TO portfolio_cards_legacy');
      this.connection.exec(DATABASE_SCHEMA);
      if (previousTable) {
        this.connection.exec(`
          INSERT INTO portfolio_cards (
            id, user_id, card_number, name, cardmarket_product_id, image_url,
            language, rarity, variant, expansion, trend_price, quantity, added_at
          ) SELECT id, user_id, card_number, name, cardmarket_product_id, image_url,
            language, rarity, variant, expansion, trend_price, quantity, added_at
            FROM portfolio_cards_legacy;
          DROP TABLE portfolio_cards_legacy;
        `);
      }
      this.connection.exec('PRAGMA user_version = 2; COMMIT');
    } catch (error) {
      this.connection.exec('ROLLBACK');
      this.connection.close();
      throw error;
    }
  }
}
