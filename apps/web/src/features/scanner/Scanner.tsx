import { type ChangeEvent, useState } from 'react';

import { lookupCard, scanCard, type ScanCardResult } from '../../api/scanCard';
import { cardNumberCrop } from './card-number-crop';
import { ManualLookup } from './components/ManualLookup';
import { PhotoPicker } from './components/PhotoPicker';
import { ScanResult } from './components/ScanResult';
import { ScannerHeader } from './components/ScannerHeader';

const MAX_FILE_SIZE = 7 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function readFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function Scanner() {
  const [cardNumber, setCardNumber] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<ScanCardResult | null>(null);
  const [resultSource, setResultSource] = useState<'photo' | 'manual'>('photo');
  const [error, setError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isLookingUp, setIsLookingUp] = useState(false);

  const busy = isImporting || isScanning || isLookingUp;

  async function importPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setError(null);
    setResult(null);

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
      setResult(scanResult);
      setResultSource('photo');
      setCardNumber(scanResult.card.cardNumber);
    } catch (reason) {
      setError(errorMessage(reason, 'Impossible de scanner cette carte pour le moment.'));
    } finally {
      setIsScanning(false);
    }
  }

  async function findCard() {
    if (!cardNumber.trim() || busy) return;

    setIsLookingUp(true);
    setError(null);
    setResult(null);
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
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 pb-8 sm:px-6 lg:px-8">
        <ScannerHeader />

        <div className="grid flex-1 items-start gap-6 lg:grid-cols-[minmax(340px,0.85fr)_minmax(0,1.15fr)]">
          <PhotoPicker
            busy={busy}
            canScan={Boolean(preview) && !busy}
            isImporting={isImporting}
            isScanning={isScanning}
            onChange={importPhoto}
            onScan={() => void recognizeCard()}
            preview={preview}
          />

          <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <ManualLookup
              cardNumber={cardNumber}
              disabled={busy}
              isLoading={isLookingUp}
              onChange={setCardNumber}
              onSubmit={() => void findCard()}
            />
            <ScanResult error={error} result={result} source={resultSource} />
          </aside>
        </div>
      </section>
    </main>
  );
}
