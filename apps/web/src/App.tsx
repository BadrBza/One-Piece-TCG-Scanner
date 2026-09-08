import { useEffect, useState } from 'react';

import { getCurrentUser, logout, type AuthUser } from './api/auth';
import { AppHeader } from './components/AppHeader';
import { LoginPage } from './pages/LoginPage';
import { PortfolioPage } from './pages/PortfolioPage';
import { ScannerPage } from './pages/ScannerPage';

export function App() {
  const [page, setPage] = useState(currentPage);
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
        if (active) setSessionError(reason instanceof Error ? reason.message : 'Impossible de vérifier la connexion.');
      })
      .finally(() => { if (active) setCheckingSession(false); });
    return () => { active = false; };
  }, [sessionAttempt]);

  useEffect(() => {
    const onHashChange = () => setPage(currentPage());
    const onSessionExpired = () => { setUser(null); setLogoutError(null); };
    window.addEventListener('hashchange', onHashChange);
    window.addEventListener('session-expired', onSessionExpired);
    return () => {
      window.removeEventListener('hashchange', onHashChange);
      window.removeEventListener('session-expired', onSessionExpired);
    };
  }, []);

  useEffect(() => {
    if (checkingSession || sessionError) return;
    if (!user && page !== 'login') navigate('login');
    if (user && page === 'login') navigate('scanner');
  }, [user, page, checkingSession, sessionError]);

  function navigate(destination: 'login' | 'scanner' | 'portfolio') {
    window.history.replaceState(null, '', `#${destination}`);
    setPage(destination);
  }

  function onLogin(account: AuthUser) {
    setUser(account);
    setLogoutError(null);
    navigate('scanner');
  }

  async function onLogout() {
    setLoggingOut(true);
    setLogoutError(null);
    try {
      await logout();
      setUser(null);
      navigate('login');
    } catch (reason) {
      setLogoutError(reason instanceof Error ? reason.message : 'La déconnexion a échoué.');
    } finally {
      setLoggingOut(false);
    }
  }

  if (checkingSession || sessionError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-slate-700">
        {sessionError ? (
          <div className="space-y-4 text-center">
            <p role="alert">{sessionError}</p>
            <button onClick={() => setSessionAttempt(attempt => attempt + 1)} className="rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white">Réessayer</button>
          </div>
        ) : <p role="status">Vérification de la connexion…</p>}
      </main>
    );
  }

  if (!user) return <LoginPage onLogin={onLogin} />;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 pb-8 sm:px-6 lg:px-8">
        <AppHeader activePage={page === 'portfolio' ? 'portfolio' : 'scanner'} email={user.email} loggingOut={loggingOut} onLogout={() => void onLogout()} />
        {logoutError && <p role="alert" className="text-sm text-red-700">{logoutError}</p>}
        {page === 'portfolio' ? <PortfolioPage key={user.id} /> : <ScannerPage key={user.id} />}
      </section>
    </main>
  );
}

function currentPage() {
  if (window.location.hash === '#portfolio') return 'portfolio' as const;
  if (window.location.hash === '#scanner' || window.location.hash === '#manual-search') return 'scanner' as const;
  return 'login' as const;
}
