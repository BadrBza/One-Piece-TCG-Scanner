import { useState } from 'react';
import { ArrowRight, Check, Layers, Loader2, Plus } from 'lucide-react';

import { addPortfolioCard, type NewPortfolioCard } from '../portfolio.api';
import { errorMessage } from '../../../lib/http';

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
      setError(errorMessage(reason, 'Impossible d’ajouter cette carte.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2 border-t border-stone-200 pt-4">
      <button type="button" onClick={() => void add()} disabled={saving}
        className="inline-flex min-h-11 w-full sm:w-auto items-center justify-center gap-2 rounded-md bg-[#8f2430] px-4 text-sm font-semibold text-white hover:bg-[#761d27] disabled:opacity-60">
        {saving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
        {saving ? 'Ajout en cours…' : quantity ? 'Ajouter un autre exemplaire' : 'Ajouter à ma collection'}
      </button>
      {quantity !== null && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
          <div role="status" className="flex items-start gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <Check className="size-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold text-emerald-900">Carte ajoutée à ta collection</p>
              <p className="mt-1 text-xs text-emerald-800">{quantity} exemplaire{quantity > 1 ? 's' : ''} dans ta collection.</p>
            </div>
          </div>
          <a href="#portfolio" className="group mt-4 flex min-h-11 items-center gap-2 rounded-lg border border-emerald-200 bg-white px-4 text-sm font-semibold text-emerald-900 transition-colors hover:border-emerald-300 hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">
            <Layers className="size-4 shrink-0" aria-hidden="true" />
            Voir ma collection
            <ArrowRight className="ml-auto size-4 shrink-0" aria-hidden="true" />
          </a>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </div>
  );
}
