import { useEffect, useMemo, useState } from 'react';
import { ArrowDownUp, Layers, Plus } from 'lucide-react';

import { getPortfolio, removePortfolioCard, type PortfolioCard } from '../api/portfolio';
import { errorMessage } from '../api/http';
import { PortfolioCardItem } from '../features/portfolio/components/PortfolioCardItem';

const euros = new Intl.NumberFormat('fr-BE', { style: 'currency', currency: 'EUR' });
type SortOrder = 'price-desc' | 'price-asc' | 'recent' | 'name';

export function PortfolioPage() {
  const [cards, setCards] = useState<PortfolioCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>('price-desc');

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setCards(await getPortfolio());
    } catch (reason) {
      setError(errorMessage(reason, 'La collection est indisponible.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function remove(id: number) {
    await removePortfolioCard(id);
    setCards(current => current.filter(card => card.id !== id));
  }

  const count = cards.reduce((sum, card) => sum + card.quantity, 0);
  const estimatedValue = cards.reduce((sum, card) => sum + (card.trendPrice ?? 0) * card.quantity, 0);
  const unpricedCount = cards.filter(card => card.trendPrice === undefined).reduce((sum, card) => sum + card.quantity, 0);
  const sortedCards = useMemo(() => [...cards].sort((a, b) => {
    if (sortOrder === 'name') return a.name.localeCompare(b.name, 'fr');
    if (sortOrder === 'recent') return Date.parse(b.addedAt) - Date.parse(a.addedAt);
    if (a.trendPrice === undefined && b.trendPrice === undefined) return 0;
    if (a.trendPrice === undefined) return 1;
    if (b.trendPrice === undefined) return -1;
    return sortOrder === 'price-desc'
      ? b.trendPrice - a.trendPrice
      : a.trendPrice - b.trendPrice;
  }), [cards, sortOrder]);

  return (
    <section id="portfolio" className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Ma collection</h1>
        </div>
        <a href="#scanner" className="inline-flex min-h-11 items-center gap-2 rounded-md bg-[#8f2430] px-4 text-sm font-semibold text-white hover:bg-[#761d27]">
          <Plus className="size-4" aria-hidden="true" /> Ajouter une carte
        </a>
      </div>
      {loading ? <p role="status" className="py-12 text-center text-slate-500">Chargement de la collection…</p> : error ? (
        <div className="rounded-md border border-red-200 bg-[#fffefa] p-5">
          <p role="alert" className="text-sm text-red-700">{error}</p>
          <button onClick={() => void load()} className="mt-3 text-sm font-semibold text-[#8f2430]">Réessayer</button>
        </div>
      ) : cards.length === 0 ? (
        <div className="rounded-md border border-stone-300 bg-[#fffefa] px-6 py-16 text-center">
          <Layers className="mx-auto size-9 text-stone-400" aria-hidden="true" />
          <h2 className="mt-4 text-lg font-semibold">Ta collection commence ici</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-stone-500">Scanne une carte, choisis sa variante puis ajoute-la à ta collection.</p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-x-10 gap-y-3 border-y border-stone-300 py-5">
            <p><strong className="text-xl">{count}</strong> <span className="text-sm text-stone-500">carte{count > 1 ? 's' : ''}</span></p>
            <div>
              <p className="text-xl font-semibold">{unpricedCount === count ? 'Cote indisponible' : euros.format(estimatedValue)}</p>
              {unpricedCount > 0 && <p className="text-xs text-stone-500">{unpricedCount} carte{unpricedCount > 1 ? 's' : ''} sans cote</p>}
            </div>
          </div>
          <div className="flex justify-end">
            <label className="flex min-h-11 items-center gap-2 rounded-md border border-stone-300 bg-[#fffefa] px-3 text-sm font-medium text-stone-700">
              <ArrowDownUp className="size-4 text-stone-400" aria-hidden="true" />
              <span className="sr-only">Trier les cartes</span>
              <select aria-label="Trier les cartes" value={sortOrder} onChange={event => setSortOrder(event.target.value as SortOrder)}
                className="cursor-pointer bg-transparent pr-1 outline-none">
                <option value="price-desc">Cote : plus élevée</option>
                <option value="price-asc">Cote : plus basse</option>
                <option value="recent">Ajout le plus récent</option>
                <option value="name">Nom de la carte</option>
              </select>
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sortedCards.map(card => <PortfolioCardItem key={card.id} card={card} onRemove={remove} />)}
          </div>
        </>
      )}
    </section>
  );
}
