# OnePiece TCG Scanner

Application MVP pour scanner une carte One Piece TCG et recuperer une
estimation de prix depuis plusieurs sources.

## Stack

- Frontend: React, TypeScript, Vite, Tailwind CSS
- Backend: NestJS, Fastify, AI SDK, Gemini, Zod

## Architecture

```txt
apps/
  web/
    src/
      api/
      features/scanner/
        components/
      pages/
      App.tsx
      main.tsx

  api/
    src/
      cards/
      recognition/
      pricing/
      app.module.ts
      main.ts
```

## Flux principal

Importer une photo puis cliquer sur **Scanner** lance une seule identification
avec Gemini via AI SDK. Un gros plan du bas de la photo accompagne l'image
originale dans ce même appel. Le numéro reste modifiable via la recherche
manuelle si le modèle s'est trompé.

Le backend récupère les variantes du numéro sur Cardmarket. L'utilisateur
choisit sa variante dans une grille d'images avec extension, langue, rareté
(C, UC, R, SR, SEC, L, P) et illustration (standard, parallèle, manga, etc.).
La langue et le type d'illustration sont lus par l'IA sur chaque image de
référence. La rareté provient du catalogue de cartes. Ces informations restent
des indications à vérifier.
Les descriptions sont mises en cache 24 heures en mémoire.

Le choix affiche uniquement la tendance du guide public pour la fiche choisie,
non filtrée par langue ni état. Il n'y a plus de double lecture bloquante,
de choix automatique d'une fiche, ni de récupération automatique d'offres.

## Configuration

Copier .env.example vers .env et configurer :
- GOOGLE_GENERATIVE_AI_API_KEY : clé Gemini côté serveur.
- GEMINI_MODEL : gemini-3.5-flash par défaut.
- GEMINI_FALLBACK_MODEL : gemini-3.5-flash-lite si le modèle principal
  renvoie 404, 429 ou une erreur serveur temporaire.
- GEMINI_VARIANT_MODEL : modèle léger utilisé pour décrire les variantes.

La photo est envoyée à Gemini au clic sur Scanner, sans stockage dans l'application.
Redémarrer le backend après modification de .env. Ne jamais publier les clés.

Lancer pnpm dev puis ouvrir http://localhost:5173.

## Vérification

Compiler avec pnpm --filter @opscan/api build et pnpm --filter @opscan/web build.
Exécuter node --test apps/api/test/*.test.mjs.
Les tests IA simulent le transport HTTP et ne mesurent pas la précision visuelle.
