import { ArrowDown, Camera, Keyboard, Loader2, ScanLine } from 'lucide-react';
import { type ReactNode, useEffect, useRef } from 'react';

import { useScanner } from './useScanner';
import { ManualLookup } from './components/ManualLookup';
import { PhotoPicker } from './components/PhotoPicker';
import { ScanResult } from './components/ScanResult';

export function Scanner() {
  const {
    mode, cardNumber, setCardNumber, preview, result, confirmation, resultSource,
    error, isImporting, isScanning, isLookingUp, busy, selectMode, importPhoto,
    recognizeCard, confirmCardNumber, findCard,
  } = useScanner();
  const resultPanel = useRef<HTMLElement>(null);

  useEffect(() => {
    if (result) resultPanel.current?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
      block: 'start',
    });
  }, [result]);

  return (
    <section className="mx-auto max-w-4xl space-y-8 pb-8 sm:space-y-10">
      <header className="mx-auto max-w-xl text-center">
        <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#8f2430]/15 bg-[#8f2430]/5 px-3 py-1 text-xs font-semibold text-[#8f2430]">
          <ScanLine className="size-3.5" aria-hidden="true" /> HAKISCAN · ONE PIECE
        </span>
        <h1 className="text-3xl font-semibold tracking-tight text-stone-950 sm:text-4xl">Une carte. Toutes ses possibilités.</h1>
      </header>

      <div className="overflow-hidden rounded-2xl border border-stone-200 bg-[#fffefa] shadow-sm">
        <div className="flex flex-col gap-4 border-b border-stone-200/80 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div>
            <h2 className="font-semibold text-stone-900">Trouver ma carte</h2>
            <p className="mt-1 text-xs text-stone-500">Choisis ta méthode de recherche.</p>
          </div>
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-stone-100 p-1" role="group" aria-label="Méthode de recherche">
            <ModeButton active={mode === 'photo'} disabled={busy} icon={<Camera className="size-4" aria-hidden="true" />} onClick={() => selectMode('photo')}>Photo</ModeButton>
            <ModeButton active={mode === 'manual'} disabled={busy} icon={<Keyboard className="size-4" aria-hidden="true" />} onClick={() => selectMode('manual')}>Référence</ModeButton>
          </div>
        </div>
        <div aria-busy={busy} className="p-5 sm:p-8">
          {mode === 'photo' ? (
            <PhotoPicker busy={busy} isImporting={isImporting} isScanning={isScanning}
              onChange={importPhoto} onScan={() => void recognizeCard()} preview={preview} />
          ) : (
            <div className="mx-auto max-w-xl py-4 sm:py-8">
              <ManualLookup cardNumber={cardNumber} disabled={busy} isLoading={isLookingUp}
                onChange={setCardNumber} onSubmit={() => void findCard()} />
            </div>
          )}
          {error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
          {confirmation && <div role="status" className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-5">
            <h3 className="font-semibold text-amber-950">Confirme le numéro de ta carte</h3>
            <p className="mt-1 text-sm text-amber-800">Choisis la référence visible sur ta photo pour continuer.</p>
            <div className="mt-4 flex flex-wrap gap-3">
              {confirmation.numberCandidates.map(number => <button key={number} type="button" disabled={busy}
                onClick={() => void confirmCardNumber(number)}
                className="min-h-11 rounded-lg border border-amber-300 bg-white px-4 text-sm font-semibold text-amber-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-800 disabled:opacity-50">{number}</button>)}
            </div>
            {isLookingUp && <p className="mt-3 flex items-center gap-2 text-sm text-amber-900"><Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> Recherche en cours…</p>}
          </div>}
        </div>
      </div>

      {result && <section ref={resultPanel} aria-labelledby="scan-result-title" className="scroll-mt-24">
        <div className="mb-5 flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-full bg-[#8f2430]/10 text-[#8f2430]"><ArrowDown className="size-4" aria-hidden="true" /></span>
          <div>
            <h2 id="scan-result-title" className="text-xl font-semibold tracking-tight text-stone-950">Résultat de la recherche</h2>
            <p className="mt-0.5 text-xs text-stone-500">{resultSource === 'photo' ? 'Les correspondances avec ta photo.' : 'Les fiches Cardmarket pour ta référence.'}</p>
          </div>
        </div>
        <ScanResult result={result} source={resultSource} />
      </section>}
      <p aria-live="polite" className="sr-only">{result ? 'Résultat de la recherche disponible.' : busy ? 'Recherche en cours.' : ''}</p>
    </section>
  );
}

function ModeButton({ active, children, disabled, icon, onClick }: { active: boolean; children: string; disabled: boolean; icon: ReactNode; onClick: () => void }) {
  return <button type="button" aria-pressed={active} disabled={disabled} onClick={onClick}
    className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-5 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8f2430] disabled:opacity-50 ${active ? 'bg-white text-[#8f2430] shadow-sm' : 'text-stone-500 hover:text-stone-900'}`}>
    {icon}{children}
  </button>;
}
