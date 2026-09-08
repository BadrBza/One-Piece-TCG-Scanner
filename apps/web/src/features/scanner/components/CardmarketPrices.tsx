import { useState } from 'react';
import { ArrowLeft, Coins, ExternalLink } from 'lucide-react';

import type { CardRecognition, PriceResult } from '../../../api/scanCard';
import { languageLabels } from '../labels';

type Product = NonNullable<PriceResult['products']>[number];

const euros = new Intl.NumberFormat('fr-BE', { style: 'currency', currency: 'EUR' });

function title(product: Product) {
  const variant = product.variantLabel && product.variantLabel !== 'Non déterminée' ? ` · ${product.variantLabel}` : '';
  return `Version ${product.version ?? 1}${variant}`;
}

export function CardmarketPrices({ price, card }: { price: PriceResult; card: CardRecognition }) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selected = price.products?.find(product => product.id === selectedId);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 text-slate-900 sm:p-5" aria-label="Variantes Cardmarket">
      {selected ? (
        <SelectedVariant product={selected} onBack={() => setSelectedId(null)} />
      ) : (
        <VariantList card={card} price={price} onSelect={setSelectedId} />
      )}
    </section>
  );
}

function SelectedVariant({ product, onBack }: { product: Product; onBack: () => void }) {
  return (
    <>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600">Estimation Cardmarket</p>
      <h3 className="mt-1 text-xl font-semibold">Cote de la variante choisie</h3>
      <div className="mt-3 space-y-3">
        {product.imageUrl && <img src={product.imageUrl} alt={product.name} className="mx-auto max-h-72 rounded-lg border border-slate-200 bg-slate-50 object-contain p-2" />}
        <p className="font-medium">{title(product)}</p>
        <p className="text-sm text-slate-700">{product.name}</p>
        {product.expansion && <p className="text-sm text-slate-500">Série : {product.expansion}</p>}
        <div className="grid grid-cols-2 gap-2 text-sm text-slate-700">
          <p>Langue : <strong>{product.languageLabel ?? 'Non déterminée'}</strong></p>
          <p>Rareté : <strong>{product.rarity ?? 'Non déterminée'}</strong></p>
          <p className="col-span-2">Illustration : <strong>{product.variantLabel ?? 'Non déterminée'}</strong></p>
        </div>
        <div className="flex items-center gap-3 rounded-lg bg-blue-50 p-4">
          <Coins className="size-6 text-blue-600" aria-hidden="true" />
          <p className="text-3xl font-bold text-slate-900">{product.trendPrice === undefined ? 'Cote indisponible' : euros.format(product.trendPrice)}</p>
        </div>
        <p className="text-xs leading-relaxed text-slate-500">Tendance Cardmarket de cette fiche, sans filtre de langue, d’état ou de frais de port.</p>
        <div className="flex flex-wrap gap-3">
          <a href={`https://www.cardmarket.com/en/OnePiece/Products?idProduct=${product.id}`} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700">Voir sur Cardmarket <ExternalLink className="size-4" aria-hidden="true" /></a>
          <button type="button" onClick={onBack} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"><ArrowLeft className="size-4" aria-hidden="true" /> Changer de variante</button>
        </div>
      </div>
    </>
  );
}

function VariantList({ card, price, onSelect }: {
  card: CardRecognition;
  price: PriceResult;
  onSelect: (id: number) => void;
}) {
  return (
    <>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600">Variantes disponibles</p>
      <h3 className="mt-1 text-xl font-semibold">Choisis ta variante</h3>
      <p className="mt-3 text-sm text-slate-700">
        Ta carte semble être en <strong>{languageLabels[card.language]}</strong>
        {card.rarity && <> avec la rareté <strong>{card.rarity}</strong></>}.
      </p>
      <p className="mt-2 text-xs leading-relaxed text-slate-500">{price.message}</p>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {price.products?.map(product => (
          <VariantChoice key={product.id} product={product} onSelect={onSelect} />
        ))}
      </div>
    </>
  );
}

function VariantChoice({ product, onSelect }: { product: Product; onSelect: (id: number) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(product.id)}
      className="group flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-blue-400 hover:shadow-md focus-visible:outline-2 focus-visible:outline-blue-500"
    >
      {product.imageUrl
        ? <img src={product.imageUrl} alt={title(product)} loading="lazy" className="h-72 w-full rounded-lg bg-slate-50 object-contain p-1.5" />
        : <span className="flex h-72 items-center justify-center rounded-lg bg-slate-100 text-sm text-slate-500">Image indisponible</span>}
      <span className="text-base font-semibold text-slate-900">{title(product)}</span>
      <span className="text-sm text-slate-600">{product.name}</span>
      {product.expansion && <span className="text-xs text-slate-500">Série : {product.expansion}</span>}
      <div className="mt-1 flex flex-wrap gap-1.5">
        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">{product.languageLabel ?? 'Langue inconnue'}</span>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">{product.rarity ?? 'Rareté inconnue'}</span>
        <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">{product.variantLabel ?? 'Variante inconnue'}</span>
      </div>
      <span className="mt-auto pt-3 text-sm font-semibold text-blue-600">Choisir cette variante →</span>
    </button>
  );
}
