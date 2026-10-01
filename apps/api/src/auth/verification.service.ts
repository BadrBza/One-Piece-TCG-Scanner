import { BadRequestException, ConflictException, HttpException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { VerificationRepository } from './verification.repository.js';
import type { InscriptionEnAttente, Prisma } from '../generated/prisma/client.js';
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
    if (await this.users.findUserByEmail(inscription.email)) throw new ConflictException('Un compte existe déjà avec cette adresse e-mail.');
    const empreinte = await hashPassword(inscription.password);
    const avatar = inscription.avatar ? await prepareAvatar(inscription.avatar) : null;
    const token = newToken();
    const expiresAt = Date.now() + 24 * 60 * 60_000;
    await this.inscriptions.creer({ empreinte: tokenHash(token), email: inscription.email, motDePasse: empreinte,
      pseudo: inscription.nickname, avatar, expiration: BigInt(expiresAt) });
    // Conserver le cookie d'inscription pour permettre un renvoi après un échec SMTP.
    const emailSent = await this.envoyerCode(token, configuration).then(() => true, erreur => {
      if (erreur instanceof ServiceUnavailableException || erreur instanceof HttpException && erreur.getStatus() === 429) return false;
      throw erreur;
    });
    return { token, expiresAt, status: 'verification_required', email: inscription.email, emailSent };
  }

  async status(token?: string): Promise<PendingVerification | null> {
    const inscription = await this.inscriptionEnAttente(token);
    return inscription ? { status: 'verification_required', email: inscription.email, emailSent: inscription.empreinteCode !== null } : null;
  }

  async send(token?: string) {
    return this.envoyerCode(token, this.configurationEnvoi());
  }

  async verify(token: string | undefined, code: string): Promise<AuthenticatedSession> {
    // Valider aussi les tentatives échouées ; lever l'erreur seulement après la transaction.
    const resultat = await this.database.client.$transaction(async transaction => {
      const inscription = await this.inscriptionEnAttente(token, transaction);
      if (!inscription || !inscription.empreinteCode || inscription.tentatives >= 5 || inscription.expirationCode <= Date.now()) return undefined;
      await this.inscriptions.compterTentative(inscription.empreinte, transaction);
      if (!timingSafeEqual(Buffer.from(inscription.empreinteCode, 'hex'), Buffer.from(this.codeHash(inscription.empreinte, code), 'hex'))) return undefined;
      const user = await this.users.createUser(inscription.email, inscription.motDePasse, inscription.pseudo, inscription.avatar, transaction);
      if (!user) {
        await this.inscriptions.supprimer(inscription.empreinte, transaction);
        return undefined;
      }
      await this.inscriptions.supprimerPourEmail(inscription.email, transaction);
      return { user, tokens: await this.sessions.creerDansTransaction(user.id, transaction) };
    });
    if (!resultat) throw new BadRequestException('Code invalide, expiré ou trop de tentatives. Demande un nouveau code ou connecte-toi si ton compte existe déjà.');
    return resultat;
  }

  private async envoyerCode(token: string | undefined, configuration: ReturnType<VerificationService['configurationEnvoi']>) {
    const { inscription, code, empreinte } = await this.database.client.$transaction(async transaction => {
      const inscription = await this.inscriptionEnAttente(token, transaction);
      if (!inscription) throw new BadRequestException('Cette inscription a expiré. Recommence l’inscription.');
      const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
      const empreinte = this.codeHash(inscription.empreinte, code, configuration.secret);
      await this.reserverEnvoi(inscription, empreinte, transaction);
      return { inscription, code, empreinte };
    });
    try {
      await this.emails.envoyerCode(inscription.email, code, configuration.smtp);
    } catch {
      await this.inscriptions.annulerCode(inscription.empreinte, empreinte);
      throw new ServiceUnavailableException('L’e-mail n’a pas pu être envoyé. Patiente une minute puis réessaie.');
    }
    return { sent: true };
  }

  private async reserverEnvoi(inscription: InscriptionEnAttente, empreinte: string, transaction: Prisma.TransactionClient) {
    const maintenant = Date.now();
    const usage = await this.inscriptions.compterEnvois(inscription.email, maintenant, transaction);
    if (usage._count >= 5 || usage._max.envoi !== null && maintenant - Number(usage._max.envoi) < 60_000) {
      throw new HttpException('Patiente au moins une minute entre les envois (5 maximum par heure).', 429);
    }
    await this.inscriptions.enregistrerCode(inscription, empreinte, maintenant, transaction);
  }

  private inscriptionEnAttente(token?: string, transaction?: Prisma.TransactionClient) {
    return token ? this.inscriptions.trouver(tokenHash(token), transaction) : undefined;
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
