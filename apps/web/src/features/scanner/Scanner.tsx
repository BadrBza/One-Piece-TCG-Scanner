import { ArrowDown, Camera, Keyboard, Loader2, ScanLine } from 'lucide-react';
import { type ReactNode } from 'react';

import { useScanner } from './useScanner';
import { ManualLookup } from './components/ManualLookup';
import { PhotoPicker } from './components/PhotoPicker';
import { ScanResult } from './components/ScanResult';
import { PokemonCandidates } from './components/PokemonResult';

export function Scanner() {
  const {
    game, choisirJeu, pokemon, setPokemon, confirmerPokemon,
    mode, cardNumber, setCardNumber, preview, result, confirmation, resultSource,
    error, isImporting, isScanning, isLookingUp, busy, choisirMode, importerPhoto,
    scannerCarte, confirmerNumero, chercherCarte,
  } = useScanner();

  return (
    <section className="mx-auto w-full min-w-0 max-w-4xl space-y-6 pb-4 sm:space-y-10">
      <header className="mx-auto max-w-xl text-center">
        <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#8f2430]/15 bg-[#8f2430]/5 px-3 py-1 text-xs font-semibold text-[#8f2430]">
          <ScanLine className="size-3.5" aria-hidden="true" /> HAKISCAN · {game === 'pokemon' ? 'POKÉMON' : 'ONE PIECE'}
        </span>
        <h1 className="text-2xl font-semibold tracking-tight text-stone-950 sm:text-4xl">Une carte. Toutes ses possibilités.</h1>
        <div className="mx-auto mt-5 grid max-w-sm grid-cols-2 gap-1 rounded-xl bg-stone-200/60 p-1" role="group" aria-label="Jeu de cartes">
          {(['one-piece', 'pokemon'] as const).map(jeu => <button key={jeu} type="button" aria-pressed={game === jeu} disabled={busy} onClick={() => choisirJeu(jeu)}
            className={`min-h-11 rounded-lg px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-[#8f2430] disabled:opacity-50 ${game === jeu ? 'bg-white text-[#8f2430] shadow-sm' : 'text-stone-600 hover:text-stone-900'}`}>
            {jeu === 'pokemon' ? 'Pokémon' : 'One Piece'}
          </button>)}
        </div>
      </header>

      <div className="overflow-hidden rounded-2xl border border-stone-200 bg-[#fffefa] shadow-sm">
        <div className="flex flex-col gap-4 border-b border-stone-200/80 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div>
            <h2 className="font-semibold text-stone-900">Trouver ma carte</h2>
          </div>
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-stone-100 p-1" role="group" aria-label="Méthode de recherche">
            <ModeButton active={mode === 'photo'} disabled={busy} icon={<Camera className="size-4" aria-hidden="true" />} onClick={() => choisirMode('photo')}>Photo</ModeButton>
            <ModeButton active={mode === 'manual'} disabled={busy} icon={<Keyboard className="size-4" aria-hidden="true" />} onClick={() => choisirMode('manual')}>Référence</ModeButton>
          </div>
        </div>
        <div aria-busy={busy} className="p-4 sm:p-8">
          {mode === 'photo' ? (
            <PhotoPicker busy={busy} isImporting={isImporting} isScanning={isScanning}
              onChange={importerPhoto} onScan={() => void scannerCarte()} preview={preview} />
          ) : (
            <div className="mx-auto max-w-xl py-4 sm:py-8">
              <ManualLookup cardNumber={cardNumber} disabled={busy} isLoading={isLookingUp}
                game={game} pokemon={pokemon} onPokemonChange={setPokemon}
                onChange={setCardNumber} onSubmit={() => void chercherCarte()} />
            </div>
          )}
          {error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
          {confirmation?.status === 'card_confirmation_required' && <PokemonCandidates candidates={confirmation.candidates} busy={busy} onSelect={carte => void confirmerPokemon(carte)} />}
          {confirmation?.status === 'number_confirmation_required' && <div role="status" className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-5">
            <h3 className="font-semibold text-amber-950">Confirme le numéro de ta carte</h3>
            <p className="mt-1 text-sm text-amber-800">Choisis la référence visible sur ta photo pour continuer.</p>
            <div className="mt-4 flex flex-wrap gap-3">
              {confirmation.numberCandidates.map(number => <button key={number} type="button" disabled={busy}
                onClick={() => void confirmerNumero(number)}
                className="min-h-11 rounded-lg border border-amber-300 bg-white px-4 text-sm font-semibold text-amber-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-800 disabled:opacity-50">{number}</button>)}
            </div>
            {isLookingUp && <p className="mt-3 flex items-center gap-2 text-sm text-amber-900"><Loader2 className="size-4 loading-indicator" aria-hidden="true" /> Recherche en cours…</p>}
          </div>}
        </div>
      </div>

      {result && <section aria-labelledby="scan-result-title">
        <div className="mb-5 flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-full bg-[#8f2430]/10 text-[#8f2430]"><ArrowDown className="size-4" aria-hidden="true" /></span>
          <div>
            <h2 id="scan-result-title" className="text-xl font-semibold tracking-tight text-stone-950">Résultat de la recherche</h2>
            <p className="mt-0.5 text-xs text-stone-500">{game === 'pokemon' ? 'La fiche Pokémon et ses finitions disponibles.' : resultSource === 'photo' ? 'Les correspondances avec ta photo.' : 'Les fiches Cardmarket pour ta référence.'}</p>
          </div>
        </div>
        <ScanResult result={result} source={resultSource} />
      </section>}
      <p aria-live="polite" className="sr-only">{result ? 'Résultat de la recherche disponible.' : busy ? 'Recherche en cours.' : ''}</p>
    </section>
  );
}

function ModeButton({ active, children, disabled, icon, onClick }: { active: boolean; children: string; disabled: boolean; icon: ReactNode; onClick: () => void }) {
  return <button type="button" aria-pressed={active} disabled={disabled} onClick={onClick}
    className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm sm:px-5 font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8f2430] disabled:opacity-50 ${active ? 'bg-white text-[#8f2430] shadow-sm' : 'text-stone-500 hover:text-stone-900'}`}>
    {icon}{children}
  </button>;
}
