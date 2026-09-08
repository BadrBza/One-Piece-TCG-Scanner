import { request } from './http';

export type AuthUser = { id: number; email: string };
export type Credentials = { email: string; password: string };
export type AuthMode = 'login' | 'register';

export function getCurrentUser() {
  return request<AuthUser | null>('/auth/me');
}

export function authenticate(mode: AuthMode, credentials: Credentials) {
  return request<AuthUser>(`/auth/${mode}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });
}

export function logout() {
  return request('/auth/logout', { method: 'POST' });
}
