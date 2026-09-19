import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthRepository } from './auth.repository.js';
import { TokenSessionService } from './token-session.service.js';
import { passwordMatches } from './auth-crypto.js';
import type { AuthenticatedSession, Credentials } from './auth.schema.js';

@Injectable()
export class AuthService {
  constructor(private readonly users: AuthRepository, private readonly sessions: TokenSessionService) {}

  async login(credentials: Credentials): Promise<AuthenticatedSession> {
    const stored = this.users.findUserByEmail(credentials.email);
    if (!stored || !await passwordMatches(credentials.password, stored.password_hash)
      || !(stored.email_verified_at || stored.verification_exempt)) {
      throw new UnauthorizedException('Adresse e-mail ou mot de passe incorrect.');
    }
    const user = { id: stored.id, email: stored.email, nickname: stored.nickname, avatar: stored.avatar };
    return { user, tokens: this.sessions.create(user.id) };
  }

  currentUser(accessToken?: string) { return this.sessions.currentUser(accessToken); }
}
