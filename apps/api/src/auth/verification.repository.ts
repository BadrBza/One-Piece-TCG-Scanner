import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import type { Registration } from './auth.schema.js';

export type InscriptionEnAttente = Pick<Registration, 'email' | 'nickname'> & {
  hash: string; password_hash: string; avatar: string | null;
  expires_at: number; code_hash: string | null; code_expires_at: number; attempts: number;
};
type NouvelleInscription = Omit<InscriptionEnAttente, 'code_hash' | 'code_expires_at' | 'attempts'>;

@Injectable()
export class VerificationRepository {
  constructor(private readonly database: DatabaseService) {}
  private get db() { return this.database.connection; }

  creer(inscription: NouvelleInscription) {
    this.db.prepare('DELETE FROM pending_registrations WHERE expires_at <= ?').run(Date.now());
    this.db.prepare(`INSERT INTO pending_registrations
      (hash, email, password_hash, nickname, avatar, expires_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(inscription.hash, inscription.email, inscription.password_hash, inscription.nickname, inscription.avatar, inscription.expires_at);
  }

  trouver(hash: string) {
    return this.db.prepare('SELECT * FROM pending_registrations WHERE hash = ? AND expires_at > ?')
      .get(hash, Date.now()) as InscriptionEnAttente | undefined;
  }

  compterTentative(hash: string) {
    this.db.prepare('UPDATE pending_registrations SET attempts = attempts + 1 WHERE hash = ?').run(hash);
  }

  supprimer(hash: string) {
    this.db.prepare('DELETE FROM pending_registrations WHERE hash = ?').run(hash);
  }

  supprimerPourEmail(email: string) {
    this.db.prepare('DELETE FROM pending_registrations WHERE email = ?').run(email);
  }

  annulerCode(hash: string, empreinte: string) {
    this.db.prepare('UPDATE pending_registrations SET code_hash = NULL WHERE hash = ? AND code_hash = ?').run(hash, empreinte);
  }

  compterEnvois(email: string, maintenant: number) {
    this.db.prepare('DELETE FROM verification_sends WHERE sent_at <= ?').run(maintenant - 60 * 60_000);
    return this.db.prepare('SELECT COUNT(*) AS count, MAX(sent_at) AS last FROM verification_sends WHERE email = ?')
      .get(email) as { count: number; last: number | null };
  }

  enregistrerCode(inscription: InscriptionEnAttente, empreinte: string, maintenant: number) {
    this.db.prepare('INSERT INTO verification_sends VALUES (?, ?)').run(inscription.email, maintenant);
    this.db.prepare('UPDATE pending_registrations SET code_hash = ?, code_expires_at = ?, attempts = 0 WHERE hash = ?')
      .run(empreinte, maintenant + 10 * 60_000, inscription.hash);
  }
}
