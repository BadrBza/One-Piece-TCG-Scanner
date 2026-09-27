import { Module } from '@nestjs/common';
import { PokemonService } from './pokemon.service.js';
import { TcgdexProvider } from './tcgdex.provider.js';

@Module({ providers: [PokemonService, TcgdexProvider], exports: [PokemonService, TcgdexProvider] })
export class PokemonModule {}
