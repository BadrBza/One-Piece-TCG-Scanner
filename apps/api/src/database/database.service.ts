import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { DATABASE_SCHEMA } from '../schemas/database.schema.js';

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
  }

  onModuleDestroy() {
    this.connection.close();
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
