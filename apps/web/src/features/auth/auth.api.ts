import { ApiError, request } from '../../lib/http';

export type AuthUser = { id: number; email: string; nickname: string | null; avatar: string | null };
export type Credentials = { email: string; password: string };
export type AuthMode = 'login' | 'register';

export type PendingVerification = { status: 'verification_required'; email: string; emailSent: boolean };

export async function getCurrentUser(): Promise<AuthUser | null> {
  try { return await request<AuthUser>('/auth/me'); }
  catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

export function authenticate(mode: AuthMode, credentials: Credentials & { nickname?: string; avatar?: string }) {
  return request<AuthUser | PendingVerification>(`/auth/${mode}`, {
    method: 'POST',
    json: credentials,
    timeout: 45_000,
  });
}

export const pendingVerification = () => request<PendingVerification | null>('/auth/verification');
export const verifyEmail = (code: string) => request<AuthUser>('/auth/verify', { method: 'POST', json: { code } });
export const resendCode = () => request<{ sent: true }>('/auth/resend', { method: 'POST', timeout: 45_000 });

export function logout() {
  return request<{ loggedOut: true }>('/auth/logout', { method: 'POST' });
}
