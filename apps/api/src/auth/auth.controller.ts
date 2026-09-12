import { BadRequestException, Body, Controller, Get, Header, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { AuthService } from './auth.service.js';
import { CredentialsSchema } from './auth.schema.js';
import { AuthRateLimitGuard } from './auth-rate-limit.guard.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @UseGuards(AuthRateLimitGuard)
  @Header('Cache-Control', 'no-store')
  async register(@Body() body: unknown, @Res({ passthrough: true }) reply: FastifyReply) {
    const credentials = parseCredentials(body);
    const session = await this.auth.register(credentials);
    reply.header('Set-Cookie', sessionCookie(session.token, session.expiresAt));
    return session.user;
  }

  @Post('login')
  @UseGuards(AuthRateLimitGuard)
  @Header('Cache-Control', 'no-store')
  async login(@Body() body: unknown, @Res({ passthrough: true }) reply: FastifyReply) {
    const credentials = parseCredentials(body);
    const session = await this.auth.login(credentials);
    reply.header('Set-Cookie', sessionCookie(session.token, session.expiresAt));
    return session.user;
  }

  @Get('me')
  @Header('Cache-Control', 'no-store')
  me(@Req() request: FastifyRequest) {
    return this.auth.currentUser(request.headers.cookie) ?? null;
  }

  @Post('logout')
  @Header('Cache-Control', 'no-store')
  logout(@Req() request: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    this.auth.logout(request.headers.cookie);
    reply.header('Set-Cookie', 'op_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
    return { loggedOut: true };
  }
}

function parseCredentials(body: unknown) {
  const result = CredentialsSchema.safeParse(body);
  if (!result.success) throw new BadRequestException('Saisis une adresse e-mail valide et un mot de passe de 8 caractères minimum.');
  return result.data;
}

function sessionCookie(token: string, expiresAt: Date) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `op_session=${token}; HttpOnly; SameSite=Lax; Path=/; Expires=${expiresAt.toUTCString()}${secure}`;
}
