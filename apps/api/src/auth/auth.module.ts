import { TokenSessionService } from './token-session.service.js';
import { TokenSessionRepository } from './token-session.repository.js';
import { VerificationRepository } from './verification.repository.js';
import { VerificationService } from './verification.service.js';
import { EmailService } from './email.service.js';
import { Module } from '@nestjs/common';

import { AuthController } from './auth.controller.js';
import { AuthRepository } from './auth.repository.js';
import { AuthService } from './auth.service.js';
import { AuthGuard } from './auth.guard.js';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [ThrottlerModule.forRoot({
    throttlers: [{ ttl: 15 * 60_000, limit: 20 }],
    generateKey: (context, tracker) => `${tracker}:${context.getHandler().name === 'refresh' ? 'refresh' : 'credentials'}`,
    errorMessage: 'Trop de tentatives. Réessaie dans 15 minutes.',
  })],
  controllers: [AuthController],
  providers: [VerificationRepository, TokenSessionRepository, EmailService, TokenSessionService, VerificationService, AuthRepository, AuthService, AuthGuard, ThrottlerGuard],
  exports: [AuthService, AuthGuard],
})
export class AuthModule {}
