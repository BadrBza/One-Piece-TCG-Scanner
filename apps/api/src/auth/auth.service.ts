import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

import { AuthRepository } from './auth.repository.js';
import type { AuthUser, Credentials } from './auth.schema.js';

const scryptAsync = promisify(scrypt);
const SESSION_DAYS = 30;

@Injectable()
export class AuthService {
  constructor(private readonly users: AuthRepository) {}

  async register(credentials: Credentials) {
    if (this.users.findUserByEmail(credentials.email)) {
      throw new ConflictException('Un compte existe déjà avec cette adresse e-mail.');
    }
    const user = this.users.createUser(credentials.email, await hashPassword(credentials.password));
    if (!user) throw new ConflictException('Un compte existe déjà avec cette adresse e-mail.');
    return { user, ...this.createSession(user.id) };
  }

  async login(credentials: Credentials) {
    const stored = this.users.findUserByEmail(credentials.email);
    if (!stored || !await passwordMatches(credentials.password, stored.password_hash)) {
      throw new UnauthorizedException('Adresse e-mail ou mot de passe incorrect.');
    }
    return { user: { id: stored.id, email: stored.email }, ...this.createSession(stored.id) };
  }

  currentUser(cookieHeader?: string): AuthUser | undefined {
    const token = readCookie(cookieHeader, 'op_session');
    return token ? this.users.findUserBySession(tokenHash(token)) : undefined;
  }

  logout(cookieHeader?: string) {
    const token = readCookie(cookieHeader, 'op_session');
    if (token) this.users.deleteSession(tokenHash(token));
  }

  private createSession(userId: number) {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
    this.users.createSession(tokenHash(token), userId, expiresAt.toISOString());
    return { token, expiresAt };
  }
}

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = await scryptAsync(password, salt, 64) as Buffer;
  return `${salt}:${hash.toString('hex')}`;
}

async function passwordMatches(password: string, stored: string) {
  const [salt, expectedHex] = stored.split(':');
  if (!salt || !expectedHex) return false;
  const expected = Buffer.from(expectedHex, 'hex');
  const actual = await scryptAsync(password, salt, expected.length) as Buffer;
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function tokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function readCookie(header: string | undefined, name: string) {
  return header?.split(';').map(value => value.trim()).find(value => value.startsWith(name + '='))?.slice(name.length + 1);
}
