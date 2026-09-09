import { Camera, Keyboard } from 'lucide-react';
import { type ChangeEvent, type ReactNode, useEffect, useRef, useState } from 'react';

import { isNumberConfirmation, lookupCard, resolveCard, scanCard, type NumberConfirmationResult, type RecognizedScanResult } from '../../api/scanCard';
import { errorMessage } from '../../api/http';
import { cardNumberCrop } from './card-number-crop';
import { ManualLookup } from './components/ManualLookup';
import { PhotoPicker } from './components/PhotoPicker';
import { ScanResult } from './components/ScanResult';

const MAX_FILE_SIZE = 7 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
type ScanMode = 'photo' | 'manual';

function readFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function Scanner() {
  const [mode, setMode] = useState<ScanMode>('photo');
  const [cardNumber, setCardNumber] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<RecognizedScanResult | null>(null);
  const [confirmation, setConfirmation] = useState<NumberConfirmationResult | null>(null);
  const [resultSource, setResultSource] = useState<'photo' | 'manual'>('photo');
  const [error, setError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const resultPanel = useRef<HTMLElement>(null);

  const busy = isImporting || isScanning || isLookingUp;

  useEffect(() => {
    if ((result || confirmation) && window.innerWidth < 1024) {
      resultPanel.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [result, confirmation]);

  function selectMode(nextMode: ScanMode) {
    if (busy || nextMode === mode) return;
    setMode(nextMode);
    setError(null);
    setResult(null);
    setConfirmation(null);
  }

  async function importPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setError(null);
    setResult(null);
    setConfirmation(null);

    if (!IMAGE_TYPES.includes(file.type)) {
      setError('Choisis une photo au format JPG, PNG ou WebP.');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError('Cette photo est trop volumineuse. La taille maximale est de 7 Mo.');
      return;
    }

    setIsImporting(true);
    try {
      setPreview(await readFile(file));
    } catch (reason) {
      setError(errorMessage(reason, 'Impossible de lire cette photo. Essaie avec une autre image.'));
    } finally {
      setIsImporting(false);
    }
  }

  async function recognizeCard() {
    if (!preview || busy) return;

    setIsScanning(true);
    setError(null);
    setResult(null);
    try {
      const scanResult = await scanCard(preview, await cardNumberCrop(preview));
      setResultSource('photo');
      if (isNumberConfirmation(scanResult)) {
        setConfirmation(scanResult);
      } else {
        setResult(scanResult);
        setCardNumber(scanResult.card.cardNumber);
      }
    } catch (reason) {
      setError(errorMessage(reason, 'Impossible de scanner cette carte pour le moment.'));
    } finally {
      setIsScanning(false);
    }
  }

  async function confirmCardNumber(number: string) {
    if (!confirmation || !preview || busy) return;
    setIsLookingUp(true);
    setError(null);
    try {
      const lookup = await resolveCard(number, preview);
      setResult({
        ...lookup,
        card: {
          ...lookup.card,
          language: confirmation.card.language,
          variant: confirmation.card.variant,
          confidence: confirmation.card.confidence,
        },
      });
      setCardNumber(number);
      setConfirmation(null);
      setResultSource('photo');
    } catch (reason) {
      setError(errorMessage(reason, 'Impossible de rechercher cette carte.'));
    } finally {
      setIsLookingUp(false);
    }
  }

  async function findCard() {
    if (!cardNumber.trim() || busy) return;

    setIsLookingUp(true);
    setError(null);
    setResult(null);
    setConfirmation(null);
    try {
      setResult(await lookupCard(cardNumber));
      setResultSource('manual');
    } catch (reason) {
      setError(errorMessage(reason, 'Recherche impossible.'));
    } finally {
      setIsLookingUp(false);
    }
  }

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
