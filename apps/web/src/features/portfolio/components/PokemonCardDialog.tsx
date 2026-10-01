import { Component, lazy, Suspense, useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { ImageOff, LoaderCircle, X } from 'lucide-react';
import dosCarte from '../../../assets/pokemon-card-back.png';
import type { PortfolioCard } from '../portfolio.api';
import { languageLabels } from '../../scanner/labels';
import type { CommandesCarte } from './PokemonCardScene';

const PokemonCardScene = lazy(() => import('./PokemonCardScene'));

export function PokemonCardDialog({ card, imageUrl, onClose }: {
  card: PortfolioCard;
  imageUrl: string;
  onClose: () => void;
}) {
  const dialogue = useRef<HTMLDialogElement>(null);
  const fermeture = useRef<HTMLButtonElement>(null);
  const commandes = useRef<CommandesCarte>(null);
  const titreId = useId();
  const aideId = useId();
  const [pret, setPret] = useState(false);
  const [mode2d, setMode2d] = useState(false);
  const [verso, setVerso] = useState(false);
  const [imageAbsente, setImageAbsente] = useState<string | null>(null);
  const [mouvementReduit, setMouvementReduit] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const afficher2d = useCallback(() => setMode2d(true), []);
  const image2d = verso ? dosCarte : imageUrl;

  useEffect(() => {
    const element = dialogue.current!;
    const focusPrecedent = document.activeElement;
    const defilementPrecedent = document.body.style.overflow;
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const actualiserMouvement = () => setMouvementReduit(preference.matches);
    preference.addEventListener('change', actualiserMouvement);
    element.showModal();
    fermeture.current?.focus();
    document.body.style.overflow = 'hidden';
    return () => {
      preference.removeEventListener('change', actualiserMouvement);
      element.close();
      document.body.style.overflow = defilementPrecedent;
      if (focusPrecedent instanceof HTMLElement && focusPrecedent.isConnected) focusPrecedent.focus();
    };
  }, []);

  function afficherFace(dos: boolean) {
    setVerso(dos);
    commandes.current?.afficherFace(dos);
  }

  function reinitialiser() {
    setVerso(false);
    commandes.current?.reinitialiser();
  }

  function piloterAuClavier(event: KeyboardEvent<HTMLDivElement>) {
    if (mode2d || !pret || event.target !== event.currentTarget) return;
    const action = {
      ArrowLeft: () => commandes.current?.tourner(-0.2, 0),
      ArrowRight: () => commandes.current?.tourner(0.2, 0),
      ArrowUp: () => commandes.current?.tourner(0, -0.15),
      ArrowDown: () => commandes.current?.tourner(0, 0.15),
      '+': () => commandes.current?.zoomer(1),
      '-': () => commandes.current?.zoomer(-1),
      f: () => afficherFace(false),
      v: () => afficherFace(true),
      Home: reinitialiser,
    }[event.key];
    if (action) { event.preventDefault(); action(); }
  }

  return (
    <dialog ref={dialogue} aria-labelledby={titreId} aria-describedby={aideId}
      onCancel={event => { event.preventDefault(); onClose(); }}
      className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none overflow-hidden border-0 bg-transparent p-0 text-stone-800 outline-none backdrop:bg-black/20">
      <h2 id={titreId} className="sr-only">{card.name}</h2>
      <p className="sr-only">
        {[card.cardNumber, card.expansion, card.game === 'pokemon' ? languageLabels[card.language] : card.language].filter(Boolean).join(' · ')}. Dos générique Pokémon, illustration de présentation.
      </p>
      <p id={aideId} role="status" className="sr-only">
        {mode2d ? 'Vue 2D. Active la carte pour la retourner.' : 'Fais glisser pour tourner. Pince ou utilise la molette pour zoomer. Au clavier, utilise les flèches pour tourner, plus et moins pour zoomer, F pour le recto, V pour le verso et Début pour réinitialiser.'}
      </p>
      <button ref={fermeture} type="button" aria-label="Fermer l’inspection" onClick={onClose}
        className="absolute right-[max(1rem,env(safe-area-inset-right))] top-[max(1rem,env(safe-area-inset-top))] z-10 flex size-11 items-center justify-center rounded-full bg-white/60 text-stone-700 hover:bg-white/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8f2430]">
        <X className="size-5" aria-hidden="true" />
      </button>
      <div tabIndex={mode2d ? undefined : 0} role="group" aria-label={`Vue ${mode2d ? '2D' : '3D'} de ${card.name}`} aria-describedby={aideId}
        onKeyDown={piloterAuClavier}
        className="absolute inset-0 overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#8f2430]/50">
        {mode2d ? (
          <div className="absolute inset-x-6 inset-y-16 flex items-center justify-center [container-type:size]">
            {imageAbsente === image2d ? (
              <p role="status" className="flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-sm"><ImageOff className="size-5" aria-hidden="true" /> Image indisponible</p>
            ) : (
              <button type="button" onClick={() => afficherFace(!verso)} aria-label={`Retourner ${card.name} : afficher le ${verso ? 'recto' : 'verso'}`}
                className="relative aspect-[63/88] h-[min(100cqh,calc(100cqw*88/63))] overflow-hidden rounded-[4%] shadow-2xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#8f2430]">
                <img key={image2d} src={image2d} alt={`${verso ? 'Dos générique' : 'Recto'} — ${card.name}`}
                  onError={() => setImageAbsente(image2d)} draggable={false}
                  className={verso ? 'absolute left-1/2 h-full w-[140.94%] max-w-none -translate-x-1/2' : 'h-full w-full object-contain'} />
              </button>
            )}
          </div>
        ) : (
          <SceneBoundary onError={afficher2d}>
            <Suspense fallback={null}>
              <PokemonCardScene ref={commandes} imageUrl={imageUrl} mouvementReduit={mouvementReduit} onReady={setPret} onError={afficher2d} />
            </Suspense>
          </SceneBoundary>
        )}
        {!pret && !mode2d && (
          <div role="status" className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="flex items-center gap-3 rounded-full bg-white/80 px-4 py-2 text-sm"><LoaderCircle className="size-5 loading-indicator" aria-hidden="true" /> Préparation de la carte…</span>
          </div>
        )}
      </div>
    </dialog>
  );
}

// Une erreur de chargement du module ou du canvas garde la fenêtre utilisable.
class SceneBoundary extends Component<{ children: ReactNode; onError: () => void }, { erreur: boolean }> {
  state = { erreur: false };
  static getDerivedStateFromError() { return { erreur: true }; }
  componentDidCatch() { this.props.onError(); }
  render() { return this.state.erreur ? null : this.props.children; }
}
