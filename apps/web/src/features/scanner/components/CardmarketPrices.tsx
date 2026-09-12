import { useEffect, useState } from 'react';
import { ArrowLeft, ExternalLink } from 'lucide-react';

import type { CardRecognition, PriceResult } from '../scanner.api';
import { languageLabels } from '../labels';
import { AddToPortfolio } from '../../portfolio/components/AddToPortfolio';

type Product = NonNullable<PriceResult['products']>[number];

const euros = new Intl.NumberFormat('fr-BE', { style: 'currency', currency: 'EUR' });

function title(product: Product) {
  const variant = product.variantLabel && product.variantLabel !== 'Non déterminée' ? ` · ${product.variantLabel}` : '';
  return `Version ${product.version ?? 1}${variant}`;
}

export function CardmarketPrices({ price, card }: { price: PriceResult; card: CardRecognition }) {
  const [selectedId, setSelectedId] = useState<number | null>(price.selectedProductId ?? null);
  const selected = price.products?.find(product => product.id === selectedId);

  useEffect(() => setSelectedId(price.selectedProductId ?? null), [price]);

  return (
    <section className="rounded-md border border-stone-300 bg-white p-4 text-stone-900 sm:p-5" aria-label="Variantes Cardmarket">
      {selected ? (
        <SelectedVariant key={selected.id} cardNumber={card.cardNumber} product={selected} onBack={() => setSelectedId(null)} />
      ) : (
        <VariantList card={card} price={price} onSelect={setSelectedId} />
      )}
    </section>
  );
}

function SelectedVariant({ cardNumber, product, onBack }: { cardNumber: string; product: Product; onBack: () => void }) {
  return (
    <>
      <p className="text-sm text-stone-500">Estimation Cardmarket</p>
      <h3 className="mt-1 text-xl font-semibold">Cote de ta carte</h3>
      <div className="mt-3 space-y-3">
        {product.imageUrl && <img src={product.imageUrl} alt={product.name} className="mx-auto max-h-72 rounded-sm border border-stone-200 bg-stone-50 object-contain p-2" />}
        <p className="font-medium">{title(product)}</p>
        <p className="text-sm text-stone-700">{product.name}</p>
        {product.expansion && <p className="text-sm text-stone-500">Série : {product.expansion}</p>}
        <div className="grid grid-cols-2 gap-2 text-sm text-stone-700">
          <p>Langue : <strong>{product.languageLabel ?? 'Non déterminée'}</strong></p>
          <p>Rareté : <strong>{product.rarity ?? 'Non déterminée'}</strong></p>
          <p className="col-span-2">Illustration : <strong>{product.variantLabel ?? 'Non déterminée'}</strong></p>
        </div>
        <div className="border-l-2 border-[#8f2430] bg-[#faf5f3] p-4">
          <p className="text-3xl font-semibold text-stone-950">{product.trendPrice === undefined ? 'Cote indisponible' : euros.format(product.trendPrice)}</p>
        </div>
        <p className="text-xs leading-relaxed text-stone-500">Tendance Cardmarket de cette fiche, sans filtre de langue, d’état ou de frais de port.</p>
        <AddToPortfolio card={{
          cardNumber, name: product.name, cardmarketProductId: product.id,
          imageUrl: product.imageUrl, language: product.languageLabel,
          rarity: product.rarity, variant: product.variantLabel,
          expansion: product.expansion, trendPrice: product.trendPrice,
        }} />
        <div className="flex flex-wrap gap-3">
          <a href={`https://www.cardmarket.com/en/OnePiece/Products?idProduct=${product.id}`} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-md bg-[#8f2430] px-4 text-sm font-semibold text-white transition hover:bg-[#761d27]">Voir sur Cardmarket <ExternalLink className="size-4" aria-hidden="true" /></a>
          <button type="button" onClick={onBack} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-stone-300 px-4 text-sm font-semibold text-stone-700 transition hover:bg-stone-50"><ArrowLeft className="size-4" aria-hidden="true" /> Changer de variante</button>
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
      <p className="text-sm text-stone-500">Variantes disponibles</p>
      <h3 className="mt-1 text-xl font-semibold">Choisis ta variante</h3>
      <p className="mt-3 text-sm text-stone-700">
        Ta carte semble être en <strong>{languageLabels[card.language]}</strong>
        {card.rarity && <> avec la rareté <strong>{card.rarity}</strong></>}.
      </p>
      <p className="mt-2 text-xs leading-relaxed text-stone-500">{price.message}</p>
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
      className="group flex flex-col gap-2 rounded-md border border-stone-300 bg-white p-3 text-left transition hover:border-[#8f2430] focus-visible:outline-2 focus-visible:outline-[#8f2430]"
    >
      {product.imageUrl
        ? <img src={product.imageUrl} alt={title(product)} loading="lazy" className="h-72 w-full rounded-sm bg-stone-50 object-contain p-1.5" />
        : <span className="flex h-72 items-center justify-center rounded-sm bg-stone-100 text-sm text-stone-500">Image indisponible</span>}
      <span className="text-base font-semibold text-stone-900">{title(product)}</span>
      <span className="text-sm text-stone-600">{product.name}</span>
      {product.expansion && <span className="text-xs text-stone-500">Série : {product.expansion}</span>}
      <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-xs text-stone-600">
        <span>{product.languageLabel ?? 'Langue inconnue'}</span><span aria-hidden="true">·</span>
        <span>{product.rarity ?? 'Rareté inconnue'}</span><span aria-hidden="true">·</span>
        <span>{product.variantLabel ?? 'Variante inconnue'}</span>
      </div>
      <span className="mt-auto pt-3 text-sm font-semibold text-[#8f2430]">Choisir cette variante →</span>
    </button>
  );
}
