import { request } from '../../lib/http';

export type AuthUser = { id: number; email: string };
export type Credentials = { email: string; password: string };
export type AuthMode = 'login' | 'register';

export function getCurrentUser() {
  return request<AuthUser | null>('/auth/me');
}

export function authenticate(mode: AuthMode, credentials: Credentials) {
  return request<AuthUser>(`/auth/${mode}`, {
    method: 'POST',
    json: credentials,
  });
}

export function logout() {
  return request('/auth/logout', { method: 'POST' });
}
