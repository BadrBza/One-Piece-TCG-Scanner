import { useEffect, useId, useRef } from 'react';
import { LoaderCircle, Trash2, X } from 'lucide-react';

import type { PortfolioCard } from '../portfolio.api';

type Props = {
  card: PortfolioCard;
  removing: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
};

export function RemoveCardDialog({ card, removing, error, onCancel, onConfirm }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current!;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    cancelRef.current?.focus();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);

  return (
    <dialog ref={dialogRef} aria-labelledby={titleId} aria-describedby={descriptionId} aria-busy={removing}
      onCancel={event => { event.preventDefault(); if (!removing) onCancel(); }}
      className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-2xl border border-stone-200 bg-[#fffefa] p-0 text-stone-800 shadow-2xl backdrop:bg-stone-950/50 backdrop:backdrop-blur-sm">
      <div className="p-4 sm:p-7">
        <div className="flex items-center justify-between gap-3">
          <h2 id={titleId} className="text-lg font-semibold tracking-tight sm:text-xl">Retirer cette carte ?</h2>
          <button type="button" onClick={onCancel} disabled={removing} aria-label="Fermer"
            className="flex size-11 shrink-0 items-center justify-center rounded-full text-stone-500 hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8f2430] disabled:opacity-40">
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
        <p id={descriptionId} className="mt-2 text-sm leading-relaxed text-stone-500">
          {card.quantity > 1 ? `Les ${card.quantity} exemplaires de cette édition seront retirés` : 'Cet exemplaire sera retiré'} de ta collection.
        </p>
        <div className="mt-5 flex items-center gap-4 rounded-xl border border-stone-200 bg-stone-50 p-3">
          {card.imageUrl && <img src={card.imageUrl} alt="" className="h-20 w-14 shrink-0 rounded object-contain" />}
          <div className="min-w-0">
            <p className="text-xs font-medium text-stone-500">{card.cardNumber} · Quantité : {card.quantity}</p>
            <p className="mt-1 break-words font-semibold">{card.name}</p>
            {card.expansion && <p className="mt-1 text-xs text-stone-500">{card.expansion}</p>}
            {card.variant && <p className="mt-1 text-xs text-stone-500">{card.variant}</p>}
          </div>
        </div>
        {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row">
          <button ref={cancelRef} type="button" disabled={removing} onClick={onCancel}
            className="min-h-11 flex-1 rounded-lg border border-stone-300 px-4 text-sm font-semibold hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8f2430] disabled:opacity-50">Annuler</button>
          <button type="button" disabled={removing} onClick={onConfirm}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-[#8f2430] px-4 text-sm font-semibold text-white hover:bg-[#761d27] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8f2430] disabled:opacity-60">
            {removing ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Trash2 className="size-4" aria-hidden="true" />}
            <span role="status">{removing ? 'Suppression…' : 'Retirer la carte'}</span>
          </button>
        </div>
      </div>
    </dialog>
  );
}
