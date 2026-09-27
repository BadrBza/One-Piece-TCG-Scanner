import ky, { HTTPError, TimeoutError, type Options } from 'ky';

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export function errorMessage(reason: unknown, fallback: string) {
  return reason instanceof Error ? reason.message : fallback;
}

const api = ky.create({
  prefix: API_URL,
  credentials: 'include',
  retry: 0,
});

let refreshPending: Promise<void> | undefined;
let refreshVersion = 0;

function refreshSession() {
  return refreshPending ??= api.post('auth/refresh').json().then(() => {
    refreshVersion++;
  }).finally(() => { refreshPending = undefined; });
}

export async function request<T>(path: string, options?: Options): Promise<T> {
  const protectedRequest = !path.startsWith('/auth/') || path === '/auth/me';
  const version = refreshVersion;
  const send = () => api(path.replace(/^\//, ''), options).json<T>();
  try {
    return await send().catch(async reason => {
      if (!protectedRequest || !(reason instanceof HTTPError) || reason.response.status !== 401) throw reason;
      if (version === refreshVersion) await refreshSession();
      return send();
    });
  } catch (reason) {
    return traiterErreur(reason, path, protectedRequest);
  }
}

async function traiterErreur(reason: unknown, path: string, protectedRequest: boolean): Promise<never> {
  if (reason instanceof TimeoutError) {
    const analysis = path === '/cards/scan' || path === '/cards/resolve';
    throw new Error(analysis
      ? 'L’analyse prend trop de temps. Le serveur peut encore la terminer. Patiente avant de relancer ou utilise la recherche par référence.'
      : 'Le serveur met trop de temps à répondre. Réessaie dans un instant.');
  }
  if (reason instanceof HTTPError) {
    if (reason.response.status === 401 && protectedRequest) {
      window.dispatchEvent(new Event('session-expired'));
    }
    const body = await reason.response.json().catch(() => null);
    const message = typeof body?.message === 'string' ? body.message : 'La demande n’a pas pu être traitée.';
    throw new ApiError(message, reason.response.status);
  }
  throw new Error('Le serveur est inaccessible. Réessaie dans un instant.');
}
