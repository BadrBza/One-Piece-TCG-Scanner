import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  constructor(private readonly config: ConfigService) {}

  async envoyerCode(destinataire: string, code: string, configuration = this.configuration()) {
    const transport = nodemailer.createTransport(configuration.transport);
    try {
      await transport.sendMail({
        from: configuration.from, to: destinataire,
        subject: 'HakiScan — Vérifie ton adresse e-mail',
        text: `Ton code de vérification HakiScan est : ${code}\n\nIl expire dans 10 minutes. Ne le partage avec personne.\nSi tu n’as pas demandé cette inscription, ignore cet e-mail.`,
      });
    } finally { transport.close(); }
  }

  configuration() {
    const host = this.config.get<string>('SMTP_HOST');
    const from = this.config.get<string>('SMTP_FROM');
    const port = Number(this.config.get<string>('SMTP_PORT') || 587);
    if (!host || !from || !Number.isInteger(port) || port < 1 || port > 65535) {
      throw new ServiceUnavailableException('L’envoi des e-mails n’est pas configuré.');
    }
    const secure = this.config.get<string>('SMTP_SECURE') === 'true';
    const user = this.config.get<string>('SMTP_USER');
    return {
      from,
      transport: {
        host, port, secure,
        requireTLS: this.config.get<string>('NODE_ENV') === 'production' || this.config.get<string>('SMTP_REQUIRE_TLS') === 'true',
        ...(user ? { auth: { user, pass: this.config.get<string>('SMTP_PASSWORD') || '' } } : {}),
        connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 15_000,
      },
    };
  }
}
