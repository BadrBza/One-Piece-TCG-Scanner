import { useEffect, useRef, useState } from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';
import type { PokemonCandidate, PokemonCard } from '../scanner.api';
import { languageLabels } from '../labels';
import { euros } from '../../../lib/format';
import { AddToPortfolio } from '../../portfolio/components/AddToPortfolio';

export function PokemonResult({ card }: { card: PokemonCard }) {
  const [finitionId, choisirFinition] = useState(card.finishes.length === 1 ? card.finishes[0].id : '');
  const finition = card.finishes.find(finition => finition.id === finitionId);
  const panneau = usePokemonScroll(card, finitionId);
  useEffect(() => choisirFinition(card.finishes.length === 1 ? card.finishes[0].id : ''), [card]);

  return <section ref={panneau} tabIndex={-1} aria-label={`Carte trouvée : ${card.name}`}
    className="min-w-0 rounded-2xl border border-stone-200 bg-white p-4 outline-none sm:p-6">
    <p className="text-sm font-medium text-[#8f2430]">Pokémon · {languageLabels[card.language]}</p>
    <h3 className="mt-1 text-xl font-semibold text-stone-950">{card.name}</h3>
    <div className="mt-5 grid min-w-0 gap-6 lg:grid-cols-2">
      {card.imageUrl
        ? <img src={card.imageUrl} alt={card.name} className="mx-auto h-80 w-full max-w-xs self-start rounded-lg bg-stone-50 object-contain p-2 lg:h-[440px]" />
        : <div className="flex h-64 items-center justify-center rounded-xl bg-stone-50 text-stone-500">Image indisponible</div>}
      <div className="min-w-0 space-y-5 [overflow-wrap:anywhere]">
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div><dt className="text-stone-500">Référence</dt><dd className="mt-1 font-semibold">{card.cardNumber}</dd></div>
          <div><dt className="text-stone-500">Extension</dt><dd className="mt-1 font-semibold">{card.expansion}</dd></div>
          {card.rarity && <div className="col-span-2"><dt className="text-stone-500">Rareté</dt><dd className="mt-1 font-semibold">{card.rarity}</dd></div>}
        </dl>
        {card.finishes.length > 1 ? <label className="block text-sm font-semibold text-stone-800">Choisis la finition de ta carte
          <select value={finitionId} onChange={event => choisirFinition(event.target.value)}
            className="mt-2 min-h-12 w-full min-w-0 rounded-xl border border-stone-300 bg-white px-3 text-base focus:outline-[#8f2430]">
            <option value="" disabled>Sélectionner une finition</option>
            {card.finishes.map(finition => <option key={finition.id} value={finition.id}>{finition.label}</option>)}
          </select>
          <span className="mt-2 block text-xs font-normal text-stone-500">Vérifie les reflets et les éventuels marquages sur ta carte.</span>
        </label> : <p className="text-sm text-stone-700">Finition : <strong>{finition?.label}</strong></p>}
        {finition ? <>
          <div className="border-l-2 border-[#8f2430] bg-[#faf5f3] p-4">
            <p className="text-xs text-stone-500">Cote Cardmarket · données TCGdex</p>
            <p className="mt-1 text-2xl font-semibold text-stone-950">{finition.trendPrice === undefined ? 'Cote indisponible' : euros.format(finition.trendPrice)}</p>
          </div>
          <p className="text-xs leading-relaxed text-stone-500">Tendance de cette finition lorsqu’elle est disponible, sans garantie sur la langue, l’état ou les frais de port.</p>
          <AddToPortfolio key={`${card.catalogId}:${card.language}:${finition.id}`} card={{
            game: 'pokemon', catalogId: card.catalogId, finishId: finition.id, language: card.language,
            cardNumber: card.cardNumber, name: card.name, imageUrl: card.imageUrl, rarity: card.rarity,
            expansion: card.expansion, variant: finition.label, cardmarketProductId: finition.cardmarketProductId,
            trendPrice: finition.trendPrice, priceUpdatedAt: finition.priceUpdatedAt,
          }} />
          {finition.cardmarketProductId && <a href={`https://www.cardmarket.com/en/Pokemon/Products?idProduct=${finition.cardmarketProductId}`}
            target="_blank" rel="noreferrer" className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-stone-300 px-4 text-sm font-semibold text-stone-700 hover:bg-stone-50 sm:w-auto">
            Voir sur Cardmarket <ExternalLink className="size-4" aria-hidden="true" />
          </a>}
        </> : <p className="rounded-xl bg-stone-50 p-4 text-sm text-stone-600">Choisis une finition pour afficher sa cote et ajouter la carte à ta collection.</p>}
      </div>
    </div>
  </section>;
}

export function PokemonCandidates({ candidates, busy, onSelect }: {
  candidates: PokemonCandidate[]; busy: boolean; onSelect: (carte: PokemonCandidate) => void;
}) {
  const panneau = usePokemonScroll(candidates);
  return <section ref={panneau} tabIndex={-1} className="mt-5 rounded-2xl border border-stone-200 bg-white p-4 outline-none sm:p-6" aria-label="Choisir la carte Pokémon">
    <h3 className="text-lg font-semibold">Plusieurs cartes correspondent</h3>
    <p className="mt-1 text-sm text-stone-500">Choisis l’extension de ta carte pour continuer.</p>
    {busy && <p role="status" className="mt-3 flex items-center gap-2 text-sm"><Loader2 className="size-4 loading-indicator" aria-hidden="true" /> Chargement de la fiche…</p>}
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      {candidates.map(carte => <button key={`${carte.language}:${carte.catalogId}`} type="button" disabled={busy} onClick={() => onSelect(carte)}
        className="flex min-w-0 gap-4 rounded-xl border border-stone-200 p-3 text-left hover:border-[#8f2430] focus-visible:outline-[#8f2430] disabled:opacity-50">
        {carte.imageUrl && <img src={carte.imageUrl} alt={carte.name} loading="lazy" className="h-28 w-20 shrink-0 object-contain" />}
        <span className="min-w-0 self-center space-y-1 [overflow-wrap:anywhere]">
          <span className="block text-sm font-semibold">{carte.name}</span>
          <span className="block text-xs text-stone-500">{carte.cardNumber} · {languageLabels[carte.language]}</span>
          <span className="block text-sm text-stone-600">{carte.expansion}</span>
          <span className="block pt-2 text-sm font-semibold text-[#8f2430]">Choisir cette carte →</span>
        </span>
      </button>)}
    </div>
  </section>;
}

function usePokemonScroll(resultat: unknown, finition?: string) {
  const panneau = useRef<HTMLElement>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (!panneau.current) return;
      const entete = document.querySelector('[data-app-header]')?.getBoundingClientRect().height ?? 0;
      panneau.current.focus({ preventScroll: true });
      window.scrollTo({
        top: Math.max(0, window.scrollY + panneau.current.getBoundingClientRect().top - entete - 16),
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [resultat, finition]);
  return panneau;
}
