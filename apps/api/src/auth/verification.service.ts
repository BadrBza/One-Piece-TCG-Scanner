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

  async register(inscription: Registration): Promise<PendingVerification & { token: string; expiresAt: number }> {
    const configuration = this.configurationEnvoi();
    if (this.users.findUserByEmail(inscription.email)) throw new ConflictException('Un compte existe déjà avec cette adresse e-mail.');
    const empreinte = await hashPassword(inscription.password);
    const avatar = inscription.avatar ? await prepareAvatar(inscription.avatar) : null;
    const token = newToken();
    const expiresAt = Date.now() + 24 * 60 * 60_000;
    this.inscriptions.creer({ hash: tokenHash(token), email: inscription.email, password_hash: empreinte,
      nickname: inscription.nickname, avatar, expires_at: expiresAt });
    // Conserver le cookie d'inscription pour permettre un renvoi après un échec SMTP.
    const emailSent = await this.envoyerCode(token, configuration).then(() => true, erreur => {
      if (erreur instanceof ServiceUnavailableException || erreur instanceof HttpException && erreur.getStatus() === 429) return false;
      throw erreur;
    });
    return { token, expiresAt, status: 'verification_required', email: inscription.email, emailSent };
  }

  status(token?: string): PendingVerification | null {
    const inscription = this.inscriptionEnAttente(token);
    return inscription ? { status: 'verification_required', email: inscription.email, emailSent: inscription.code_hash !== null } : null;
  }

  async send(token?: string) {
    return this.envoyerCode(token, this.configurationEnvoi());
  }

  verify(token: string | undefined, code: string): AuthenticatedSession {
    // Valider aussi les tentatives échouées ; lever l'erreur seulement après la transaction.
    const resultat = this.database.transaction(() => {
      const inscription = this.inscriptionEnAttente(token);
      if (!inscription || !inscription.code_hash || inscription.attempts >= 5 || inscription.code_expires_at <= Date.now()) return undefined;
      this.inscriptions.compterTentative(inscription.hash);
      if (!timingSafeEqual(Buffer.from(inscription.code_hash, 'hex'), Buffer.from(this.codeHash(inscription.hash, code), 'hex'))) return undefined;
      const user = this.users.createUser(inscription.email, inscription.password_hash, inscription.nickname, inscription.avatar);
      if (!user) {
        this.inscriptions.supprimer(inscription.hash);
        return undefined;
      }
      this.inscriptions.supprimerPourEmail(inscription.email);
      return { user, tokens: this.sessions.create(user.id) };
    });
    if (!resultat) throw new BadRequestException('Code invalide, expiré ou trop de tentatives. Demande un nouveau code ou connecte-toi si ton compte existe déjà.');
    return resultat;
  }

  private async envoyerCode(token: string | undefined, configuration: ReturnType<VerificationService['configurationEnvoi']>) {
    const inscription = this.inscriptionEnAttente(token);
    if (!inscription) throw new BadRequestException('Cette inscription a expiré. Recommence l’inscription.');
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const empreinte = this.codeHash(inscription.hash, code, configuration.secret);
    this.reserverEnvoi(inscription, empreinte);
    try {
      await this.emails.envoyerCode(inscription.email, code, configuration.smtp);
    } catch {
      this.inscriptions.annulerCode(inscription.hash, empreinte);
      throw new ServiceUnavailableException('L’e-mail n’a pas pu être envoyé. Patiente une minute puis réessaie.');
    }
    return { sent: true };
  }

  private reserverEnvoi(inscription: InscriptionEnAttente, empreinte: string) {
    this.database.transaction(() => {
      const maintenant = Date.now();
      const usage = this.inscriptions.compterEnvois(inscription.email, maintenant);
      if (usage.count >= 5 || usage.last !== null && maintenant - usage.last < 60_000) {
        throw new HttpException('Patiente au moins une minute entre les envois (5 maximum par heure).', 429);
      }
      this.inscriptions.enregistrerCode(inscription, empreinte, maintenant);
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
