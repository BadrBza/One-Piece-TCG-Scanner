import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync } from 'node:fs';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../generated/prisma/client.js';
import { cheminDatabase, urlDatabase } from './database-path.js';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  // Le pilote partage une connexion : les repositories passent par $transaction
  // pour isoler leurs requêtes des autres transactions en cours.
  readonly client: PrismaClient;

  constructor(config: ConfigService) {
    const chemin = cheminDatabase(config.get<string>('DATABASE_PATH'));
    if (!existsSync(chemin)) throw new Error('Base absente. Lance pnpm --filter @opscan/api db:prepare avant de démarrer l’API.');
    this.client = new PrismaClient({
      adapter: new PrismaBetterSqlite3({ url: urlDatabase(chemin), fileMustExist: true }),
    });
  }

  async onModuleInit() {
    await this.client.$connect();
    try {
      await this.client.envoiVerification.findFirst({ select: { id: true } });
    } catch (cause) {
      await this.client.$disconnect();
      throw new Error('Base non préparée pour Prisma. Lance pnpm --filter @opscan/api db:prepare, API arrêtée.', { cause });
    }
  }
  onModuleDestroy() { return this.client.$disconnect(); }
}
