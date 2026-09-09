# OnePiece TCG Scanner

Application MVP pour scanner une carte One Piece TCG et recuperer une
estimation Cardmarket, avec une collection persistante par compte.

## Stack

- Frontend: React, TypeScript, Vite, Tailwind CSS
- Backend: NestJS, Fastify, AI SDK, Gemini, Zod, SQLite (Node.js 22.13+)

## Architecture

```txt
apps/
  web/
    src/
      api/
      components/
      features/scanner/
        components/
      features/portfolio/
        components/
      pages/
      App.tsx
      main.tsx

  api/
    src/
      cards/
      auth/
      database/
      portfolio/
      schemas/
      prompts/
      recognition/
      pricing/
      app.module.ts
      main.ts
```

## Flux principal

La page d'entrée est la connexion. L'inscription ou la connexion redirige vers
le scanner. Une session valide reste active après actualisation ; la déconnexion
revient à la page de connexion. Le scanner et la collection exigent aussi une
session côté API.

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

Installer les dépendances avec `pnpm install` (Node.js 22.13 minimum).

Copier .env.example vers .env et configurer :
- GOOGLE_GENERATIVE_AI_API_KEY : clé Gemini côté serveur.
- GEMINI_MODEL : gemini-3.5-flash par défaut.
- GEMINI_FALLBACK_MODEL : gemini-3.5-flash-lite si le modèle principal
  renvoie 404, 429 ou une erreur serveur temporaire.
- GEMINI_VARIANT_MODEL : modèle léger utilisé pour décrire les variantes.
- DATABASE_PATH : facultatif, chemin du fichier SQLite. Par défaut : `apps/api/data/app.db`.
- FRONTEND_URL : origine autorisée pour le navigateur, `http://localhost:5173` par défaut.

La photo est envoyée à Gemini au clic sur Scanner, sans stockage dans l'application.
Redémarrer le backend après modification de .env. Ne jamais publier les clés.

Lancer pnpm dev puis ouvrir http://localhost:5173.

## Comptes et collection

Après avoir choisi une variante, cliquer sur **Ajouter à ma collection**.
Après un scan photo, Gemini compare la carte aux images Cardmarket et ouvre
directement la variante la plus proche. Le bouton **Changer de variante** permet
toujours de consulter les autres fiches de la même référence.
Un nouvel ajout de la même variante augmente sa quantité pour le compte connecté.
La page **Ma collection** affiche les images de référence, les langues, raretés,
quantités et cotes Cardmarket actualisées chaque semaine
automatiquement. Retirer une variante supprime tous ses exemplaires après confirmation.

Les comptes, sessions et cartes sont enregistrés dans SQLite. La base est créée
et migrée automatiquement au démarrage, et exclue de Git. Sauvegarder ce fichier
pour conserver la collection lors d'un changement de machine.

Les mots de passe sont hachés avec scrypt et un sel aléatoire. Les sessions de
30 jours utilisent un cookie HttpOnly, SameSite=Lax (Secure en production).
Chaque accès à une collection utilise l'identifiant du compte de la session.
L'inscription et la connexion sont limitées à 20 tentatives par IP sur 15 minutes.
Cette version utilise des comptes locaux, sans vérification e-mail ni récupération
de mot de passe. En production, servir le frontend et l'API sur le même site HTTPS
et définir FRONTEND_URL sur l'origine exacte du frontend.

## Vérification

Compiler avec pnpm --filter @opscan/api build et pnpm --filter @opscan/web build.
Exécuter node --test apps/api/test/*.test.mjs.
Les tests IA simulent le transport HTTP et ne mesurent pas la précision visuelle.
