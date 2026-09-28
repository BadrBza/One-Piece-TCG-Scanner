import { createHash } from 'node:crypto';
import { cleNom, type PokemonCandidate, type PokemonCard, type PokemonFinish, type PokemonLanguage, type TcgCard, type TcgSet } from './pokemon.schema.js';

function referencePokemon(numero: string, serie: TcgSet) {
  const prefixe = /^(TG|GG|SV)\d+$/i.exec(numero)?.[1];
  if (prefixe) {
    const total = serie.cards.filter(carte => carte.localId.toUpperCase().startsWith(prefixe.toUpperCase())).length;
    if (total) return `${numero}/${prefixe.toUpperCase()}${total}`;
  }
  return /^\d+$/.test(numero) && serie.cardCount.official ? `${numero}/${serie.cardCount.official}` : numero;
}

const libelles: Record<string, string> = {
  normal: 'Normale', holo: 'Holographique', reverse: 'Reverse', pokeball: 'Poké Ball', masterball: 'Master Ball',
  unlimited: 'Édition illimitée', shadowless: 'Sans ombre', '1st-edition': 'Première édition',
};

export function construireCarte(carte: TcgCard, language: PokemonLanguage, serie: TcgSet): PokemonCard {
  return {
    ...construireCandidate(carte, language, serie), expansion: carte.set.name,
    rarity: carte.rarity, finishes: finitionsDisponibles(carte),
  };
}

export function construireCandidate(carte: TcgSet['cards'][number], language: PokemonLanguage, serie: TcgSet): PokemonCandidate {
  return {
    catalogId: carte.id, cardNumber: referencePokemon(carte.localId, serie), name: carte.name,
    language, expansion: serie.name, imageUrl: carte.image && `${carte.image}/high.webp`,
  };
}

function finitionsDisponibles(carte: TcgCard): PokemonFinish[] {
  const finitions = (carte.variants_detailed ?? []).map(construireFinition);
  if (!finitions.length) return finitionsSansDetail(carte.variants);
  return finitions.map(({ clePrix, ...finition }) => {
    // Un prix partagé entre deux éditions ne permet pas de coter leur finition exacte.
    const ambigu = clePrix && finitions.filter(autre => autre.clePrix === clePrix).length > 1;
    return ambigu ? { ...finition, trendPrice: undefined, priceUpdatedAt: undefined } : finition;
  });
}

function construireFinition(finition: NonNullable<TcgCard['variants_detailed']>[number]) {
  const type = finition.type.toLowerCase();
  const format = finition.size && cleNom(finition.size) !== 'STANDARD' ? finition.size : undefined;
  const attributs = [type, finition.foil, finition.subtype, format, ...(finition.stamp ?? [])].filter((texte): texte is string => !!texte);
  const id = finition.variantId ?? `details:${createHash('sha256').update(JSON.stringify(attributs)).digest('hex').slice(0, 24)}`;
  const prix = finition.pricing?.cardmarket;
  const produitId = finition.thirdParty?.cardmarket ?? prix?.idProduct;
  // Cardmarket cote les reverse dans la colonne foil, les normales/holo dans trend.
  const colonne = type === 'reverse' ? 'trend-holo' : ['normal', 'holo'].includes(type) ? 'trend' : undefined;
  const compatible = produitId && prix?.idProduct === produitId && prix.unit === 'EUR' && colonne;
  return {
    id, label: attributs.map(attribut => libelles[attribut.toLowerCase()] ?? attribut).join(' · '),
    cardmarketProductId: produitId,
    trendPrice: compatible ? prix[colonne] ?? undefined : undefined,
    priceUpdatedAt: compatible ? prix.updated : undefined,
    clePrix: produitId && colonne ? `${produitId}:${colonne}` : undefined,
  };
}

function finitionsSansDetail(variantes: TcgCard['variants']): PokemonFinish[] {
  const finitions = (['normal', 'holo', 'reverse'] as const)
    .filter(type => variantes[type]).map(type => ({ id: `legacy:${type}`, label: libelles[type] }));
  if (variantes.firstEdition) finitions.push({ id: 'legacy:firstEdition', label: 'Première édition (finition à confirmer)' });
  return finitions.length ? finitions : [{ id: 'unknown', label: 'Finition non renseignée' }];
}
