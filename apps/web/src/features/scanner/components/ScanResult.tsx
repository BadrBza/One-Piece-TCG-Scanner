import type { NumberConfirmationResult, RecognizedScanResult } from '../../../api/scanCard';
import { CardmarketPrices } from './CardmarketPrices';
import { languageLabels, variantLabels } from '../labels';
import { FileSearch, Loader2, ScanLine } from 'lucide-react';

type Props = {
  error: string | null;
  result: RecognizedScanResult | null;
  confirmation: NumberConfirmationResult | null;
  isConfirming: boolean;
  isLoading: boolean;
  loadingLabel: string;
  onConfirm: (number: string) => void;
  source: 'photo' | 'manual';
};

export function ScanResult({ confirmation, error, isConfirming, isLoading, loadingLabel, onConfirm, result, source }: Props) {
  return (
    <>
      <div className="flex items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
          <FileSearch className="size-5" aria-hidden="true" />
        </span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600">Analyse</p>
          <h2 className="text-xl font-semibold">Résultat de la recherche</h2>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      {isLoading && !confirmation ? (
        <div className="mt-6 flex min-h-56 flex-col items-center justify-center rounded-xl bg-slate-50 px-5 text-center" role="status">
          <Loader2 className="size-9 animate-spin text-blue-600" aria-hidden="true" />
          <p className="mt-4 font-semibold text-slate-900">Analyse en cours</p>
          <p className="mt-1 max-w-sm text-sm text-slate-500">{loadingLabel}</p>
        </div>
      ) : confirmation ? (
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h3 className="font-semibold text-amber-950">Confirme le numéro imprimé</h3>
          <p className="mt-1 text-sm text-amber-800">Les deux lectures ne correspondent pas. Compare-les avec le numéro visible sur ta photo.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            {confirmation.numberCandidates.map(number => (
              <button key={number} type="button" disabled={isConfirming} onClick={() => onConfirm(number)}
                className="min-h-11 rounded-lg border border-amber-300 bg-white px-4 font-semibold text-slate-900 hover:border-blue-500 disabled:opacity-50">
                {number}
              </button>
            ))}
          </div>
        </div>
      ) : result ? (
        <div className="mt-5 space-y-5">
          <dl className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
            <CardField label="Carte" value={result.card.name} />
            <CardField label="Numéro" value={result.card.cardNumber} />
            <CardField label="Langue" value={languageLabels[result.card.language]} />
            <CardField label="Confiance estimée par l’IA" value={source === 'photo' ? `${Math.round(result.card.confidence * 100)}%` : 'Recherche manuelle'} />
            <CardField label="Rareté" value={result.card.rarity ?? 'Non déterminée'} />
            <CardField label="Variante estimée" value={variantLabels[result.card.variant]} />
          </dl>
          <CardmarketPrices price={result.prices.cardmarket} card={result.card} />
        </div>
      ) : (
        <div className="mt-6 flex flex-col items-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-9 text-center">
          <ScanLine className="size-8 text-slate-400" strokeWidth={1.5} aria-hidden="true" />
          <p className="mt-3 text-lg font-semibold">Prêt à rechercher</p>
          <p className="mt-1 max-w-sm text-sm text-slate-500">Importe une photo ou saisis le numéro inscrit sur ta carte.</p>
        </div>
      )}
    </>
  );
}

function CardField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 break-words font-semibold text-slate-900">{value}</dd>
    </div>
  );
}
