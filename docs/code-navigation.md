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

La photo décodée passe ensuite à `CardVariantsService` : téléchargement des références, comparaison selon le parcours choisi, puis construction du résultat. La recherche manuelle conserve son ordre de produits et n’appelle pas ce service. Les informations internes de lecture ne sont jamais incluses dans la réponse HTTP.

Le service de vérification prépare sa configuration une fois par inscription ou renvoi, réserve le code dans une transaction, puis envoie l’e-mail hors transaction. Le repository conserve les requêtes préparées. Une validation de code incorrecte comptabilise sa tentative avant de retourner l’erreur.

Les sessions suivent la même séparation : le service décide des expirations et rotations, le repository exécute le SQL. `DatabaseService` orchestre les migrations dont le SQL est regroupé dans `database.schema.ts`.

Le fournisseur Cardmarket restaure le cache disque une seule fois, puis utilise `lru-cache` pour les lectures et actualisations. Les téléchargements partagent une instance Ky ; les écritures disque restent séquentielles et ne bloquent pas les scans.
