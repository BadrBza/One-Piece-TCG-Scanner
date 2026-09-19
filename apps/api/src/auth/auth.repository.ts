import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../database/database.service.js';
import type { AuthUser } from './auth.schema.js';

type UserRow = AuthUser & { password_hash: string; email_verified_at: string | null; verification_exempt: number };

@Injectable()
export class AuthRepository {
  constructor(private readonly database: DatabaseService) {}

  findUserByEmail(email: string): UserRow | undefined {
    return this.database.connection.prepare(
      'SELECT id, email, nickname, avatar, password_hash, email_verified_at, verification_exempt FROM users WHERE email = ?',
    ).get(email) as UserRow | undefined;
  }

  createUser(email: string, passwordHash: string, nickname: string, avatar: string | null): AuthUser | undefined {
    return this.database.connection.prepare(
      'INSERT INTO users (email, password_hash, nickname, avatar, email_verified_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(email) DO NOTHING RETURNING id, email, nickname, avatar',
    ).get(email, passwordHash, nickname, avatar, new Date().toISOString()) as AuthUser | undefined;
  }

}
