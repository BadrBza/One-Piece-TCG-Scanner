import { Injectable, UnauthorizedException, type CanActivate, type ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import { AuthService } from './auth.service.js';
import type { AuthUser } from './auth.schema.js';

export type AuthenticatedRequest = FastifyRequest & { user: AuthUser };

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = this.auth.currentUser(request.headers.cookie);
    if (!user) throw new UnauthorizedException('Connecte-toi pour continuer.');
    request.user = user;
    return true;
  }
}
