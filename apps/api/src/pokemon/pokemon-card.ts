import { createHash } from 'node:crypto';
import { cleNom, type PokemonCard, type PokemonFinish, type PokemonLanguage, type TcgCard, type TcgSet } from './pokemon.schema.js';

export function referencePokemon(numero: string, serie: TcgSet) {
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
  const details = carte.variants_detailed ?? [];
  const finitions = details.map(finition => {
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
  });
  const finishes: PokemonFinish[] = finitions.map(({ clePrix, ...finition }) => {
    // Un prix partagé entre deux éditions ne permet pas de coter leur finition exacte.
    const ambigu = clePrix && finitions.filter(autre => autre.clePrix === clePrix).length > 1;
    return ambigu ? { ...finition, trendPrice: undefined, priceUpdatedAt: undefined } : finition;
  });
  if (!finishes.length) {
    for (const type of ['normal', 'holo', 'reverse'] as const) {
      if (carte.variants[type]) finishes.push({ id: `legacy:${type}`, label: libelles[type] });
    }
    if (carte.variants.firstEdition) finishes.push({ id: 'legacy:firstEdition', label: 'Première édition (finition à confirmer)' });
    if (!finishes.length) finishes.push({ id: 'unknown', label: 'Finition non renseignée' });
  }
  return {
    catalogId: carte.id, cardNumber: referencePokemon(carte.localId, serie), name: carte.name,
    language, expansion: carte.set.name, imageUrl: carte.image && `${carte.image}/high.webp`,
    rarity: carte.rarity, finishes,
  };
}
