import { ImagePlus, Loader2, ScanSearch, Sparkles, Upload } from 'lucide-react';
import { type ChangeEvent, useRef } from 'react';

type Props = {
  busy: boolean;
  canScan: boolean;
  isImporting: boolean;
  isScanning: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onScan: () => void;
  preview: string | null;
};

export function PhotoPicker({ busy, canScan, isImporting, isScanning, onChange, onScan, preview }: Props) {
  const input = useRef<HTMLInputElement>(null);

  return (
    <section id="scanner" aria-label="Importer une photo de carte" className="relative flex min-h-[480px] scroll-mt-20 flex-col items-center justify-center gap-5 overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm sm:p-7">
      {preview ? (
        <div className="relative w-full max-w-sm">
          <span className="absolute -left-2 -top-2 z-10 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm">Photo sélectionnée</span>
          <img alt="Aperçu de la carte importée" className="max-h-[530px] w-full rounded-xl border border-slate-200 bg-slate-50 object-contain p-2" src={preview} />
        </div>
      ) : (
        <div className="flex max-w-sm flex-col items-center gap-4 py-8">
          <span className="flex size-16 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <ImagePlus className="size-9" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Importe une photo de ta carte</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">Une photo nette, prise de face, permet de mieux lire le numéro et la langue.</p>
          </div>
        </div>
      )}

      <div className="flex w-full max-w-sm flex-col gap-3 sm:flex-row">
        <button
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={busy}
          onClick={() => input.current?.click()}
          type="button"
        >
          {isImporting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Upload className="size-4" aria-hidden="true" />}
          {isImporting ? 'Import en cours…' : preview ? 'Changer la photo' : 'Importer une photo'}
        </button>
        {preview && (
          <button
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:bg-slate-400"
            disabled={!canScan}
            onClick={onScan}
            type="button"
          >
            {isScanning ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <ScanSearch className="size-4" aria-hidden="true" />}
            {isScanning ? 'Analyse en cours…' : 'Analyser la carte'}
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Sparkles className="size-3.5 text-slate-400" aria-hidden="true" />
        JPG, PNG ou WebP · 7 Mo maximum · Une carte par photo
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
