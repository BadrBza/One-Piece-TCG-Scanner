import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { newToken, tokenHash } from './auth-crypto.js';
import type { AuthUser, SessionTokens } from './auth.schema.js';

const HOUR = 60 * 60 * 1000;
type Session = { id: string; user_id: number; expires_at: number; used_at: number | null };

@Injectable()
export class TokenSessionService {
  constructor(private readonly database: DatabaseService) {}
  private get db() { return this.database.connection; }

  create(userId: number): SessionTokens {
    return this.database.transaction(() => {
      const now = Date.now();
      this.db.prepare('DELETE FROM auth_sessions WHERE expires_at <= ?').run(now);
      this.db.prepare('DELETE FROM access_tokens WHERE expires_at <= ?').run(now);
      const sessionId = newToken();
      const expiresAt = now + 24 * HOUR;
      this.db.prepare('INSERT INTO auth_sessions VALUES (?, ?, ?)').run(sessionId, userId, expiresAt);
      return this.issue(sessionId, expiresAt);
    });
  }

  currentUser(token?: string): AuthUser | undefined {
    if (!token) return undefined;
    return this.db.prepare(`
      SELECT u.id, u.email, u.nickname, u.avatar FROM access_tokens a
      JOIN auth_sessions s ON s.id = a.session_id JOIN users u ON u.id = s.user_id
      WHERE a.hash = ? AND a.expires_at > ? AND s.expires_at > ?
      AND (u.email_verified_at IS NOT NULL OR u.verification_exempt = 1)
    `).get(tokenHash(token), Date.now(), Date.now()) as AuthUser | undefined;
  }

  refresh(token?: string): SessionTokens {
    if (!token) throw new UnauthorizedException('Reconnecte-toi pour continuer.');
    const result = this.database.transaction(() => {
      const now = Date.now();
      const session = this.db.prepare(`SELECT s.*, r.used_at FROM refresh_tokens r
        JOIN auth_sessions s ON s.id = r.session_id WHERE r.hash = ?`).get(tokenHash(token)) as Session | undefined;
      if (!session || session.expires_at <= now) return { state: 'invalid' as const };
      if (session.used_at !== null) {
        // A second tab may have sent the same cookie before receiving the rotation.
        if (now - session.used_at < 10_000) return { state: 'concurrent' as const };
        this.db.prepare('DELETE FROM auth_sessions WHERE id = ?').run(session.id);
        return { state: 'invalid' as const };
      }
      this.db.prepare('UPDATE refresh_tokens SET used_at = ? WHERE hash = ?').run(now, tokenHash(token));
      return { state: 'ok' as const, tokens: this.issue(session.id, session.expires_at) };
    });
    if (result.state === 'concurrent') throw new ConflictException('Un renouvellement est déjà en cours. Réessaie dans un instant.');
    if (result.state === 'invalid') throw new UnauthorizedException('Ta session a expiré. Reconnecte-toi.');
    return result.tokens;
  }

  logout(access?: string, refresh?: string): void {
    this.db.prepare(`DELETE FROM auth_sessions WHERE id IN (
      SELECT session_id FROM access_tokens WHERE hash = ?
      UNION SELECT session_id FROM refresh_tokens WHERE hash = ?
    )`).run(tokenHash(access ?? ''), tokenHash(refresh ?? ''));
  }

  private issue(sessionId: string, expiresAt: number): SessionTokens {
    const accessToken = newToken();
    const refreshToken = newToken();
    const accessExpiresAt = Math.min(Date.now() + HOUR, expiresAt);
    this.db.prepare('INSERT INTO access_tokens VALUES (?, ?, ?)').run(tokenHash(accessToken), sessionId, accessExpiresAt);
    this.db.prepare('INSERT INTO refresh_tokens VALUES (?, ?, NULL)').run(tokenHash(refreshToken), sessionId);
    return { accessToken, refreshToken, accessExpiresAt, expiresAt };
  }
}
