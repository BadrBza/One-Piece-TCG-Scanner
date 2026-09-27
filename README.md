# HakiScan

Scanne tes cartes One Piece et Pokémon, consulte leur cote Cardmarket et gère ta collection.

## Fonctionnalités

- Identification par photo avec Gemini et choix de la variante.
- Pokémon FR/EN/JP : identification par référence, nom et extension, puis choix manuel de la finition, sans comparaison d’images.
- Recherche par référence sans IA : Cardmarket pour One Piece, TCGdex pour Pokémon.
- Collection personnelle avec quantités, tri et cotes actualisées chaque jour à 12 h (Europe/Brussels).
- Inscription avec vérification par e-mail, pseudo et photo de profil facultative.
- Confirmation avant suppression d’une carte.

## Installation

Prérequis : **Node.js 22.13+** et **pnpm**.

```powershell
pnpm install
Copy-Item .env.example .env
```

Renseigne `GOOGLE_GENERATIVE_AI_API_KEY` dans `.env` pour utiliser le scan photo. Les autres réglages sont disponibles dans `.env.example`.

```powershell
pnpm dev
```

Configure le SMTP pour recevoir le code d’inscription : [guide d’authentification](docs/authentication.md). Ouvre <http://localhost:5173>. La recherche par référence fonctionne sans clé Gemini.

## Commandes

| Commande | Action |
| --- | --- |
| `pnpm dev` | Lancer le frontend et l’API |
| `pnpm dev:web` | Lancer le frontend |
| `pnpm dev:api` | Lancer l’API |
| `pnpm build` | Compiler le projet sans lancer de tests |

## Stack et données

React, TypeScript et Tailwind CSS côté interface ; NestJS, AI SDK et Gemini côté API.

Les comptes et collections sont conservés dans SQLite (`apps/api/data/app.db` par défaut). Sauvegarde cette base pour conserver tes données.

Les cotes sont des estimations Cardmarket, sans filtre de langue ou d’état ni frais de port. Les résultats du scan restent à vérifier.

Pour les réglages avancés, consulte le [guide de performance du scanner](docs/scanner-performance.md).

Le catalogue One Piece est conservé en mémoire et dans `.cache/cardmarket/snapshot.json`. Réglages : `CARDMARKET_CACHE_ENABLED` et `CARDMARKET_CACHE_TTL_MS`. Pokémon utilise les fiches TCGdex sans clé supplémentaire, avec un cache mémoire d’une heure ; images et cotes dépendent de leur disponibilité.

Pour suivre les fonctionnalités dans le code : [guide de lecture](docs/code-navigation.md).
