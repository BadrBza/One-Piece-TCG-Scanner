import { HttpException, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  private readonly attempts = new Map<string, { count: number; expires: number }>();

  canActivate(context: ExecutionContext) {
    const now = Date.now();
    for (const [ip, entry] of this.attempts) {
      if (entry.expires <= now) this.attempts.delete(ip);
    }
    const { ip } = context.switchToHttp().getRequest<FastifyRequest>();
    const entry = this.attempts.get(ip) ?? { count: 0, expires: now + 15 * 60 * 1000 };
    this.attempts.set(ip, entry);
    if (++entry.count > 20) throw new HttpException('Trop de tentatives. Réessaie dans 15 minutes.', 429);
    return true;
  }
}
