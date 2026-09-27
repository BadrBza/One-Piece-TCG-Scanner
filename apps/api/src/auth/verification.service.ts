import { BadRequestException, ConflictException, HttpException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { VerificationRepository, type InscriptionEnAttente } from './verification.repository.js';
import { EmailService } from './email.service.js';
import { DatabaseService } from '../database/database.service.js';
import { AuthRepository } from './auth.repository.js';
import { TokenSessionService } from './token-session.service.js';
import { hashPassword, newToken, tokenHash } from './auth-crypto.js';
import { prepareAvatar } from '../common/image-utils.js';
import type { AuthenticatedSession, PendingVerification, Registration } from './auth.schema.js';

@Injectable()
export class VerificationService {
  constructor(private readonly database: DatabaseService, private readonly config: ConfigService,
    private readonly users: AuthRepository, private readonly sessions: TokenSessionService,
    private readonly emails: EmailService, private readonly inscriptions: VerificationRepository) {}

  async register(credentials: Registration): Promise<PendingVerification & { token: string; expiresAt: number }> {
    const configuration = this.configurationEnvoi();
    if (this.users.findUserByEmail(credentials.email)) throw new ConflictException('Un compte existe déjà avec cette adresse e-mail.');
    const passwordHash = await hashPassword(credentials.password);
    const avatar = credentials.avatar ? await prepareAvatar(credentials.avatar) : null;
    const token = newToken();
    const expiresAt = Date.now() + 24 * 60 * 60_000;
    this.inscriptions.creer({ hash: tokenHash(token), email: credentials.email, password_hash: passwordHash,
      nickname: credentials.nickname, avatar, expires_at: expiresAt });
    // Return the pending cookie even if SMTP fails, so the user can retry safely.
    const emailSent = await this.envoyerCode(token, configuration).then(() => true).catch(error => {
      if (!(error instanceof ServiceUnavailableException || error instanceof HttpException && error.getStatus() === 429)) throw error;
      return false;
    });
    return { token, expiresAt, status: 'verification_required', email: credentials.email, emailSent };
  }

  status(token?: string): PendingVerification | null {
    const pending = this.inscriptionEnAttente(token);
    return pending ? { status: 'verification_required' as const, email: pending.email, emailSent: pending.code_hash !== null } : null;
  }

  async send(token?: string) {
    return this.envoyerCode(token, this.configurationEnvoi());
  }

  verify(token: string | undefined, code: string): AuthenticatedSession {
    // Commit failed attempts too; never throw inside this transaction for a wrong code.
    const result = this.database.transaction(() => {
      const pending = this.inscriptionEnAttente(token);
      if (!pending || !pending.code_hash || pending.attempts >= 5 || pending.code_expires_at <= Date.now()) return undefined;
      this.inscriptions.compterTentative(pending.hash);
      if (!timingSafeEqual(Buffer.from(pending.code_hash, 'hex'), Buffer.from(this.codeHash(pending.hash, code), 'hex'))) return undefined;
      const user = this.users.createUser(pending.email, pending.password_hash, pending.nickname, pending.avatar);
      if (!user) {
        this.inscriptions.supprimer(pending.hash);
        return undefined;
      }
      this.inscriptions.supprimerPourEmail(pending.email);
      return { user, tokens: this.sessions.create(user.id) };
    });
    if (!result) throw new BadRequestException('Code invalide, expiré ou trop de tentatives. Demande un nouveau code ou connecte-toi si ton compte existe déjà.');
    return result;
  }

  private async envoyerCode(token: string | undefined, configuration: ReturnType<VerificationService['configurationEnvoi']>) {
    const pending = this.inscriptionEnAttente(token);
    if (!pending) throw new BadRequestException('Cette inscription a expiré. Recommence l’inscription.');
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const digest = this.codeHash(pending.hash, code, configuration.secret);
    this.reserverEnvoi(pending, digest);
    try {
      await this.emails.envoyerCode(pending.email, code, configuration.smtp);
    } catch {
      this.inscriptions.annulerCode(pending.hash, digest);
      throw new ServiceUnavailableException('L’e-mail n’a pas pu être envoyé. Patiente une minute puis réessaie.');
    }
    return { sent: true };
  }

  private reserverEnvoi(inscription: InscriptionEnAttente, empreinte: string) {
    this.database.transaction(() => {
      const now = Date.now();
      const usage = this.inscriptions.compterEnvois(inscription.email, now);
      if (usage.count >= 5 || usage.last !== null && now - usage.last < 60_000) {
        throw new HttpException('Patiente au moins une minute entre les envois (5 maximum par heure).', 429);
      }
      this.inscriptions.enregistrerCode(inscription, empreinte, now);
    });
  }

  private inscriptionEnAttente(token?: string) {
    return token ? this.inscriptions.trouver(tokenHash(token)) : undefined;
  }

  private configurationEnvoi() {
    return { secret: this.secretVerification(), smtp: this.emails.configuration() };
  }

  private secretVerification() {
    const secret = this.config.get<string>('AUTH_VERIFICATION_SECRET');
    if (!secret || secret.length < 32) throw new ServiceUnavailableException('La vérification e-mail n’est pas configurée.');
    return secret;
  }

  private codeHash(challenge: string, code: string, secret = this.secretVerification()) {
    return createHmac('sha256', secret).update(`${challenge}:${code}`).digest('hex');
  }
}
