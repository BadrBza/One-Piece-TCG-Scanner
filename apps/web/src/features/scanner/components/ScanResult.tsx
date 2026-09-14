import type { RecognizedScanResult } from '../scanner.api';
import { CardmarketPrices } from './CardmarketPrices';
import { languageLabels, variantLabels } from '../labels';

export function ScanResult({ result, source }: { result: RecognizedScanResult; source: 'photo' | 'manual' }) {
  return <div className="space-y-5">
          <dl className="grid grid-cols-2 gap-x-5 gap-y-4 rounded-2xl border border-stone-200 bg-[#fffefa] p-5 text-sm sm:p-6">
            <CardField label="Carte" value={result.card.name} />
            <CardField label="Numéro" value={result.card.cardNumber} />
            {(source === 'photo' || result.card.language !== 'UNKNOWN') && <CardField label="Langue" value={languageLabels[result.card.language]} />}
            <CardField label="Correspondance estimée" value={source === 'photo' ? result.card.confidence > 0 ? `${Math.round(result.card.confidence * 100)}%` : 'À confirmer' : 'Recherche manuelle'} />
            {(source === 'photo' || result.card.rarity) && <CardField label="Rareté" value={result.card.rarity ?? 'Non déterminée'} />}
            {(source === 'photo' || result.card.variant !== 'unknown') && <CardField label="Variante estimée" value={variantLabels[result.card.variant]} />}
          </dl>
          <CardmarketPrices price={result.prices.cardmarket} card={result.card} manual={source === 'manual'} />
  </div>;
}

function CardField({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0">
    <dt className="text-xs text-stone-500">{label}</dt>
    <dd className="mt-1 break-words font-semibold text-stone-900">{value}</dd>
  </div>;
}
