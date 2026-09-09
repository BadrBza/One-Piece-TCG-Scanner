import { Search } from 'lucide-react';

type Props = {
  cardNumber: string;
  disabled: boolean;
  isLoading: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
};

export function ManualLookup({ cardNumber, disabled, isLoading, onChange, onSubmit }: Props) {
  return (
    <form
      id="manual-search"
      className="space-y-5"
      onSubmit={event => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div>
        <label htmlFor="card-number" className="block text-xl font-semibold">Recherche par numéro</label>
        <p className="mt-1 text-sm leading-relaxed text-stone-500">Saisis la référence imprimée en bas de la carte. Cette méthode affiche les variantes disponibles.</p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="card-number"
          value={cardNumber}
          onChange={event => onChange(event.target.value)}
          placeholder="OP01-001"
          maxLength={12}
          required
          disabled={disabled}
          className="min-h-11 min-w-0 flex-1 rounded-md border border-stone-300 bg-white px-3 text-base font-semibold uppercase tracking-wide text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-[#8f2430] focus:ring-3 focus:ring-[#8f2430]/10"
        />
        <button type="submit" disabled={!cardNumber.trim() || disabled} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[#8f2430] px-5 text-sm font-semibold text-white transition hover:bg-[#761d27] disabled:cursor-not-allowed disabled:opacity-50">
          <Search className="size-4" aria-hidden="true" />
          {isLoading ? 'Recherche…' : 'Voir les prix'}
        </button>
      </div>
    </form>
  );
}
