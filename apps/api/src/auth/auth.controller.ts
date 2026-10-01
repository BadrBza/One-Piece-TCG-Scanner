import { Body, Controller, Get, Header, Post, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { valider } from '../common/validation.js';
import { AuthService } from './auth.service.js';
import { CredentialsSchema, RegistrationSchema, VerificationSchema } from './auth.schema.js';
import type { AuthenticatedSession, AuthUser, PendingVerification } from './auth.schema.js';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { TokenSessionService } from './token-session.service.js';
import { VerificationService } from './verification.service.js';
import { clearAuthCookies, setAuthCookies, setPendingCookie } from './auth-cookies.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService, private readonly sessions: TokenSessionService,
    private readonly verification: VerificationService) {}

  @Post('register')
  @UseGuards(ThrottlerGuard)
  @Header('Cache-Control', 'no-store')
  async register(@Body() body: unknown, @Res({ passthrough: true }) reply: FastifyReply): Promise<PendingVerification> {
    const inscription = valider(RegistrationSchema, body, 'Vérifie ton e-mail, ton mot de passe (8 caractères minimum), ton pseudo et ta photo.');
    const result = await this.verification.register(inscription);
    setPendingCookie(reply, result.token, result.expiresAt);
    return { status: result.status, email: result.email, emailSent: result.emailSent };
  }

  @Post('login')
  @UseGuards(ThrottlerGuard)
  @Header('Cache-Control', 'no-store')
  async login(@Body() body: unknown, @Req() request: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply): Promise<AuthUser> {
    const identifiants = valider(CredentialsSchema, body, 'Saisis une adresse e-mail valide et un mot de passe de 8 caractères minimum.');
    const result = await this.auth.login(identifiants);
    return this.ouvrirSession(request, reply, result);
  }

  @Get('me')
  @Header('Cache-Control', 'no-store')
  async me(@Req() request: FastifyRequest): Promise<AuthUser> {
    const user = await this.auth.currentUser(request.cookies.access_token);
    if (!user) throw new UnauthorizedException('Reconnecte-toi pour continuer.');
    return user;
  }

  @Post('refresh')
  @Throttle({ default: { limit: 120 } })
  @UseGuards(ThrottlerGuard)
  @Header('Cache-Control', 'no-store')
  async refresh(@Req() request: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    setAuthCookies(reply, await this.sessions.refresh(request.cookies.refresh_token));
    return { refreshed: true };
  }

  @Get('verification')
  @Header('Cache-Control', 'no-store')
  pending(@Req() request: FastifyRequest) { return this.verification.status(request.cookies.pending_registration); }

  @Post('verify')
  @UseGuards(ThrottlerGuard)
  @Header('Cache-Control', 'no-store')
  async verify(@Body() body: unknown, @Req() request: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply): Promise<AuthUser> {
    const { code } = valider(VerificationSchema, body, 'Saisis le code à 6 chiffres.');
    const result = await this.verification.verify(request.cookies.pending_registration, code);
    return this.ouvrirSession(request, reply, result);
  }

  @Post('resend')
  @UseGuards(ThrottlerGuard)
  @Header('Cache-Control', 'no-store')
  resend(@Req() request: FastifyRequest) { return this.verification.send(request.cookies.pending_registration); }

  @Post('logout')
  @Header('Cache-Control', 'no-store')
  async logout(@Req() request: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    await this.sessions.logout(request.cookies.access_token, request.cookies.refresh_token);
    clearAuthCookies(reply);
    return { loggedOut: true };
  }

  private async ouvrirSession(request: FastifyRequest, reply: FastifyReply, session: AuthenticatedSession) {
    await this.sessions.logout(request.cookies.access_token, request.cookies.refresh_token);
    setAuthCookies(reply, session.tokens);
    return session.user;
  }
}
