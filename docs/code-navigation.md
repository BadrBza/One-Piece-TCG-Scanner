# Lire le code

Chaque fonctionnalité suit le même chemin : **écran → hook/action → client API → contrôleur → service métier → fournisseur ou repository**. Une étape reste absente quand elle ne ferait que transmettre un appel.

| Parcours | Points d’entrée, dans l’ordre |
| --- | --- |
| Navigation et session | `App.tsx` → `useSession.ts` → `auth.api.ts` → `auth.controller.ts` → `auth.service.ts` / `token-session.service.ts` → `token-session.repository.ts` |
| Inscription | `LoginPage.tsx` → `auth.api.ts` → `auth.controller.ts` → `verification.service.ts` → `verification.repository.ts` et `email.service.ts` |
| Code reçu | `VerifyEmail.tsx` → `auth.api.ts` → `verification.service.ts` → création du compte et de la session |
| Scan photo | `Scanner.tsx` → `useScanner.ts` → `scanner.api.ts` → `cards.controller.ts` → `cards.service.ts` |
| Reconnaissance | `recognition.service.ts` → lecture rapide → secours si nécessaire → numéro validé |
| Catalogue et variante | `cards.service.ts` → `cardmarket.provider.ts` → `card-variants.service.ts` → résultat |
| Pokémon | `cards.service.ts` → `pokemon.service.ts` → `tcgdex.provider.ts` → fiche ou choix manuel |
| Référence manuelle | `useScanner.ts` → `scanner.api.ts` → `cards.service.ts.lookup` → `cardmarket.provider.ts`, sans IA |
| Collection | composants de collection → `portfolio.api.ts` → `portfolio.controller.ts` → `portfolio.repository.ts` |
| Actualisation des cotes | `portfolio-price-updater.service.ts` → `cardmarket.provider.ts` → `portfolio.repository.ts` |

Le frontend se trouve dans `apps/web/src` et l’API dans `apps/api/src`. Les fonctionnalités sont regroupées dans `features` côté frontend et dans leurs modules NestJS côté API.

## Conventions

- Lire d’abord la fonction publique : elle présente les étapes métier. Les détails privés viennent ensuite.
- Nommer les étapes métier internes en français ; conserver les conventions des frameworks et les contrats JSON existants.
- Utiliser des retours anticipés pour les erreurs ou les parcours alternatifs.
- Préférer `const` et les valeurs retournées aux objets modifiés implicitement.
- Extraire une fonction pour une responsabilité distincte ou une vraie duplication, pas pour chaque ligne.
- Valider les données aux frontières avec Zod ; garder les contrôles d’accès et les limites de ressources.
- Les appels HTTP et leur renouvellement de session sont centralisés dans `lib/http.ts` ; les clients métier définissent seulement les routes et leurs options spécifiques.
- Garder les transactions de vérification et de rotation intactes : une erreur ne doit pas annuler le comptage des tentatives ou une révocation.

## Parcours interne du scan

`RecognitionService.identify` valide et décode les images une fois, puis renvoie soit une demande de confirmation, soit `{ carte, photo, secoursUtilise }`. `CardsService` consulte le catalogue et peut déclencher une seule lecture de secours si le numéro est absent, si le parcours est optimisé et si le secours n’a pas déjà été utilisé. Une panne du catalogue ne déclenche pas de lecture supplémentaire.

One Piece et Pokémon partagent `preparerImagesScan`, les réglages de lecture et `genererStructure`. `mesurerGeneration` regroupe durée et usage ; les services gardent la décision de secours et la création des délais.

La photo décodée passe ensuite à `CardVariantsService` : téléchargement des références, comparaison selon le parcours choisi, puis construction du résultat. La recherche manuelle conserve son ordre de produits et n’appelle pas ce service. Les informations internes de lecture ne sont jamais incluses dans la réponse HTTP.

Le service de vérification prépare sa configuration une fois par inscription ou renvoi, réserve le code dans une transaction, puis envoie l’e-mail hors transaction. Le repository utilise Prisma. Une validation de code incorrecte comptabilise sa tentative avant de retourner l’erreur.

Les sessions suivent la même séparation : le service décide des expirations et rotations, le repository exécute les requêtes Prisma. `DatabaseService` partage un client ; les modèles et migrations sont dans `apps/api/prisma`. Les opérations passent par `$transaction` pour isoler les accès à la connexion SQLite ; une opération déjà transactionnelle transmet son client explicitement. Voir [la gestion de la base](database.md).

Le fournisseur Cardmarket restaure le cache disque une seule fois, puis utilise `lru-cache` pour les lectures et actualisations. Les téléchargements partagent une instance Ky ; les écritures disque restent séquentielles et ne bloquent pas les scans.

## Pokémon

`game: 'pokemon'` sélectionne ce parcours sur `/cards/scan`, `/cards/lookup` et `/cards/resolve`. Sans ce champ, les routes restent One Piece. La recherche manuelle accepte `number`, `language` (`FR`, `EN`, `JP`), `name` et `set`. La résolution d’un choix accepte `catalogId` et `language`, sans image.

Le service effectue au plus deux lectures Gemini, avec les modèles de lecture déjà configurés. La recherche catalogue est déterministe et ne télécharge aucune image. Les correspondances ambiguës renvoient `card_confirmation_required` ; une fiche identifiée contient ses finitions avec des identifiants distincts de ceux de Cardmarket. Les métriques sont préfixées `pokemon-`.

TCGdex est appelé via Ky (15 s, sans nouvelle tentative), validé avec Zod et mis en cache via `lru-cache` (500 réponses, une heure). Les cartes Pocket sont exclues par leur série. Les prix manquants ou partagés entre éditions impossibles à distinguer restent indisponibles.

La recherche choisit les extensions par code, total ou nom avant de charger leurs fiches. `pokemon-card.ts` rassemble la construction des cartes et de leurs finitions ; le repository prépare leur identité avant l’insertion SQL.

La migration SQLite vers la version 5 préserve les identifiants et quantités existants. One Piece reste regroupé par produit Cardmarket ; Pokémon est regroupé par carte catalogue, langue et finition, pour chaque utilisateur. L’ajout Pokémon recharge la fiche validée côté serveur. À 12 h (Europe/Brussels), l’actualisation traite les deux jeux séparément et conserve les anciennes cotes en cas d’échec.
