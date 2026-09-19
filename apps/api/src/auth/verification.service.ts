import { BadRequestException, ConflictException, HttpException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import nodemailer from 'nodemailer';
import { DatabaseService } from '../database/database.service.js';
import { AuthRepository } from './auth.repository.js';
import { TokenSessionService } from './token-session.service.js';
import { hashPassword, newToken, tokenHash } from './auth-crypto.js';
import { prepareAvatar } from '../common/image-utils.js';
import type { AuthenticatedSession, PendingVerification, Registration } from './auth.schema.js';

type Pending = {
  hash: string; email: string; password_hash: string; nickname: string; avatar: string | null;
  expires_at: number; code_hash: string | null; code_expires_at: number; attempts: number;
};

@Injectable()
export class VerificationService {
  constructor(private readonly database: DatabaseService, private readonly config: ConfigService,
    private readonly users: AuthRepository, private readonly sessions: TokenSessionService) {}
  private get db() { return this.database.connection; }

  async register(credentials: Registration): Promise<PendingVerification & { token: string; expiresAt: number }> {
    this.settings();
    if (this.users.findUserByEmail(credentials.email)) throw new ConflictException('Un compte existe déjà avec cette adresse e-mail.');
    const passwordHash = await hashPassword(credentials.password);
    const avatar = credentials.avatar ? await prepareAvatar(credentials.avatar) : null;
    const token = newToken();
    const expiresAt = Date.now() + 24 * 60 * 60_000;
    this.db.prepare('DELETE FROM pending_registrations WHERE expires_at <= ?').run(Date.now());
    this.db.prepare(`INSERT INTO pending_registrations
      (hash, email, password_hash, nickname, avatar, expires_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(tokenHash(token), credentials.email, passwordHash, credentials.nickname, avatar, expiresAt);
    // Return the pending cookie even if SMTP fails, so the user can retry safely.
    try {
      await this.send(token);
      return { token, expiresAt, status: 'verification_required' as const, email: credentials.email, emailSent: true };
    } catch (error) {
      if (!(error instanceof ServiceUnavailableException || error instanceof HttpException && error.getStatus() === 429)) throw error;
      return { token, expiresAt, status: 'verification_required' as const, email: credentials.email, emailSent: false };
    }
  }

  status(token?: string): PendingVerification | null {
    const pending = this.pending(token);
    return pending ? { status: 'verification_required' as const, email: pending.email, emailSent: pending.code_hash !== null } : null;
  }

  async send(token?: string) {
    const settings = this.settings();
    const pending = this.pending(token);
    if (!pending) throw new BadRequestException('Cette inscription a expiré. Recommence l’inscription.');
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const digest = this.codeHash(pending.hash, code);
    this.database.transaction(() => {
      const now = Date.now();
      this.db.prepare('DELETE FROM verification_sends WHERE sent_at <= ?').run(now - 60 * 60_000);
      const usage = this.db.prepare('SELECT COUNT(*) AS count, MAX(sent_at) AS last FROM verification_sends WHERE email = ?')
        .get(pending.email) as { count: number; last: number | null };
      if (usage.count >= 5 || usage.last !== null && now - usage.last < 60_000) {
        throw new HttpException('Patiente au moins une minute entre les envois (5 maximum par heure).', 429);
      }
      this.db.prepare('INSERT INTO verification_sends VALUES (?, ?)').run(pending.email, now);
      this.db.prepare('UPDATE pending_registrations SET code_hash = ?, code_expires_at = ?, attempts = 0 WHERE hash = ?')
        .run(digest, now + 10 * 60_000, pending.hash);
    });
    const transport = nodemailer.createTransport(settings.transport);
    try {
      await transport.sendMail({ from: settings.from, to: pending.email,
        subject: 'HakiScan — Vérifie ton adresse e-mail',
        text: `Ton code de vérification HakiScan est : ${code}\n\nIl expire dans 10 minutes. Ne le partage avec personne.\nSi tu n’as pas demandé cette inscription, ignore cet e-mail.` });
    } catch {
      this.db.prepare('UPDATE pending_registrations SET code_hash = NULL WHERE hash = ? AND code_hash = ?').run(pending.hash, digest);
      throw new ServiceUnavailableException('L’e-mail n’a pas pu être envoyé. Patiente une minute puis réessaie.');
    } finally { transport.close(); }
    return { sent: true };
  }

  verify(token: string | undefined, code: string): AuthenticatedSession {
    // Commit failed attempts too; never throw inside this transaction for a wrong code.
    const result = this.database.transaction(() => {
      const pending = this.pending(token);
      if (!pending || !pending.code_hash || pending.attempts >= 5 || pending.code_expires_at <= Date.now()) return undefined;
      this.db.prepare('UPDATE pending_registrations SET attempts = attempts + 1 WHERE hash = ?').run(pending.hash);
      if (!timingSafeEqual(Buffer.from(pending.code_hash, 'hex'), Buffer.from(this.codeHash(pending.hash, code), 'hex'))) return undefined;
      const user = this.users.createUser(pending.email, pending.password_hash, pending.nickname, pending.avatar);
      if (!user) {
        this.db.prepare('DELETE FROM pending_registrations WHERE hash = ?').run(pending.hash);
        return undefined;
      }
      this.db.prepare('DELETE FROM pending_registrations WHERE email = ?').run(pending.email);
      return { user, tokens: this.sessions.create(user.id) };
    });
    if (!result) throw new BadRequestException('Code invalide, expiré ou trop de tentatives. Demande un nouveau code ou connecte-toi si ton compte existe déjà.');
    return result;
  }

  private pending(token?: string): Pending | undefined {
    if (!token) return undefined;
    return this.db.prepare('SELECT * FROM pending_registrations WHERE hash = ? AND expires_at > ?')
      .get(tokenHash(token), Date.now()) as Pending | undefined;
  }

  private codeHash(challenge: string, code: string) {
    const secret = this.config.get<string>('AUTH_VERIFICATION_SECRET');
    if (!secret || secret.length < 32) throw new ServiceUnavailableException('La vérification e-mail n’est pas configurée.');
    return createHmac('sha256', secret).update(`${challenge}:${code}`).digest('hex');
  }

  private settings() {
    this.codeHash('', '');
    const host = this.config.get<string>('SMTP_HOST');
    const from = this.config.get<string>('SMTP_FROM');
    const port = Number(this.config.get<string>('SMTP_PORT') || 587);
    if (!host || !from || !Number.isInteger(port) || port < 1 || port > 65535) {
      throw new ServiceUnavailableException('L’envoi des e-mails n’est pas configuré.');
    }
    const secure = this.config.get<string>('SMTP_SECURE') === 'true';
    const user = this.config.get<string>('SMTP_USER');
    return { from, transport: { host, port, secure,
      requireTLS: this.config.get<string>('NODE_ENV') === 'production' || this.config.get<string>('SMTP_REQUIRE_TLS') === 'true',
      ...(user ? { auth: { user, pass: this.config.get<string>('SMTP_PASSWORD') || '' } } : {}),
      connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 15_000,
    } };
  }
}
