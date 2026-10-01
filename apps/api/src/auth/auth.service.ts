import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthRepository, profilUtilisateur } from './auth.repository.js';
import { TokenSessionService } from './token-session.service.js';
import { passwordMatches } from './auth-crypto.js';
import type { AuthenticatedSession, Credentials } from './auth.schema.js';

@Injectable()
export class AuthService {
  constructor(private readonly users: AuthRepository, private readonly sessions: TokenSessionService) {}

  async login(identifiants: Credentials): Promise<AuthenticatedSession> {
    const compte = await this.users.findUserByEmail(identifiants.email);
    if (!compte || !await passwordMatches(identifiants.password, compte.motDePasse)
      || !(compte.emailVerifieLe || compte.dispenseVerification)) {
      throw new UnauthorizedException('Adresse e-mail ou mot de passe incorrect.');
    }
    const user = profilUtilisateur(compte);
    return { user, tokens: await this.sessions.create(user.id) };
  }

  currentUser(accessToken?: string) { return this.sessions.currentUser(accessToken); }
}
