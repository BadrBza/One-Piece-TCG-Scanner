-- Garder chaque envoi, y compris ceux qui partagent une adresse et un horodatage.
BEGIN IMMEDIATE;
CREATE TABLE verification_sends_new (
  id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  sent_at INTEGER NOT NULL
);
INSERT INTO verification_sends_new (email, sent_at)
  SELECT email, sent_at FROM verification_sends ORDER BY rowid;
DROP TABLE verification_sends;
ALTER TABLE verification_sends_new RENAME TO verification_sends;
CREATE INDEX verification_sends_email ON verification_sends(email, sent_at);
COMMIT;
