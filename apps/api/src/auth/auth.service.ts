import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthRepository } from './auth.repository.js';
import { TokenSessionService } from './token-session.service.js';
import { passwordMatches } from './auth-crypto.js';
import type { AuthenticatedSession, Credentials } from './auth.schema.js';

@Injectable()
export class AuthService {
  constructor(private readonly users: AuthRepository, private readonly sessions: TokenSessionService) {}

  async login(identifiants: Credentials): Promise<AuthenticatedSession> {
    const compte = this.users.findUserByEmail(identifiants.email);
    if (!compte || !await passwordMatches(identifiants.password, compte.password_hash)
      || !(compte.email_verified_at || compte.verification_exempt)) {
      throw new UnauthorizedException('Adresse e-mail ou mot de passe incorrect.');
    }
    const user = { id: compte.id, email: compte.email, nickname: compte.nickname, avatar: compte.avatar };
    return { user, tokens: this.sessions.create(user.id) };
  }

  currentUser(accessToken?: string) { return this.sessions.currentUser(accessToken); }
}
