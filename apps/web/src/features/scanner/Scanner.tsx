import { Camera, Keyboard } from 'lucide-react';
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
    if ((result || confirmation) && window.innerWidth < 1024) {
      resultPanel.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [result, confirmation]);

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-5 border-b border-stone-300 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-stone-950">Scanner une carte</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone-600">Importe une photo nette pour identifier la carte, sa variante et sa cote Cardmarket.</p>
        </div>
        <div className="inline-flex border-b border-stone-300" role="tablist" aria-label="Méthode de recherche">
          <ModeButton active={mode === 'photo'} disabled={busy} icon={<Camera className="size-4" />} onClick={() => selectMode('photo')}>Photo</ModeButton>
          <ModeButton active={mode === 'manual'} disabled={busy} icon={<Keyboard className="size-4" />} onClick={() => selectMode('manual')}>Numéro</ModeButton>
        </div>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(340px,0.85fr)_minmax(0,1.15fr)]">
        {mode === 'photo' ? (
          <PhotoPicker busy={busy} isImporting={isImporting} isScanning={isScanning}
            onChange={importPhoto} onScan={() => void recognizeCard()} preview={preview} />
        ) : (
          <div className="rounded-md border border-stone-300 bg-[#fffefa] p-5 sm:p-7">
            <ManualLookup cardNumber={cardNumber} disabled={busy} isLoading={isLookingUp}
              onChange={setCardNumber} onSubmit={() => void findCard()} />
          </div>
        )}

        <aside ref={resultPanel} className="scroll-mt-24 rounded-md border border-stone-300 bg-[#fffefa] p-5 sm:p-6">
          <ScanResult confirmation={confirmation} error={error} isConfirming={isLookingUp}
            isLoading={isScanning || isLookingUp} loadingLabel={isScanning ? 'Analyse de la photo et recherche de la cote…' : 'Recherche de la carte…'}
            onConfirm={number => void confirmCardNumber(number)} result={result} source={resultSource} />
        </aside>
      </div>
    </section>
  );
}

function ModeButton({ active, children, disabled, icon, onClick }: { active: boolean; children: string; disabled: boolean; icon: ReactNode; onClick: () => void }) {
  return (
    <button type="button" role="tab" aria-selected={active} disabled={disabled} onClick={onClick}
      className={active
        ? 'inline-flex min-h-10 items-center gap-2 border-b-2 border-[#8f2430] px-4 text-sm font-semibold text-stone-950 disabled:opacity-60'
        : 'inline-flex min-h-10 items-center gap-2 border-b-2 border-transparent px-4 text-sm font-semibold text-stone-500 hover:text-stone-950 disabled:opacity-60'}>
      {icon}{children}
    </button>
  );
}
