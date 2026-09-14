import { useState } from 'react';
import { Trash2 } from 'lucide-react';

import type { PortfolioCard } from '../portfolio.api';
import { errorMessage } from '../../../lib/http';
import { RemoveCardDialog } from './RemoveCardDialog';

const euros = new Intl.NumberFormat('fr-BE', { style: 'currency', currency: 'EUR' });
const dates = new Intl.DateTimeFormat('fr-BE', { dateStyle: 'medium' });

export function PortfolioCardItem({ card, onRemove }: { card: PortfolioCard; onRemove: (id: number) => Promise<void> }) {
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (removing) return;
    setRemoving(true);
    setError(null);
    try {
      await onRemove(card.id);
    } catch (reason) {
      setError(errorMessage(reason, 'La suppression a échoué.'));
      setRemoving(false);
    }
  }

  return (
    <article className="flex min-w-0 flex-col gap-3 [overflow-wrap:anywhere] rounded-md border border-stone-300 bg-[#fffefa] p-4">
      {card.imageUrl && <img src={card.imageUrl} alt={card.name} loading="lazy" className="h-64 w-full rounded-sm bg-stone-100 object-contain p-2" />}
      <div>
        <p className="text-xs font-medium text-stone-500">{card.cardNumber} · Quantité : {card.quantity}</p>
        <h2 className="mt-1 font-semibold">{card.name}</h2>
        {card.expansion && <p className="mt-1 text-sm text-stone-500">{card.expansion}</p>}
      </div>
      <div className="flex flex-wrap gap-x-2 gap-y-1 text-xs text-stone-600">
        {[card.language, card.rarity, card.variant].filter(Boolean).map((label, index) => <span key={index}>{index > 0 && <span className="mr-2 text-stone-300">·</span>}{label}</span>)}
      </div>
      <div className="text-sm">
        <p><strong className="text-lg text-[#8f2430]">{card.trendPrice === undefined ? 'Cote indisponible' : euros.format(card.trendPrice)}</strong> <span className="text-stone-500">par carte</span></p>
        {card.priceUpdatedAt && <p className="mt-1 text-xs text-stone-500">Cote mise à jour le {dates.format(new Date(card.priceUpdatedAt))}</p>}
      </div>
      <div className="mt-auto border-t border-stone-200 pt-3 text-sm">
        <button onClick={() => { setError(null); setConfirming(true); }} className="inline-flex min-h-10 items-center gap-2 rounded-md text-stone-500 hover:text-red-700"><Trash2 className="size-4" aria-hidden="true" /> Retirer de la collection</button>
      </div>
      {confirming && <RemoveCardDialog card={card} removing={removing} error={error} onCancel={() => setConfirming(false)} onConfirm={() => void remove()} />}
    </article>
  );
}
