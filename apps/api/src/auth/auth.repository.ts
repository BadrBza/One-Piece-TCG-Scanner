import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../database/database.service.js';
import type { AuthUser } from './auth.schema.js';

type UserRow = AuthUser & { password_hash: string };

@Injectable()
export class AuthRepository {
  constructor(private readonly database: DatabaseService) {}

  findUserByEmail(email: string): UserRow | undefined {
    return this.database.connection.prepare(
      'SELECT id, email, password_hash FROM users WHERE email = ?',
    ).get(email) as UserRow | undefined;
  }

  createUser(email: string, passwordHash: string): AuthUser | undefined {
    return this.database.connection.prepare(
      'INSERT INTO users (email, password_hash) VALUES (?, ?) ON CONFLICT(email) DO NOTHING RETURNING id, email',
    ).get(email, passwordHash) as AuthUser | undefined;
  }

  createSession(tokenHash: string, userId: number, expiresAt: string) {
    this.database.connection.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(new Date().toISOString());
    this.database.connection.prepare(
      'INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)',
    ).run(tokenHash, userId, expiresAt);
  }

  findUserBySession(tokenHash: string): AuthUser | undefined {
    return this.database.connection.prepare(`
      SELECT users.id, users.email
      FROM sessions
      JOIN users ON users.id = sessions.user_id
      WHERE sessions.token_hash = ? AND sessions.expires_at > ?
    `).get(tokenHash, new Date().toISOString()) as AuthUser | undefined;
  }

  deleteSession(tokenHash: string) {
    this.database.connection.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
  }
}
