import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';
import { urlDatabase } from './src/database/database-path.ts';

// Même priorité que ConfigModule ; les variables du processus restent prioritaires.
for (const fichier of ['.env', '../../.env']) {
  if (existsSync(fichier)) process.loadEnvFile(fichier);
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: urlDatabase() },
});
