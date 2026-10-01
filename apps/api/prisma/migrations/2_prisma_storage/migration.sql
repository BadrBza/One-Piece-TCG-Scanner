-- Aligner les déclarations Prisma sans convertir les valeurs : BIGINT et INTEGER
-- ont la même affinité SQLite. Conserver les CHECK lors des reconstructions.
PRAGMA foreign_keys=OFF;
BEGIN IMMEDIATE;
CREATE TABLE "new_access_tokens" (
    "hash" TEXT NOT NULL PRIMARY KEY,
    "session_id" TEXT NOT NULL,
    "expires_at" BIGINT NOT NULL,
    CONSTRAINT "access_tokens_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "auth_sessions" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
INSERT INTO "new_access_tokens" ("expires_at", "hash", "session_id") SELECT "expires_at", "hash", "session_id" FROM "access_tokens";
DROP TABLE "access_tokens";
ALTER TABLE "new_access_tokens" RENAME TO "access_tokens";
CREATE INDEX "access_session" ON "access_tokens"("session_id");
CREATE TABLE "new_auth_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" INTEGER NOT NULL,
    "expires_at" BIGINT NOT NULL,
    CONSTRAINT "auth_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
INSERT INTO "new_auth_sessions" ("expires_at", "id", "user_id") SELECT "expires_at", "id", "user_id" FROM "auth_sessions";
DROP TABLE "auth_sessions";
ALTER TABLE "new_auth_sessions" RENAME TO "auth_sessions";
CREATE TABLE "new_pending_registrations" (
    "hash" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "avatar" TEXT,
    "expires_at" BIGINT NOT NULL,
    "code_hash" TEXT,
    "code_expires_at" BIGINT NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0
);
INSERT INTO "new_pending_registrations" ("attempts", "avatar", "code_expires_at", "code_hash", "email", "expires_at", "hash", "nickname", "password_hash") SELECT "attempts", "avatar", "code_expires_at", "code_hash", "email", "expires_at", "hash", "nickname", "password_hash" FROM "pending_registrations";
DROP TABLE "pending_registrations";
ALTER TABLE "new_pending_registrations" RENAME TO "pending_registrations";
CREATE TABLE "new_portfolio_cards" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "game" TEXT NOT NULL DEFAULT 'one-piece' CHECK(game IN ('one-piece', 'pokemon')),
    "identity_key" TEXT NOT NULL,
    "catalog_id" TEXT,
    "finish_id" TEXT,
    "card_number" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cardmarket_product_id" INTEGER,
    "image_url" TEXT,
    "language" TEXT,
    "rarity" TEXT,
    "variant" TEXT,
    "expansion" TEXT,
    "trend_price" REAL,
    "price_updated_at" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1 CHECK(quantity > 0),
    "added_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "portfolio_cards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CHECK((game = 'one-piece' AND cardmarket_product_id IS NOT NULL)
      OR (game = 'pokemon' AND catalog_id IS NOT NULL AND finish_id IS NOT NULL AND language IN ('FR', 'EN', 'JP')))
);
INSERT INTO "new_portfolio_cards" ("added_at", "card_number", "cardmarket_product_id", "catalog_id", "expansion", "finish_id", "game", "id", "identity_key", "image_url", "language", "name", "price_updated_at", "quantity", "rarity", "trend_price", "user_id", "variant") SELECT "added_at", "card_number", "cardmarket_product_id", "catalog_id", "expansion", "finish_id", "game", "id", "identity_key", "image_url", "language", "name", "price_updated_at", "quantity", "rarity", "trend_price", "user_id", "variant" FROM "portfolio_cards";
DROP TABLE "portfolio_cards";
ALTER TABLE "new_portfolio_cards" RENAME TO "portfolio_cards";
CREATE UNIQUE INDEX "portfolio_cards_user_id_game_identity_key_key" ON "portfolio_cards"("user_id", "game", "identity_key");
CREATE TABLE "new_refresh_tokens" (
    "hash" TEXT NOT NULL PRIMARY KEY,
    "session_id" TEXT NOT NULL,
    "used_at" BIGINT,
    CONSTRAINT "refresh_tokens_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "auth_sessions" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
INSERT INTO "new_refresh_tokens" ("hash", "session_id", "used_at") SELECT "hash", "session_id", "used_at" FROM "refresh_tokens";
DROP TABLE "refresh_tokens";
ALTER TABLE "new_refresh_tokens" RENAME TO "refresh_tokens";
CREATE INDEX "refresh_session" ON "refresh_tokens"("session_id");
CREATE TABLE "new_sessions" (
    "token_hash" TEXT NOT NULL PRIMARY KEY,
    "user_id" INTEGER NOT NULL,
    "expires_at" TEXT NOT NULL,
    CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
INSERT INTO "new_sessions" ("expires_at", "token_hash", "user_id") SELECT "expires_at", "token_hash", "user_id" FROM "sessions";
DROP TABLE "sessions";
ALTER TABLE "new_sessions" RENAME TO "sessions";
CREATE TABLE "new_users" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nickname" TEXT,
    "avatar" TEXT,
    "email_verified_at" TEXT,
    "verification_exempt" INTEGER NOT NULL DEFAULT 0
);
INSERT INTO "new_users" ("avatar", "created_at", "email", "email_verified_at", "id", "nickname", "password_hash", "verification_exempt") SELECT "avatar", "created_at", "email", "email_verified_at", "id", "nickname", "password_hash", "verification_exempt" FROM "users";
DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE TABLE "new_verification_sends" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "sent_at" BIGINT NOT NULL
);
INSERT INTO "new_verification_sends" ("email", "id", "sent_at") SELECT "email", "id", "sent_at" FROM "verification_sends";
DROP TABLE "verification_sends";
ALTER TABLE "new_verification_sends" RENAME TO "verification_sends";
CREATE INDEX "verification_sends_email" ON "verification_sends"("email", "sent_at");
COMMIT;
PRAGMA foreign_keys=ON;
