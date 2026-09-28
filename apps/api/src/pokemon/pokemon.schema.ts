import { z } from 'zod';

export const PokemonLanguageSchema = z.enum(['FR', 'EN', 'JP']);
export type PokemonLanguage = z.infer<typeof PokemonLanguageSchema>;
export const languesPokemon = { FR: 'fr', EN: 'en', JP: 'ja' } as const;

function normaliserNumero(numero: string) {
  return numero.normalize('NFKC').trim().toUpperCase().replace(/\s/g, '').replace(/[–—]/g, '-');
}

export const PokemonNumberSchema = z.string().max(40).transform(normaliserNumero)
  .refine(numero => /^[A-Z0-9][A-Z0-9.-]*(?:\/[A-Z0-9][A-Z0-9.-]*)?$/.test(numero) && /\d/.test(numero.split('/')[0]));

export function cleNumero(numero: string) {
  return normaliserNumero(numero).replace(/\d+/g, chiffres => String(Number(chiffres)));
}

export function cleNom(nom: string) {
  return nom.normalize('NFKC').normalize('NFD').replace(/[\u0300-\u036f]/g, '').normalize('NFC')
    .toUpperCase().replace(/[^\p{L}\p{N}♀♂]/gu, '');
}

export const PokemonLookupSchema = z.object({
  number: PokemonNumberSchema,
  language: PokemonLanguageSchema.default('FR'),
  name: z.string().trim().max(200).default(''),
  set: z.string().trim().max(100).default(''),
});
export type PokemonLookup = z.infer<typeof PokemonLookupSchema>;
export const PokemonResolveSchema = z.object({
  game: z.literal('pokemon'),
  catalogId: z.string().regex(/^[a-zA-Z0-9.-]+$/).max(100),
  language: PokemonLanguageSchema,
});

export const PokemonReadingSchema = z.object({
  number: z.string().nullable(),
  total: z.string().nullable(),
  name: z.string().nullable(),
  language: z.enum(['FR', 'EN', 'JP', 'UNKNOWN']),
  set: z.string().nullable(),
});

const identifiant = z.string().min(1).max(100);
const image = z.string().url().regex(/^https:\/\/assets\.tcgdex\.net\//).optional();
export const TcgCardBriefSchema = z.object({ id: identifiant, localId: z.string(), name: z.string(), image });
export const TcgSetBriefSchema = z.object({
  id: identifiant, name: z.string(), cardCount: z.object({ official: z.number().int().nonnegative() }),
});
export const TcgSetSchema = TcgSetBriefSchema.extend({
  serie: z.object({ id: z.string() }),
  abbreviation: z.object({ official: z.string().optional(), localized: z.string().optional() }).nullish(),
  cards: z.array(TcgCardBriefSchema),
});
const prix = z.number().nonnegative().nullish();
const TcgPriceSchema = z.object({
  idProduct: z.number().int().positive().optional(), unit: z.string().optional(),
  updated: z.string().datetime({ offset: true }).optional(), trend: prix, 'trend-holo': prix,
});
const TcgFinishSchema = z.object({
  variantId: identifiant.optional(), type: z.string(), size: z.string().optional(),
  subtype: z.string().optional(), foil: z.string().optional(), stamp: z.array(z.string()).optional(),
  thirdParty: z.object({ cardmarket: z.number().int().positive().optional() }).nullish(),
  pricing: z.object({ cardmarket: TcgPriceSchema.nullish() }).nullish(),
});
export const TcgCardSchema = TcgCardBriefSchema.extend({
  rarity: z.string().optional(), set: TcgSetBriefSchema,
  variants: z.object({ normal: z.boolean(), holo: z.boolean(), reverse: z.boolean(), firstEdition: z.boolean().optional() }),
  variants_detailed: z.array(TcgFinishSchema).nullish(),
});
export type TcgCard = z.infer<typeof TcgCardSchema>;
export type TcgSet = z.infer<typeof TcgSetSchema>;

export type PokemonCandidate = {
  catalogId: string; cardNumber: string; name: string; language: PokemonLanguage;
  expansion: string; imageUrl?: string;
};
export type PokemonFinish = {
  id: string; label: string; cardmarketProductId?: number; trendPrice?: number; priceUpdatedAt?: string;
};
export type PokemonCard = PokemonCandidate & { rarity?: string; finishes: PokemonFinish[] };
export type PokemonResult = { game: 'pokemon'; card: PokemonCard };
export type PokemonConfirmation = {
  game: 'pokemon'; status: 'card_confirmation_required'; candidates: PokemonCandidate[];
};
