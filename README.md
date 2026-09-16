# HakiScan

Scanne tes cartes One Piece TCG, consulte leur cote Cardmarket et gère ta collection.

## Fonctionnalités

- Identification par photo avec Gemini et choix de la variante.
- Recherche par référence directement dans les données Cardmarket, sans IA.
- Collection personnelle avec quantités, tri et cotes actualisées chaque jour à 12 h (Europe/Brussels).
- Inscription avec pseudo et photo de profil facultative.
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

Ouvre <http://localhost:5173> et crée un compte. La recherche par référence fonctionne sans clé Gemini.

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

Le catalogue Cardmarket est conservé en mémoire et sauvegardé dans `.cache/cardmarket/snapshot.json` pour les redémarrages. Il est actualisé en arrière-plan après une heure, à la prochaine recherche. Réglages : `CARDMARKET_CACHE_ENABLED` et `CARDMARKET_CACHE_TTL_MS`.
