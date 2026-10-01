import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { newToken, tokenHash } from './auth-crypto.js';
import type { SessionTokens } from './auth.schema.js';
import { TokenSessionRepository } from './token-session.repository.js';
import type { Prisma } from '../generated/prisma/client.js';

const HEURE = 60 * 60 * 1000;

@Injectable()
export class TokenSessionService {
  constructor(
    private readonly database: DatabaseService,
    private readonly sessions: TokenSessionRepository,
  ) {}

  create(utilisateurId: number) {
    return this.database.client.$transaction(transaction => this.creerDansTransaction(utilisateurId, transaction));
  }

  async creerDansTransaction(utilisateurId: number, transaction: Prisma.TransactionClient): Promise<SessionTokens> {
    const maintenant = Date.now();
    const sessionId = newToken();
    const expiration = maintenant + 24 * HEURE;
    await this.sessions.creer(sessionId, utilisateurId, expiration, maintenant, transaction);
    return this.emettreJetons(sessionId, expiration, transaction);
  }

  currentUser(token?: string) {
    return token ? this.sessions.utilisateur(tokenHash(token)) : undefined;
  }

  async refresh(token?: string): Promise<SessionTokens> {
    if (!token) throw new UnauthorizedException('Reconnecte-toi pour continuer.');
    const resultat = await this.database.client.$transaction(async transaction => {
      const maintenant = Date.now();
      const empreinte = tokenHash(token);
      const jeton = await this.sessions.trouver(empreinte, transaction);
      if (!jeton || jeton.session.expiration <= maintenant) return { etat: 'expire' as const };
      const { session, utiliseLe } = jeton;
      if (utiliseLe !== null) {
        // Deux onglets peuvent envoyer le même cookie avant de recevoir son renouvellement.
        if (maintenant - Number(utiliseLe) < 10_000) return { etat: 'concurrent' as const };
        await this.sessions.supprimer(session.id, transaction);
        return { etat: 'expire' as const };
      }
      await this.sessions.marquerUtilise(empreinte, maintenant, transaction);
      return { etat: 'valide' as const, tokens: await this.emettreJetons(session.id, Number(session.expiration), transaction) };
    });
    // La révocation doit être validée avant de retourner une erreur HTTP.
    if (resultat.etat === 'concurrent') throw new ConflictException('Un renouvellement est déjà en cours. Réessaie dans un instant.');
    if (resultat.etat === 'expire') throw new UnauthorizedException('Ta session a expiré. Reconnecte-toi.');
    return resultat.tokens;
  }

  logout(access?: string, refresh?: string) {
    return this.sessions.supprimerParJetons(tokenHash(access ?? ''), tokenHash(refresh ?? ''));
  }

  private async emettreJetons(sessionId: string, expiresAt: number, transaction: Prisma.TransactionClient): Promise<SessionTokens> {
    const accessToken = newToken();
    const refreshToken = newToken();
    const accessExpiresAt = Math.min(Date.now() + HEURE, expiresAt);
    await this.sessions.enregistrerJetons(sessionId, tokenHash(accessToken), tokenHash(refreshToken), accessExpiresAt, transaction);
    return { accessToken, refreshToken, accessExpiresAt, expiresAt };
  }
}
