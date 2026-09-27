import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import type { AuthUser } from './auth.schema.js';

type Session = { id: string; expires_at: number; used_at: number | null };

@Injectable()
export class TokenSessionRepository {
  constructor(private readonly database: DatabaseService) {}
  private get db() { return this.database.connection; }

  creer(id: string, utilisateurId: number, expiration: number, maintenant: number) {
    this.db.prepare('DELETE FROM auth_sessions WHERE expires_at <= ?').run(maintenant);
    this.db.prepare('DELETE FROM access_tokens WHERE expires_at <= ?').run(maintenant);
    this.db.prepare('INSERT INTO auth_sessions VALUES (?, ?, ?)').run(id, utilisateurId, expiration);
  }

  utilisateur(empreinte: string) {
    return this.db.prepare(`
      SELECT u.id, u.email, u.nickname, u.avatar FROM access_tokens a
      JOIN auth_sessions s ON s.id = a.session_id JOIN users u ON u.id = s.user_id
      WHERE a.hash = ? AND a.expires_at > ? AND s.expires_at > ?
      AND (u.email_verified_at IS NOT NULL OR u.verification_exempt = 1)
    `).get(empreinte, Date.now(), Date.now()) as AuthUser | undefined;
  }

  trouver(empreinte: string) {
    return this.db.prepare(`SELECT s.id, s.expires_at, r.used_at FROM refresh_tokens r
      JOIN auth_sessions s ON s.id = r.session_id WHERE r.hash = ?`).get(empreinte) as Session | undefined;
  }

  marquerUtilise(empreinte: string, maintenant: number) {
    this.db.prepare('UPDATE refresh_tokens SET used_at = ? WHERE hash = ?').run(maintenant, empreinte);
  }

  supprimer(id: string) {
    this.db.prepare('DELETE FROM auth_sessions WHERE id = ?').run(id);
  }

  supprimerParJetons(acces: string, renouvellement: string) {
    this.db.prepare(`DELETE FROM auth_sessions WHERE id IN (
      SELECT session_id FROM access_tokens WHERE hash = ?
      UNION SELECT session_id FROM refresh_tokens WHERE hash = ?
    )`).run(acces, renouvellement);
  }

  enregistrerJetons(sessionId: string, acces: string, renouvellement: string, expirationAcces: number) {
    this.db.prepare('INSERT INTO access_tokens VALUES (?, ?, ?)').run(acces, sessionId, expirationAcces);
    this.db.prepare('INSERT INTO refresh_tokens VALUES (?, ?, NULL)').run(renouvellement, sessionId);
  }
}
