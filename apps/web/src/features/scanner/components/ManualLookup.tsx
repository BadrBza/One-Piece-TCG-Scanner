import { Search, Loader2 } from 'lucide-react';

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
        <label htmlFor="card-number" className="block text-lg font-semibold">Tu connais sa référence ?</label>
        <p id="card-number-help" className="mt-1 text-sm leading-relaxed text-stone-500">Saisis la référence imprimée en bas de la carte, par exemple OP01-001 et puis choisis la carte.</p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="card-number"
          aria-describedby="card-number-help"
          autoCapitalize="characters"
          spellCheck={false}
          value={cardNumber}
          onChange={event => onChange(event.target.value)}
          placeholder="OP01-001"
          maxLength={12}
          required
          disabled={disabled}
          className="min-h-12 min-w-0 flex-1 rounded-xl border border-stone-300 bg-white px-3 text-base font-semibold uppercase tracking-wide text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-[#8f2430] focus:ring-3 focus:ring-[#8f2430]/10"
        />
        <button type="submit" disabled={!cardNumber.trim() || disabled} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#8f2430] px-5 text-sm font-semibold text-white transition hover:bg-[#761d27] disabled:cursor-not-allowed disabled:opacity-50">
          {isLoading ? <Loader2 className="size-4 loading-indicator" aria-hidden="true" /> : <Search className="size-4" aria-hidden="true" />}
          {isLoading ? 'Recherche…' : 'Voir les prix'}
        </button>
      </div>
    </form>
  );
}
