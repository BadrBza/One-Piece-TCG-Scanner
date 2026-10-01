import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { Prisma, type Utilisateur } from '../generated/prisma/client.js';

export function profilUtilisateur({ id, email, pseudo, avatar }: Pick<Utilisateur, 'id' | 'email' | 'pseudo' | 'avatar'>) {
  return { id, email, nickname: pseudo, avatar };
}

@Injectable()
export class AuthRepository {
  constructor(private readonly database: DatabaseService) {}

  findUserByEmail(email: string) {
    return this.database.client.$transaction(transaction => transaction.utilisateur.findUnique({ where: { email } }));
  }

  async createUser(email: string, motDePasse: string, pseudo: string, avatar: string | null, transaction: Prisma.TransactionClient) {
    try {
      const utilisateur = await transaction.utilisateur.create({
        data: { email, motDePasse, pseudo, avatar, emailVerifieLe: new Date().toISOString() },
      });
      return profilUtilisateur(utilisateur);
    } catch (erreur) {
      if (erreur instanceof Prisma.PrismaClientKnownRequestError && erreur.code === 'P2002') return undefined;
      throw erreur;
    }
  }
}
