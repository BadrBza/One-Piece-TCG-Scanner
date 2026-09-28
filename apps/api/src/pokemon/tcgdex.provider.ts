import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import ky, { HTTPError } from 'ky';
import { LRUCache } from 'lru-cache';
import { z } from 'zod';
import { construireCandidate, construireCarte } from './pokemon-card.js';
import {
  cleNom, cleNumero, languesPokemon, TcgCardBriefSchema, TcgCardSchema, TcgSetBriefSchema, TcgSetSchema,
  type PokemonCandidate, type PokemonLanguage, type PokemonLookup, type TcgSet,
} from './pokemon.schema.js';

@Injectable()
export class TcgdexProvider {
  private readonly http = ky.create({ prefix: 'https://api.tcgdex.net/v2', timeout: 15_000, retry: 0 });
  private readonly cache = new LRUCache<string, object, z.ZodType<object>>({
    max: 500, ttl: 60 * 60_000,
    fetchMethod: async (chemin, _precedent, { context: schema }) => schema.parse(await this.http.get(chemin).json()),
  });

  async rechercher(recherche: PokemonLookup): Promise<PokemonCandidate[]> {
    const langue = languesPokemon[recherche.language];
    const [numero, total] = recherche.number.split('/');
    if (!recherche.set && !total && !recherche.name) {
      throw new BadRequestException('Ajoute le total imprimé (ex. 199/165), le nom ou l’extension de la carte Pokémon.');
    }
    const series = await this.seriesCandidates(recherche, numero, total);
    const candidates = series.flatMap(serie => {
      if (!this.serieCompatible(serie, recherche.set, total)) return [];
      return serie.cards.filter(carte => cleNumero(carte.localId) === cleNumero(numero)
        && (!recherche.name || cleNom(carte.name) === cleNom(recherche.name)))
        .map(carte => construireCandidate(carte, recherche.language, serie));
    });
    return [...new Map(candidates.map(carte => [`${langue}:${carte.catalogId}`, carte])).values()];
  }

  async carte(catalogId: string, language: PokemonLanguage, actualiser = false) {
    const langue = languesPokemon[language];
    const carte = await this.charger(`${langue}/cards/${encodeURIComponent(catalogId)}`, TcgCardSchema, actualiser);
    const serie = await this.charger(`${langue}/sets/${encodeURIComponent(carte.set.id)}`, TcgSetSchema);
    if (serie.serie.id.toLowerCase() === 'tcgp') throw new BadRequestException('Les cartes numériques Pokémon Pocket ne sont pas prises en charge.');
    return construireCarte(carte, language, serie);
  }

  private async seriesCandidates(recherche: PokemonLookup, numero: string, total?: string) {
    const langue = languesPokemon[recherche.language];
    const identifiants = await this.identifiantsSeries(recherche, numero, total);
    const uniques = [...new Set(identifiants)];
    if (uniques.length > 20) throw new BadRequestException('Précise l’extension ou le nom pour limiter les résultats Pokémon.');
    return Promise.all(uniques.map(id => this.charger(`${langue}/sets/${encodeURIComponent(id)}`, TcgSetSchema)));
  }

  private async identifiantsSeries(recherche: PokemonLookup, numero: string, total?: string) {
    const langue = languesPokemon[recherche.language];
    const sets = (parametres: Record<string, string>) => this.charger(`${langue}/sets?${new URLSearchParams(parametres)}`, z.array(TcgSetBriefSchema));
    if (recherche.set) {
      const champs = ['id', 'name', 'abbreviation.official', 'abbreviation.localized'];
      const series = await Promise.all(champs.map(champ => sets({ [champ]: recherche.set })));
      return series.flatMap(resultat => resultat.map(serie => serie.id));
    }
    if (total && /^\d+$/.test(total)) {
      const series = await sets({ 'cardCount.official': `eq:${Number(total)}` });
      return series.map(serie => serie.id);
    }
    return this.seriesParNom(recherche, numero);
  }

  private async seriesParNom(recherche: PokemonLookup, numero: string) {
    if (!recherche.name) throw new BadRequestException('Ajoute le nom ou l’extension pour retrouver cette référence Pokémon.');
    const nom = recherche.name.replace(/(?:[\s-]+)?(?:ex|gx|vmax|vstar|v)$/i, '').trim() || recherche.name;
    const parametres = new URLSearchParams({ name: nom });
    const cartes = await this.charger(`${languesPokemon[recherche.language]}/cards?${parametres}`, z.array(TcgCardBriefSchema));
    return cartes.filter(carte => cleNumero(carte.localId) === cleNumero(numero) && cleNom(carte.name) === cleNom(recherche.name))
      .map(carte => carte.id.slice(0, -(carte.localId.length + 1)));
  }

  private serieCompatible(serie: TcgSet, extension: string, total?: string) {
    if (serie.serie.id.toLowerCase() === 'tcgp') return false;
    if (extension && ![serie.id, serie.name, serie.abbreviation?.official, serie.abbreviation?.localized]
      .some(nom => nom && cleNom(nom) === cleNom(extension))) return false;
    if (!total) return true;
    if (/^\d+$/.test(total)) return serie.cardCount.official === Number(total);
    const galerie = /^([A-Z]+)(\d+)$/.exec(total);
    // TG/GG ont leur propre dénominateur, distinct du total de l’extension.
    if (galerie) return serie.cards.filter(carte => carte.localId.toUpperCase().startsWith(galerie[1])).length === Number(galerie[2]);
    return [serie.id, serie.abbreviation?.official].some(code => code && cleNom(code) === cleNom(total));
  }

  private async charger<T extends z.ZodType<object>>(chemin: string, schema: T, actualiser = false): Promise<z.output<T>> {
    try {
      const donnees = await this.cache.fetch(chemin, { context: schema, forceRefresh: actualiser });
      if (!donnees) throw new Error('Réponse TCGdex absente');
      return donnees as z.output<T>;
    } catch (erreur) {
      if (erreur instanceof HTTPError && erreur.response.status === 404) throw new NotFoundException('Cette fiche Pokémon est introuvable.');
      throw new ServiceUnavailableException('Les données Pokémon sont temporairement indisponibles. Réessaie dans un instant.');
    }
  }
}
