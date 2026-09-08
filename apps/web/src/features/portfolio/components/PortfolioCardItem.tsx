import { useState } from 'react';
import { Trash2 } from 'lucide-react';

import type { PortfolioCard } from '../../../api/portfolio';

const euros = new Intl.NumberFormat('fr-BE', { style: 'currency', currency: 'EUR' });

export function PortfolioCardItem({ card, onRemove }: { card: PortfolioCard; onRemove: (id: number) => Promise<void> }) {
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setRemoving(true);
    setError(null);
    try {
      await onRemove(card.id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'La suppression a échoué.');
      setRemoving(false);
    }
  }

  return (
    <article className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4">
      {card.imageUrl && <img src={card.imageUrl} alt={card.name} loading="lazy" className="h-64 w-full rounded-lg bg-slate-50 object-contain p-2" />}
      <div>
        <p className="text-xs font-medium text-slate-500">{card.cardNumber} · Quantité : {card.quantity}</p>
        <h2 className="mt-1 font-semibold">{card.name}</h2>
        {card.expansion && <p className="mt-1 text-sm text-slate-500">{card.expansion}</p>}
      </div>
      <div className="flex flex-wrap gap-1.5 text-xs text-slate-700">
        {[card.language, card.rarity, card.variant].filter(Boolean).map((label, index) => <span key={index} className="rounded-full bg-slate-100 px-2.5 py-1">{label}</span>)}
      </div>
      <p className="text-sm"><strong>{card.trendPrice === undefined ? 'Cote indisponible' : euros.format(card.trendPrice)}</strong> <span className="text-slate-500">par carte, à l’ajout</span></p>
      <div className="mt-auto border-t border-slate-100 pt-3 text-sm">
        {confirming ? (
          <div className="space-y-2">
            <p>Retirer les {card.quantity} exemplaire{card.quantity > 1 ? 's' : ''} de cette variante ?</p>
            <div className="flex gap-3">
              <button disabled={removing} onClick={() => void remove()} className="min-h-10 font-semibold text-red-700 disabled:opacity-50">{removing ? 'Suppression…' : 'Retirer'}</button>
              <button disabled={removing} onClick={() => setConfirming(false)} className="min-h-10 text-slate-600">Annuler</button>
            </div>
          </div>
        ) : <button onClick={() => setConfirming(true)} className="inline-flex min-h-10 items-center gap-2 text-slate-500 hover:text-red-700"><Trash2 className="size-4" aria-hidden="true" /> Retirer de la collection</button>}
        {error && <p role="alert" className="mt-2 text-red-700">{error}</p>}
      </div>
    </article>
  );
}
