import { request } from '../../lib/http';

export type AuthUser = { id: number; email: string; nickname: string | null; avatar: string | null };
export type Credentials = { email: string; password: string };
export type AuthMode = 'login' | 'register';

export function getCurrentUser() {
  return request<AuthUser | null>('/auth/me');
}

export function authenticate(mode: AuthMode, credentials: Credentials & { nickname?: string; avatar?: string }) {
  return request<AuthUser>(`/auth/${mode}`, {
    method: 'POST',
    json: credentials,
  });
}

export function logout() {
  return request('/auth/logout', { method: 'POST' });
}
