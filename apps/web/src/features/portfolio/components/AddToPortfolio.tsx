import { useState } from 'react';
import { Check, Loader2, Plus } from 'lucide-react';

import { addPortfolioCard, type NewPortfolioCard } from '../../../api/portfolio';

export function AddToPortfolio({ card }: { card: NewPortfolioCard }) {
  const [saving, setSaving] = useState(false);
  const [quantity, setQuantity] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      setQuantity((await addPortfolioCard(card)).quantity);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Impossible d’ajouter cette carte.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2 border-t border-slate-200 pt-4">
      <button type="button" onClick={() => void add()} disabled={saving}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
        {saving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
        {saving ? 'Ajout en cours…' : quantity ? 'Ajouter un autre exemplaire' : 'Ajouter à ma collection'}
      </button>
      {quantity !== null && (
        <p role="status" className="flex flex-wrap items-center gap-1.5 text-sm text-slate-600">
          <Check className="size-4 text-green-700" aria-hidden="true" />
          Carte ajoutée · {quantity} exemplaire{quantity > 1 ? 's' : ''} dans ta collection.
          <a href="#portfolio" className="text-blue-700 underline">Voir ma collection</a>
        </p>
      )}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </div>
  );
}
