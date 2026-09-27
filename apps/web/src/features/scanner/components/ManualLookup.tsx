import { Search, Loader2 } from 'lucide-react';
import type { CardGame, PokemonLanguage, PokemonSearch } from '../scanner.api';

type Props = {
  cardNumber: string;
  disabled: boolean;
  isLoading: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
  game: CardGame;
  pokemon: PokemonSearch;
  onPokemonChange: (valeur: PokemonSearch) => void;
};

export function ManualLookup({ cardNumber, disabled, isLoading, onChange, onSubmit, game, pokemon, onPokemonChange }: Props) {
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
        <p id="card-number-help" className="mt-1 text-sm leading-relaxed text-stone-500">{game === 'pokemon'
          ? 'Saisis la référence complète, par exemple 199/165. Le nom ou l’extension permet de préciser la recherche.'
          : 'Saisis la référence imprimée en bas de la carte, par exemple OP01-001 et puis choisis la carte.'}</p>
      </div>
      {game === 'pokemon' && <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium text-stone-700">Langue
          <select value={pokemon.language} disabled={disabled} onChange={event => onPokemonChange({ ...pokemon, language: event.target.value as PokemonLanguage })}
            className="mt-1 min-h-12 w-full rounded-xl border border-stone-300 bg-white px-3 text-base focus:outline-[#8f2430]">
            <option value="FR">Français</option><option value="EN">Anglais</option><option value="JP">Japonais</option>
          </select>
        </label>
        <label className="text-sm font-medium text-stone-700">Nom (facultatif)
          <input value={pokemon.name} maxLength={200} disabled={disabled} onChange={event => onPokemonChange({ ...pokemon, name: event.target.value })}
            placeholder="Dracaufeu-ex" className="mt-1 min-h-12 w-full rounded-xl border border-stone-300 bg-white px-3 text-base focus:outline-[#8f2430]" />
        </label>
        <label className="text-sm font-medium text-stone-700 sm:col-span-2">Extension ou code (facultatif)
          <input value={pokemon.set} maxLength={100} disabled={disabled} onChange={event => onPokemonChange({ ...pokemon, set: event.target.value })}
            placeholder="151, MEW, SV2a…" className="mt-1 min-h-12 w-full rounded-xl border border-stone-300 bg-white px-3 text-base focus:outline-[#8f2430]" />
        </label>
      </div>}
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="card-number"
          aria-describedby="card-number-help"
          autoCapitalize="characters"
          spellCheck={false}
          value={cardNumber}
          onChange={event => onChange(event.target.value)}
          placeholder={game === 'pokemon' ? '199/165' : 'OP01-001'}
          maxLength={game === 'pokemon' ? 40 : 12}
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
