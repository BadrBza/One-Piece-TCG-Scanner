export const DATABASE_SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS portfolio_cards (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    card_number TEXT NOT NULL,
    name TEXT NOT NULL,
    cardmarket_product_id INTEGER NOT NULL,
    image_url TEXT,
    language TEXT,
    rarity TEXT,
    variant TEXT,
    expansion TEXT,
    trend_price REAL,
    price_updated_at TEXT,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK(quantity > 0),
    added_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, cardmarket_product_id)
  );
`;

export const SCHEMA_AUTHENTIFICATION = `
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
`;

export const SCHEMA_PROFIL = `
  ALTER TABLE users ADD COLUMN nickname TEXT;
  ALTER TABLE users ADD COLUMN avatar TEXT;
  PRAGMA user_version = 3;
`;

export const REPRISE_COLLECTION = `
  INSERT INTO portfolio_cards (
    id, user_id, card_number, name, cardmarket_product_id, image_url,
    language, rarity, variant, expansion, trend_price, quantity, added_at
  ) SELECT id, user_id, card_number, name, cardmarket_product_id, image_url,
    language, rarity, variant, expansion, trend_price, quantity, added_at
    FROM portfolio_cards_legacy;
  DROP TABLE portfolio_cards_legacy;
`;

export const SCHEMA_COLLECTION_MULTIJEUX = `
  CREATE TABLE portfolio_cards_multi (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    game TEXT NOT NULL DEFAULT 'one-piece' CHECK(game IN ('one-piece', 'pokemon')),
    identity_key TEXT NOT NULL,
    catalog_id TEXT,
    finish_id TEXT,
    card_number TEXT NOT NULL,
    name TEXT NOT NULL,
    cardmarket_product_id INTEGER,
    image_url TEXT,
    language TEXT,
    rarity TEXT,
    variant TEXT,
    expansion TEXT,
    trend_price REAL,
    price_updated_at TEXT,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK(quantity > 0),
    added_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK((game = 'one-piece' AND cardmarket_product_id IS NOT NULL)
      OR (game = 'pokemon' AND catalog_id IS NOT NULL AND finish_id IS NOT NULL AND language IS NOT NULL AND language IN ('FR', 'EN', 'JP'))),
    UNIQUE(user_id, game, identity_key)
  );
  INSERT INTO portfolio_cards_multi (
    id, user_id, identity_key, card_number, name, cardmarket_product_id, image_url,
    language, rarity, variant, expansion, trend_price, price_updated_at, quantity, added_at
  ) SELECT id, user_id, CAST(cardmarket_product_id AS TEXT), card_number, name, cardmarket_product_id, image_url,
    language, rarity, variant, expansion, trend_price, price_updated_at, quantity, added_at
    FROM portfolio_cards;
  DROP TABLE portfolio_cards;
  ALTER TABLE portfolio_cards_multi RENAME TO portfolio_cards;
  PRAGMA user_version = 5;
`;
