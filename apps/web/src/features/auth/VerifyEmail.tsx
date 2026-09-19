import { useEffect, useState, type FormEvent } from 'react';
import { verifyEmail, resendCode, type AuthUser, type PendingVerification } from './auth.api';
import { errorMessage } from '../../lib/http';

export function VerifyEmail({ pending, onLogin, onBack }: {
  pending: PendingVerification; onLogin: (user: AuthUser) => void; onBack: () => void;
}) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [remaining, setRemaining] = useState(60);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState(pending.emailSent
    ? 'Un code valable 10 minutes a été envoyé. Pense à vérifier tes spams.'
    : 'Le code n’a pas pu être envoyé. Patiente une minute puis réessaie.');
  useEffect(() => {
    const timer = window.setInterval(() => setRemaining(value => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, []);

  async function verify(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(null);
    try { onLogin(await verifyEmail(code)); }
    catch (reason) { setError(errorMessage(reason, 'Vérification impossible.')); }
    finally { setBusy(false); }
  }

  async function resend() {
    if (busy || remaining) return;
    setBusy(true); setError(null);
    try { await resendCode(); setNotice('Un nouveau code a été envoyé. Utilise le dernier reçu.'); setCode(''); }
    catch (reason) { setError(errorMessage(reason, 'Envoi impossible.')); }
    finally { setRemaining(60); setBusy(false); }
  }

  return <section className="rounded-md border border-stone-300 border-t-[3px] border-t-[#8f2430] bg-[#fffefa] p-4 sm:p-8">
    <h1 className="text-2xl font-semibold">Vérifie ton e-mail</h1>
    <p className="mt-3 break-words text-sm text-stone-600">Saisis le code reçu à <strong>{pending.email}</strong>.</p>
    <p role="status" className="mt-3 text-sm text-stone-600">{notice}</p>
    <form onSubmit={verify} className="mt-6 space-y-4">
      <label htmlFor="verification-code" className="block text-sm font-medium">Code à 6 chiffres</label>
      <input id="verification-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required
        maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, ''))} disabled={busy}
        className="min-h-12 w-full rounded-md border border-stone-300 bg-white px-3 text-center text-xl tracking-widest outline-none focus:ring-2 focus:ring-[#8f2430]" />
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <button disabled={busy || code.length !== 6} className="min-h-11 w-full rounded-md bg-[#8f2430] px-4 font-semibold text-white disabled:opacity-50">
        {busy ? 'Patiente un instant…' : 'Valider mon compte'}
      </button>
    </form>
    <button type="button" disabled={busy || remaining > 0} onClick={resend}
      className="mt-3 min-h-11 w-full text-sm font-medium text-[#8f2430] disabled:opacity-50">
      {remaining > 0 ? `Renvoyer un code dans ${remaining} s` : 'Renvoyer un code'}
    </button>
    <button type="button" disabled={busy} onClick={onBack} className="min-h-11 w-full text-sm text-stone-600 underline">Retour à la connexion</button>
  </section>;
}
