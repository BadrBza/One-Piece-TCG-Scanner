import { useEffect, useState } from 'react';

import type { AuthUser } from '../features/auth/auth.api';
import { useSession } from '../features/auth/useSession';
import { AppHeader } from '../components/AppHeader';
import { LoginPage } from '../pages/LoginPage';
import { PortfolioPage } from '../pages/PortfolioPage';
import { ScannerPage } from '../pages/ScannerPage';

export function App() {
  const [page, setPage] = useState(currentPage);
  const { user, checkingSession, loggingOut, sessionError, logoutError, acceptUser, signOut, retrySession } = useSession();

  useEffect(() => {
    const onHashChange = () => setPage(currentPage());
    window.addEventListener('hashchange', onHashChange);
    return () => {
      window.removeEventListener('hashchange', onHashChange);
    };
  }, []);

  useEffect(() => {
    if (checkingSession || sessionError) return;
    if (!user && page !== 'login') navigate('login');
    if (user && page === 'login') navigate('portfolio');
  }, [user, page, checkingSession, sessionError]);

  function navigate(destination: 'login' | 'scanner' | 'portfolio') {
    window.history.replaceState(null, '', `#${destination}`);
    setPage(destination);
  }

  function onLogin(account: AuthUser) {
    acceptUser(account);
    navigate('portfolio');
  }

  async function onLogout() {
    if (await signOut()) navigate('login');
  }

  if (checkingSession || sessionError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f3f1ec] p-6 text-stone-700">
        {sessionError ? (
          <div className="space-y-4 text-center">
            <p role="alert">{sessionError}</p>
            <button onClick={retrySession} className="rounded-md bg-[#8f2430] px-4 py-3 text-sm font-semibold text-white hover:bg-[#761d27]">Réessayer</button>
          </div>
        ) : <p role="status">Vérification de la connexion…</p>}
      </main>
    );
  }

  if (!user) return <LoginPage onLogin={onLogin} />;

  return (
    <main className="min-h-screen bg-[#f3f1ec] text-[#24211f]">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-4 pb-12 sm:px-6 lg:px-8">
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
