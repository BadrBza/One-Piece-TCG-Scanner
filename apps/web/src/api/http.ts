export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export function errorMessage(reason: unknown, fallback: string) {
  return reason instanceof Error ? reason.message : fallback;
}

export async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(API_URL + path, { ...options, credentials: 'include' });
  } catch {
    throw new Error('Le serveur est inaccessible. Réessaie dans un instant.');
  }

  if (!response.ok) {
    if (response.status === 401 && !path.startsWith('/auth/')) {
      window.dispatchEvent(new Event('session-expired'));
    }
    const body = await response.json().catch(() => null);
    const message = typeof body?.message === 'string' ? body.message : 'La demande n’a pas pu être traitée.';
    throw new ApiError(message, response.status);
  }

  return response.json() as Promise<T>;
}
