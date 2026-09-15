import { Camera, ImagePlus, Loader2, ScanSearch, Upload, Check } from 'lucide-react';
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
  const cameraInput = useRef<HTMLInputElement>(null);

  return (
    <section id="scanner" aria-label="Importer une photo de carte" className="relative flex scroll-mt-20 flex-col gap-5">
      {preview ? (
        <div className="relative flex min-h-64 items-center justify-center overflow-hidden rounded-xl border border-stone-200 bg-stone-100/70 p-5">
          <img alt="Aperçu de la carte importée" className={`max-h-[min(360px,45dvh)] w-full rounded-sm object-contain transition ${isScanning ? 'opacity-40' : ''}`} src={preview} />
          {isScanning && <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center" role="status">
            <Loader2 className="size-9 loading-indicator text-[#8f2430]" aria-hidden="true" />
            <p className="max-w-52 text-sm font-semibold text-stone-800">Lecture de la carte et comparaison des variantes…</p>
          </div>}
        </div>
      ) : (
        <button type="button" disabled={busy} onClick={() => input.current?.click()}
          className="group flex min-h-52 flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#8f2430]/20 bg-[#8f2430]/[0.025] px-4 py-6 sm:px-6 sm:py-10 sm:min-h-72 text-center transition hover:border-[#8f2430] hover:bg-[#faf5f3] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8f2430] disabled:opacity-60">
          <span className="flex size-16 items-center justify-center rounded-2xl border border-[#8f2430]/10 bg-white text-[#8f2430] shadow-sm transition group-hover:-translate-y-1 motion-reduce:transform-none">
            {isImporting ? <Loader2 className="size-8 loading-indicator" aria-hidden="true" /> : <ImagePlus className="size-8" aria-hidden="true" />}
          </span>
          <span className="mt-5 text-lg font-semibold text-stone-900">{isImporting ? 'Import en cours…' : 'Ajoute la photo de ta carte'}</span>
          <span className="mt-2 max-w-xs text-sm leading-relaxed text-stone-500">Choisir un fichier · JPG, PNG ou WebP · 7 Mo max.</span>
        </button>
      )}

      <div className={`mx-auto grid w-full max-w-lg gap-3 ${preview ? 'sm:grid-cols-2' : ''}`}>
        <button type="button" disabled={busy} onClick={() => cameraInput.current?.click()}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#8f2430]/25 bg-[#8f2430]/5 px-4 py-2 text-sm font-semibold text-[#8f2430] transition hover:bg-[#8f2430]/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8f2430] disabled:opacity-50">
          <Camera className="size-5 shrink-0" aria-hidden="true" />
          {preview ? 'Reprendre une photo' : 'Prendre une photo'}
        </button>
        {preview && <button
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8f2430] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={busy}
          onClick={() => input.current?.click()}
          type="button"
        >
          {isImporting ? <Loader2 className="size-4 loading-indicator" aria-hidden="true" /> : <Upload className="size-4" aria-hidden="true" />}
          {isImporting ? 'Import en cours…' : 'Changer la photo'}
        </button>}
        {preview && <button
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#8f2430] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#761d27] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8f2430] disabled:cursor-not-allowed disabled:bg-stone-400 sm:col-span-2"
          disabled={busy}
          onClick={onScan}
          type="button"
        >
          {isScanning ? <Loader2 className="size-4 loading-indicator" aria-hidden="true" /> : <ScanSearch className="size-4" aria-hidden="true" />}
          {isScanning ? 'Analyse en cours…' : 'Analyser la carte'}
        </button>}
      </div>

      <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs text-stone-500">
        {['Carte entière visible', 'Photo prise de face', 'Bonne luminosité'].map(tip => (
          <span key={tip} className="inline-flex items-center gap-1.5"><Check className="size-3.5 text-[#8f2430]/60" aria-hidden="true" />{tip}</span>
        ))}
      </div>
      <input
        accept="image/*"
        capture="environment"
        className="hidden"
        disabled={busy}
        onChange={onChange}
        ref={cameraInput}
        type="file"
      />
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
