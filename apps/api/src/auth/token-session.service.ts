import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { newToken, tokenHash } from './auth-crypto.js';
import type { SessionTokens } from './auth.schema.js';
import { TokenSessionRepository } from './token-session.repository.js';

const HEURE = 60 * 60 * 1000;

@Injectable()
export class TokenSessionService {
  constructor(
    private readonly database: DatabaseService,
    private readonly sessions: TokenSessionRepository,
  ) {}

  create(utilisateurId: number): SessionTokens {
    return this.database.transaction(() => {
      const maintenant = Date.now();
      const sessionId = newToken();
      const expiration = maintenant + 24 * HEURE;
      this.sessions.creer(sessionId, utilisateurId, expiration, maintenant);
      return this.emettreJetons(sessionId, expiration);
    });
  }

  currentUser(token?: string) {
    return token ? this.sessions.utilisateur(tokenHash(token)) : undefined;
  }

  refresh(token?: string): SessionTokens {
    if (!token) throw new UnauthorizedException('Reconnecte-toi pour continuer.');
    const resultat = this.database.transaction(() => {
      const maintenant = Date.now();
      const empreinte = tokenHash(token);
      const session = this.sessions.trouver(empreinte);
      if (!session || session.expires_at <= maintenant) return { etat: 'expire' as const };
      if (session.used_at !== null) {
        // Deux onglets peuvent envoyer le même cookie avant de recevoir son renouvellement.
        if (maintenant - session.used_at < 10_000) return { etat: 'concurrent' as const };
        this.sessions.supprimer(session.id);
        return { etat: 'expire' as const };
      }
      this.sessions.marquerUtilise(empreinte, maintenant);
      return { etat: 'valide' as const, tokens: this.emettreJetons(session.id, session.expires_at) };
    });
    // La révocation doit être validée avant de retourner une erreur HTTP.
    if (resultat.etat === 'concurrent') throw new ConflictException('Un renouvellement est déjà en cours. Réessaie dans un instant.');
    if (resultat.etat === 'expire') throw new UnauthorizedException('Ta session a expiré. Reconnecte-toi.');
    return resultat.tokens;
  }

  logout(access?: string, refresh?: string) {
    this.sessions.supprimerParJetons(tokenHash(access ?? ''), tokenHash(refresh ?? ''));
  }

  private emettreJetons(sessionId: string, expiresAt: number): SessionTokens {
    const accessToken = newToken();
    const refreshToken = newToken();
    const accessExpiresAt = Math.min(Date.now() + HEURE, expiresAt);
    this.sessions.enregistrerJetons(sessionId, tokenHash(accessToken), tokenHash(refreshToken), accessExpiresAt);
    return { accessToken, refreshToken, accessExpiresAt, expiresAt };
  }
}
