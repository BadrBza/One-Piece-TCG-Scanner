import { Hash, Search } from 'lucide-react';

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
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700"><Hash className="size-5" aria-hidden="true" /></span>
        <div>
          <label htmlFor="card-number" className="block text-xl font-semibold">Recherche par numéro</label>
          <p className="mt-1 text-sm leading-relaxed text-slate-500">Saisis la référence imprimée en bas de la carte. Cette méthode affiche les variantes disponibles.</p>
        </div>
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
          className="min-h-11 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-base font-semibold uppercase tracking-wide text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-3 focus:ring-blue-500/10"
        />
        <button type="submit" disabled={!cardNumber.trim() || disabled} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
          <Search className="size-4" aria-hidden="true" />
          {isLoading ? 'Recherche…' : 'Voir les prix'}
        </button>
      </div>
    </form>
  );
}
