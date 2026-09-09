import { ImagePlus, Loader2, ScanSearch, Upload } from 'lucide-react';
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
    <section id="scanner" aria-label="Importer une photo de carte" className="relative flex min-h-[500px] scroll-mt-20 flex-col gap-5 overflow-hidden rounded-md border border-stone-300 bg-[#fffefa] p-5 sm:p-7">
      {preview ? (
        <div className="relative mx-auto flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-sm bg-stone-100 p-3 ring-1 ring-inset ring-stone-200">
          <img alt="Aperçu de la carte importée" className={`max-h-[460px] w-full rounded-sm object-contain transition ${isScanning ? 'opacity-40' : ''}`} src={preview} />
          {isScanning && <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
            <Loader2 className="size-9 animate-spin text-[#8f2430]" aria-hidden="true" />
            <p className="max-w-52 text-sm font-semibold text-stone-800">Lecture de la carte et comparaison des variantes…</p>
          </div>}
        </div>
      ) : (
        <button type="button" disabled={busy} onClick={() => input.current?.click()}
          className="flex flex-1 flex-col items-center justify-center rounded-sm border border-dashed border-stone-400 bg-stone-50 px-6 py-12 text-center transition hover:border-[#8f2430] hover:bg-[#faf5f3] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8f2430] disabled:opacity-60">
          <span className="text-[#8f2430]">
            {isImporting ? <Loader2 className="size-8 animate-spin" aria-hidden="true" /> : <ImagePlus className="size-8" aria-hidden="true" />}
          </span>
          <span className="mt-5 text-xl font-semibold text-stone-900">{isImporting ? 'Import en cours…' : 'Choisir une photo'}</span>
          <span className="mt-2 max-w-xs text-sm leading-relaxed text-stone-500">JPG, PNG ou WebP, jusqu’à 7 Mo</span>
        </button>
      )}

      {preview && <div className="mx-auto flex w-full max-w-sm flex-col gap-3 sm:flex-row">
        <button
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8f2430] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={busy}
          onClick={() => input.current?.click()}
          type="button"
        >
          {isImporting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Upload className="size-4" aria-hidden="true" />}
          {isImporting ? 'Import en cours…' : preview ? 'Changer la photo' : 'Importer une photo'}
        </button>
        <button
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md bg-[#8f2430] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#761d27] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8f2430] disabled:cursor-not-allowed disabled:bg-stone-400"
          disabled={busy}
          onClick={onScan}
          type="button"
        >
          {isScanning ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <ScanSearch className="size-4" aria-hidden="true" />}
          {isScanning ? 'Analyse en cours…' : 'Analyser la carte'}
        </button>
      </div>}

      <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs text-stone-500">
        {['Carte entière visible', 'Photo prise de face', 'Bonne luminosité'].map((tip, index) => (
          <span key={tip}>{index > 0 && <span className="mr-3 text-stone-300">·</span>}{tip}</span>
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
