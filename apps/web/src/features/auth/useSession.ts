import { useEffect, useState } from 'react';

import { getCurrentUser, logout, type AuthUser } from './auth.api';
import { errorMessage } from '../../lib/http';

export function useSession() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [sessionAttempt, setSessionAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setCheckingSession(true);
    setSessionError(null);
    getCurrentUser()
      .then(account => { if (active) setUser(account); })
      .catch(reason => {
        if (active) setSessionError(errorMessage(reason, 'Impossible de vérifier la connexion.'));
      })
      .finally(() => { if (active) setCheckingSession(false); });
    return () => { active = false; };
  }, [sessionAttempt]);

  useEffect(() => {
    const onSessionExpired = () => { setUser(null); setLogoutError(null); };
    window.addEventListener('session-expired', onSessionExpired);
    return () => window.removeEventListener('session-expired', onSessionExpired);
  }, []);

  function acceptUser(account: AuthUser) {
    setUser(account);
    setLogoutError(null);
  }

  async function signOut() {
    setLoggingOut(true);
    setLogoutError(null);
    try {
      await logout();
      setUser(null);
      return true;
    } catch (reason) {
      setLogoutError(errorMessage(reason, 'La déconnexion a échoué.'));
      return false;
    } finally {
      setLoggingOut(false);
    }
  }

  return { user, checkingSession, loggingOut, sessionError, logoutError, acceptUser, signOut,
    retrySession: () => setSessionAttempt(attempt => attempt + 1) };
}
