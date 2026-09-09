import { Check, ImagePlus, Loader2, ScanSearch, Upload } from 'lucide-react';
import { type ChangeEvent, useRef } from 'react';

type Props = {
  busy: boolean;
  isImporting: boolean;
  isScanning: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onScan: () => void;
  preview: string | null;
};

export function PhotoPicker({ busy, isImporting, isScanning, onChange, onScan, preview }: Props) {
  const input = useRef<HTMLInputElement>(null);

  return (
    <section id="scanner" aria-label="Importer une photo de carte" className="relative flex min-h-[500px] scroll-mt-20 flex-col gap-5 overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      {preview ? (
        <div className="relative mx-auto flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-xl bg-slate-50 p-3 ring-1 ring-inset ring-slate-200">
          <img alt="Aperçu de la carte importée" className={`max-h-[460px] w-full rounded-lg object-contain transition ${isScanning ? 'opacity-40' : ''}`} src={preview} />
          {isScanning && <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
            <Loader2 className="size-9 animate-spin text-blue-600" aria-hidden="true" />
            <p className="max-w-52 text-sm font-semibold text-slate-800">Lecture de la carte et comparaison des variantes…</p>
          </div>}
        </div>
      ) : (
        <button type="button" disabled={busy} onClick={() => input.current?.click()}
          className="flex flex-1 flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/60 px-6 py-12 text-center transition hover:border-blue-400 hover:bg-blue-50/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:opacity-60">
          <span className="flex size-16 items-center justify-center rounded-full bg-blue-100 text-blue-700">
            {isImporting ? <Loader2 className="size-8 animate-spin" aria-hidden="true" /> : <ImagePlus className="size-8" aria-hidden="true" />}
          </span>
          <span className="mt-5 text-xl font-semibold text-slate-900">{isImporting ? 'Import en cours…' : 'Choisir une photo'}</span>
          <span className="mt-2 max-w-xs text-sm leading-relaxed text-slate-500">JPG, PNG ou WebP, jusqu’à 7 Mo</span>
        </button>
      )}

      {preview && <div className="mx-auto flex w-full max-w-sm flex-col gap-3 sm:flex-row">
        <button
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={busy}
          onClick={() => input.current?.click()}
          type="button"
        >
          {isImporting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Upload className="size-4" aria-hidden="true" />}
          {isImporting ? 'Import en cours…' : preview ? 'Changer la photo' : 'Importer une photo'}
        </button>
        <button
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:bg-slate-400"
          disabled={busy}
          onClick={onScan}
          type="button"
        >
          {isScanning ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <ScanSearch className="size-4" aria-hidden="true" />}
          {isScanning ? 'Analyse en cours…' : 'Analyser la carte'}
        </button>
      </div>}

      <div className="grid gap-2 text-xs text-slate-500 sm:grid-cols-3">
        {['Carte entière visible', 'Photo prise de face', 'Bonne luminosité'].map(tip => (
          <span key={tip} className="flex items-center justify-center gap-1.5"><Check className="size-3.5 text-emerald-600" aria-hidden="true" />{tip}</span>
        ))}
      </div>
      <input
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        disabled={busy}
        onChange={onChange}
        ref={input}
        type="file"
      />
    </section>
  );
}
