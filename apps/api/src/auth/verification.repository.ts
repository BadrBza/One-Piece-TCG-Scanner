import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import type { InscriptionEnAttente, Prisma } from '../generated/prisma/client.js';

type NouvelleInscription = Omit<InscriptionEnAttente, 'empreinteCode' | 'expirationCode' | 'tentatives'>;

@Injectable()
export class VerificationRepository {
  constructor(private readonly database: DatabaseService) {}

  creer(inscription: NouvelleInscription) {
    return this.database.client.$transaction(async transaction => {
      await transaction.inscriptionEnAttente.deleteMany({ where: { expiration: { lte: BigInt(Date.now()) } } });
      await transaction.inscriptionEnAttente.create({ data: inscription });
    });
  }

  trouver(empreinte: string, transaction?: Prisma.TransactionClient) {
    const lire = (client: Prisma.TransactionClient) => client.inscriptionEnAttente.findFirst({
      where: { empreinte, expiration: { gt: BigInt(Date.now()) } },
    });
    return transaction ? lire(transaction) : this.database.client.$transaction(lire);
  }

  compterTentative(empreinte: string, transaction: Prisma.TransactionClient) {
    return transaction.inscriptionEnAttente.update({ where: { empreinte }, data: { tentatives: { increment: 1 } } });
  }

  supprimer(empreinte: string, transaction: Prisma.TransactionClient) {
    return transaction.inscriptionEnAttente.deleteMany({ where: { empreinte } });
  }

  supprimerPourEmail(email: string, transaction: Prisma.TransactionClient) {
    return transaction.inscriptionEnAttente.deleteMany({ where: { email } });
  }

  annulerCode(empreinte: string, empreinteCode: string) {
    return this.database.client.$transaction(transaction => transaction.inscriptionEnAttente.updateMany({
      where: { empreinte, empreinteCode }, data: { empreinteCode: null },
    }));
  }

  async compterEnvois(email: string, maintenant: number, transaction: Prisma.TransactionClient) {
    await transaction.envoiVerification.deleteMany({ where: { envoi: { lte: BigInt(maintenant - 60 * 60_000) } } });
    return transaction.envoiVerification.aggregate({ where: { email }, _count: true, _max: { envoi: true } });
  }

  async enregistrerCode(inscription: InscriptionEnAttente, empreinteCode: string, maintenant: number, transaction: Prisma.TransactionClient) {
    await transaction.envoiVerification.create({ data: { email: inscription.email, envoi: BigInt(maintenant) } });
    await transaction.inscriptionEnAttente.update({ where: { empreinte: inscription.empreinte },
      data: { empreinteCode, expirationCode: BigInt(maintenant + 10 * 60_000), tentatives: 0 } });
  }
}
