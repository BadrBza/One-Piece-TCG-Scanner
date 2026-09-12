import { useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';

import { authenticate, type AuthMode, type AuthUser } from '../features/auth/auth.api';
import { errorMessage } from '../lib/http';

export function LoginPage({ onLogin }: { onLogin: (user: AuthUser) => void }) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const registering = mode === 'register';

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      onLogin(await authenticate(mode, { email, password }));
    } catch (reason) {
      setError(errorMessage(reason, 'Connexion impossible.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f3f1ec] px-4 py-10 text-[#24211f]">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center justify-center gap-3">
          <img src="/hakiscan-logo.png" alt="" className="size-14 object-contain" />
          <span className="text-lg font-semibold tracking-tight">HakiScan</span>
        </div>
        <section className="rounded-md border border-stone-300 border-t-[3px] border-t-[#8f2430] bg-[#fffefa] p-6 sm:p-8">
          <h1 className="text-2xl font-semibold tracking-tight">{registering ? 'Créer un compte' : 'Connexion'}</h1>
          <p className="mt-2 text-sm leading-relaxed text-stone-500">
            {registering ? 'Retrouve tes cartes dans ta collection personnelle.' : 'Connecte-toi pour scanner tes cartes et retrouver ta collection.'}
          </p>
          <form className="mt-6 space-y-4" onSubmit={submit}>
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium">Adresse e-mail</label>
              <input id="email" type="email" autoComplete="username" required maxLength={254} value={email}
                onChange={event => setEmail(event.target.value)} disabled={busy}
                className="min-h-11 w-full rounded-md border border-stone-300 bg-white px-3 outline-none focus:border-[#8f2430] focus:ring-2 focus:ring-[#8f2430]/10" />
            </div>
            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium">Mot de passe</label>
              <input id="password" type="password" autoComplete={registering ? 'new-password' : 'current-password'}
                required minLength={8} maxLength={128} value={password} onChange={event => setPassword(event.target.value)} disabled={busy}
                aria-describedby={registering ? 'password-help' : undefined}
                className="min-h-11 w-full rounded-md border border-stone-300 bg-white px-3 outline-none focus:border-[#8f2430] focus:ring-2 focus:ring-[#8f2430]/10" />
              {registering && <p id="password-help" className="mt-1.5 text-xs text-stone-500">8 caractères minimum.</p>}
            </div>
            {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            <button type="submit" disabled={busy}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-[#8f2430] px-4 text-sm font-semibold text-white hover:bg-[#761d27] disabled:opacity-60">
              {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {busy ? 'Patiente un instant…' : registering ? 'Créer mon compte' : 'Se connecter'}
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-stone-500">
            {registering ? 'Déjà un compte ? ' : 'Pas encore de compte ? '}
            <button type="button" disabled={busy} className="font-medium text-[#8f2430] hover:underline"
              onClick={() => { setMode(registering ? 'login' : 'register'); setPassword(''); setError(null); }}>
              {registering ? 'Se connecter' : 'Créer un compte'}
            </button>
          </p>
        </section>
      </div>
    </main>
  );
}
