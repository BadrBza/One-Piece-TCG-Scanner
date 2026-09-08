import { Module } from '@nestjs/common';

import { AuthController } from './auth.controller.js';
import { AuthRepository } from './auth.repository.js';
import { AuthService } from './auth.service.js';
import { AuthGuard } from './auth.guard.js';
import { AuthRateLimitGuard } from './auth-rate-limit.guard.js';

@Module({
  controllers: [AuthController],
  providers: [AuthRepository, AuthService, AuthGuard, AuthRateLimitGuard],
  exports: [AuthService, AuthGuard],
})
export class AuthModule {}
