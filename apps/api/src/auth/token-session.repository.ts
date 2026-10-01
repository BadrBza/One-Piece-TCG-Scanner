import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { profilUtilisateur } from './auth.repository.js';

@Injectable()
export class TokenSessionRepository {
  constructor(private readonly database: DatabaseService) {}

  async creer(id: string, utilisateurId: number, expiration: number, maintenant: number, transaction: Prisma.TransactionClient) {
    await transaction.sessionAuthentification.deleteMany({ where: { expiration: { lte: BigInt(maintenant) } } });
    await transaction.jetonAcces.deleteMany({ where: { expiration: { lte: BigInt(maintenant) } } });
    await transaction.sessionAuthentification.create({ data: { id, utilisateurId, expiration: BigInt(expiration) } });
  }

  async utilisateur(empreinte: string) {
    const jeton = await this.database.client.$transaction(transaction => {
      const maintenant = BigInt(Date.now());
      return transaction.jetonAcces.findFirst({
        where: { empreinte, expiration: { gt: maintenant }, session: {
          expiration: { gt: maintenant },
          utilisateur: { OR: [{ emailVerifieLe: { not: null } }, { dispenseVerification: 1 }] },
        } },
        select: { session: { select: { utilisateur: { select: { id: true, email: true, pseudo: true, avatar: true } } } } },
      });
    });
    return jeton ? profilUtilisateur(jeton.session.utilisateur) : undefined;
  }

  trouver(empreinte: string, transaction: Prisma.TransactionClient) {
    return transaction.jetonRenouvellement.findUnique({ where: { empreinte }, include: { session: true } });
  }

  marquerUtilise(empreinte: string, maintenant: number, transaction: Prisma.TransactionClient) {
    return transaction.jetonRenouvellement.update({ where: { empreinte }, data: { utiliseLe: BigInt(maintenant) } });
  }

  supprimer(id: string, transaction: Prisma.TransactionClient) {
    return transaction.sessionAuthentification.deleteMany({ where: { id } });
  }

  supprimerParJetons(acces: string, renouvellement: string) {
    return this.database.client.$transaction(transaction => transaction.sessionAuthentification.deleteMany({ where: { OR: [
      { acces: { some: { empreinte: acces } } }, { renouvellements: { some: { empreinte: renouvellement } } },
    ] } }));
  }

  async enregistrerJetons(sessionId: string, acces: string, renouvellement: string, expirationAcces: number, transaction: Prisma.TransactionClient) {
    await transaction.jetonAcces.create({ data: { empreinte: acces, sessionId, expiration: BigInt(expirationAcces) } });
    await transaction.jetonRenouvellement.create({ data: { empreinte: renouvellement, sessionId } });
  }
}
