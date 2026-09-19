import type { FastifyReply } from 'fastify';
import type { CookieSerializeOptions } from '@fastify/cookie';
import type { SessionTokens } from './auth.schema.js';

const options = (path: string): CookieSerializeOptions => ({ path, httpOnly: true, sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production' });

export function setPendingCookie(reply: FastifyReply, token: string, expiresAt: number) {
  reply.setCookie('pending_registration', token, { ...options('/api/auth'), expires: new Date(expiresAt) });
}

export function setAuthCookies(reply: FastifyReply, tokens: SessionTokens): void {
  reply.setCookie('access_token', tokens.accessToken, { ...options('/api'), expires: new Date(tokens.accessExpiresAt) });
  reply.setCookie('refresh_token', tokens.refreshToken, { ...options('/api/auth'), expires: new Date(tokens.expiresAt) });
  reply.clearCookie('pending_registration', options('/api/auth'));
  reply.clearCookie('op_session', options('/'));
}

export function clearAuthCookies(reply: FastifyReply) {
  reply.clearCookie('access_token', options('/api'));
  reply.clearCookie('refresh_token', options('/api/auth'));
  reply.clearCookie('pending_registration', options('/api/auth'));
  reply.clearCookie('op_session', options('/'));
}
