import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import type { CarteCollection, Prisma } from '../generated/prisma/client.js';
import type { AddPortfolioCard, PortfolioCard } from './portfolio.schema.js';
import type { PokemonLanguage } from '../pokemon/pokemon.schema.js';

@Injectable()
export class PortfolioRepository {
  constructor(private readonly database: DatabaseService) {}

  async list(utilisateurId: number): Promise<PortfolioCard[]> {
    const cartes = await this.database.client.$transaction(transaction => transaction.carteCollection.findMany({
      where: { utilisateurId }, orderBy: [{ ajout: 'desc' }, { id: 'desc' }],
    }));
    return cartes.map(toPortfolioCard);
  }

  async add(utilisateurId: number, carte: AddPortfolioCard): Promise<PortfolioCard> {
    const identite = identiteCollection(carte);
    const cle = { utilisateurId, jeu: carte.game, identite: identite.cle };
    const prix = carte.trendPrice == null ? {} : {
      cote: carte.trendPrice, coteActualiseeLe: identite.datePrix ?? new Date().toISOString(),
    };
    const resultat = await this.database.client.$transaction(transaction => transaction.carteCollection.upsert({
      where: { utilisateurId_jeu_identite: cle },
      create: {
        ...cle, ...prix, catalogueId: identite.catalogue, finitionId: identite.finition,
        numero: carte.cardNumber, nom: carte.name, produitCardmarketId: carte.cardmarketProductId,
        imageUrl: carte.imageUrl, langue: carte.language, rarete: carte.rarity,
        variante: carte.variant, extension: carte.expansion,
      },
      update: { quantite: { increment: 1 }, ...prix },
    }));
    return toPortfolioCard(resultat);
  }

  async remove(utilisateurId: number, id: number) {
    const { count } = await this.database.client.$transaction(transaction => transaction.carteCollection.deleteMany({ where: { id, utilisateurId } }));
    return count > 0;
  }

  async productIds(avant?: string) {
    const cartes = await this.database.client.$transaction(transaction => transaction.carteCollection.findMany({
      where: { jeu: 'one-piece', ...prixAnterieur(avant) },
      distinct: ['produitCardmarketId'], select: { produitCardmarketId: true },
    }));
    return cartes.map(carte => carte.produitCardmarketId!);
  }

  updatePrice(produitCardmarketId: number, cote: number, coteActualiseeLe: string) {
    return this.database.client.$transaction(transaction => transaction.carteCollection.updateMany({
      where: { jeu: 'one-piece', produitCardmarketId }, data: { cote, coteActualiseeLe },
    }));
  }

  async cartesPokemon(avant?: string) {
    const cartes = await this.database.client.$transaction(transaction => transaction.carteCollection.findMany({
      where: { jeu: 'pokemon', ...prixAnterieur(avant) },
      distinct: ['catalogueId', 'langue'], select: { catalogueId: true, langue: true },
    }));
    return cartes.map(carte => ({ catalogId: carte.catalogueId!, language: carte.langue as PokemonLanguage }));
  }

  actualiserPokemon(catalogueId: string, langue: PokemonLanguage, finitionId: string, cote: number, coteActualiseeLe: string) {
    return this.database.client.$transaction(transaction => transaction.carteCollection.updateMany({
      where: { jeu: 'pokemon', catalogueId, langue, finitionId }, data: { cote, coteActualiseeLe },
    }));
  }
}

function prixAnterieur(avant?: string): Prisma.CarteCollectionWhereInput {
  return avant ? { OR: [{ coteActualiseeLe: null }, { coteActualiseeLe: { lt: avant } }] } : {};
}

function identiteCollection(carte: AddPortfolioCard) {
  if (carte.game === 'pokemon') {
    return {
      cle: JSON.stringify([carte.catalogId, carte.language, carte.finishId]),
      catalogue: carte.catalogId, finition: carte.finishId, datePrix: carte.priceUpdatedAt,
    };
  }
  return { cle: String(carte.cardmarketProductId), catalogue: null, finition: null, datePrix: undefined };
}

function toPortfolioCard(ligne: CarteCollection): PortfolioCard {
  const carte = {
    id: ligne.id,
    cardNumber: ligne.numero,
    name: ligne.nom,
    cardmarketProductId: ligne.produitCardmarketId ?? undefined,
    imageUrl: ligne.imageUrl ?? undefined,
    language: ligne.langue ?? undefined,
    rarity: ligne.rarete ?? undefined,
    variant: ligne.variante ?? undefined,
    expansion: ligne.extension ?? undefined,
    trendPrice: ligne.cote ?? undefined,
    quantity: ligne.quantite,
    addedAt: ligne.ajout,
    priceUpdatedAt: ligne.coteActualiseeLe ?? undefined,
  };
  return ligne.jeu === 'pokemon'
    ? { ...carte, game: 'pokemon', catalogId: ligne.catalogueId!, finishId: ligne.finitionId!, language: ligne.langue as PokemonLanguage }
    : { ...carte, game: 'one-piece', cardmarketProductId: ligne.produitCardmarketId! };
}
