-- Schéma SQLite v5 existant. Les CHECK restent ici car Prisma ne les représente pas.
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  nickname TEXT, avatar TEXT, email_verified_at TEXT,
  verification_exempt INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);
CREATE TABLE auth_sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE TABLE access_tokens (
  hash TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES auth_sessions(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE TABLE refresh_tokens (
  hash TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES auth_sessions(id) ON DELETE CASCADE,
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
CREATE TABLE portfolio_cards (
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
    OR (game = 'pokemon' AND catalog_id IS NOT NULL AND finish_id IS NOT NULL AND language IN ('FR', 'EN', 'JP'))),
  UNIQUE(user_id, game, identity_key)
);
PRAGMA user_version = 5;
