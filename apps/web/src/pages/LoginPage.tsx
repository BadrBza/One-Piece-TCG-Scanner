import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Camera, Loader2, UserRound } from 'lucide-react';

import { authenticate, type AuthMode, type AuthUser } from '../features/auth/auth.api';
import { errorMessage } from '../lib/http';

export function LoginPage({ onLogin }: { onLogin: (user: AuthUser) => void }) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [avatar, setAvatar] = useState<string>();
  const [readingPhoto, setReadingPhoto] = useState(false);
  const [submitting, setBusy] = useState(false);
  const busy = submitting || readingPhoto;
  const [error, setError] = useState<string | null>(null);
  const registering = mode === 'register';

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      onLogin(await authenticate(mode, { email, password, ...(registering ? { nickname: nickname.trim(), avatar } : {}) }));
    } catch (reason) {
      setError(errorMessage(reason, 'Connexion impossible.'));
    } finally {
      setBusy(false);
    }
  }

  async function chooseAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || busy) return;
    setError(null);
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) {
      setError('Choisis une photo JPG, PNG ou WebP de 2 Mo maximum.');
      return;
    }
    setReadingPhoto(true);
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Lecture impossible.'));
        reader.onerror = () => reject(new Error('Lecture impossible.'));
        reader.readAsDataURL(file);
      });
      setAvatar(data);
    } catch { setError('Impossible de lire cette photo. Essaie avec une autre image.'); }
    finally { setReadingPhoto(false); }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#f3f1ec] px-4 py-6 sm:py-10 text-[#24211f]">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center justify-center gap-3">
          <img src="/hakiscan-logo.png" alt="" className="size-14 object-contain" />
          <span className="text-lg font-semibold tracking-tight">HakiScan</span>
        </div>
        <section className="rounded-md border border-stone-300 border-t-[3px] border-t-[#8f2430] bg-[#fffefa] p-4 sm:p-8">
          <h1 className="text-2xl font-semibold tracking-tight">{registering ? 'Créer un compte' : 'Connexion'}</h1>
          <p className="mt-2 text-sm leading-relaxed text-stone-500">
            {registering ? 'Retrouve tes cartes dans ta collection personnelle.' : 'Connecte-toi pour scanner tes cartes et retrouver ta collection.'}
          </p>
          <form className="mt-6 space-y-4" onSubmit={submit}>
            {registering && <>
              <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
                <div className="flex items-center gap-4">
                  <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#8f2430]/10 text-[#8f2430]">
                    {avatar ? <img src={avatar} alt="Aperçu de la photo de profil" className="size-full object-cover" /> : <UserRound className="size-7" aria-hidden="true" />}
                  </div>
                  <div className="min-w-0">
                    <label htmlFor="avatar" className="mb-1 block text-sm font-semibold">Photo de profil <span className="font-normal text-stone-500">(facultative)</span></label>
                    <p id="avatar-help" className="text-xs text-stone-500">JPG, PNG ou WebP · 2 Mo max.</p>
                    {avatar && <button type="button" disabled={busy} onClick={() => setAvatar(undefined)} className="mt-1 min-h-11 text-xs font-medium text-[#8f2430] underline disabled:opacity-50">Retirer la photo</button>}
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <Camera className="size-4 shrink-0 text-stone-500" aria-hidden="true" />
                  <input id="avatar" type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={chooseAvatar} aria-describedby="avatar-help"
                    className="min-w-0 w-full text-xs text-stone-600 file:mr-2 file:cursor-pointer file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-2 file:font-medium file:text-[#8f2430] disabled:opacity-50" />
                </div>
                {readingPhoto && <p role="status" className="mt-2 text-xs text-stone-500">Chargement de la photo…</p>}
              </div>
              <div>
                <label htmlFor="nickname" className="mb-1.5 block text-sm font-medium">Pseudo</label>
                <input id="nickname" autoComplete="nickname" required minLength={3} maxLength={30} value={nickname} onChange={event => setNickname(event.target.value)} disabled={busy}
                  aria-describedby="nickname-help" placeholder="Ton nom de collectionneur"
                  className="min-h-11 w-full rounded-md border border-stone-300 bg-white px-3 outline-none focus:border-[#8f2430] focus:ring-2 focus:ring-[#8f2430]/10" />
                <p id="nickname-help" className="mt-1.5 text-xs text-stone-500">3 à 30 caractères : lettres, chiffres, espaces, points, tirets ou underscores.</p>
              </div>
            </>}

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
            <button type="button" disabled={busy} className="min-h-11 font-medium text-[#8f2430] hover:underline"
              onClick={() => { setMode(registering ? 'login' : 'register'); setPassword(''); setError(null); }}>
              {registering ? 'Se connecter' : 'Créer un compte'}
            </button>
          </p>
        </section>
      </div>
    </main>
  );
}
