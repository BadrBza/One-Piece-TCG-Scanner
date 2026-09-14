# Scanner : optimisation et validation

Le parcours optimisé est activé par défaut. Il lit le numéro, recherche les fiches
Cardmarket puis compare les images. Le parcours normal utilise deux générations
Gemini. Les nouvelles tentatives et le modèle de secours peuvent augmenter ce nombre.

## Réglages et retour arrière

- `SCAN_OPTIMIZED=false` restaure les analyses et la comparaison précédentes après
  redémarrage du backend. Les routes et le format général des réponses restent compatibles.
- `SCAN_MATCH_THRESHOLD=0.95` est un seuil provisoire, **non calibré sur des photos réelles**.
  Le score du modèle n'est pas une probabilité de réussite mesurée.
- `GEMINI_NUMBER_MODEL=gemini-3.5-flash-lite` et `SCAN_NUMBER_REASONING=minimal`
  pilotent la lecture rapide, indépendamment des autres modèles. Pour retrouver la
  lecture précédente, choisir `gemini-3.5-flash` et `low`.
- `GEMINI_NUMBER_FALLBACK_MODEL=gemini-3.5-flash` lit la photo complète en secours,
  toujours avec le raisonnement `low`.

## Comportement

Une lecture illisible ou un numéro sans fiche déclenche au maximum
une nouvelle lecture de la photo complète avec le modèle de secours, même sans gros plan.
Le parcours optimisé ne dépasse jamais deux appels de lecture : les nouvelles tentatives
automatiques du SDK et le secours générique du fournisseur sont désactivés pour cette étape.
Une erreur fournisseur ou une réponse JSON invalide est remontée directement. Une panne de catalogue ne déclenche pas
une nouvelle lecture. Si aucune carte n'est trouvée, la saisie manuelle reste disponible.

La première comparaison utilise des références de 600 × 840 pixels maximum et une
photo de 1000 × 1400 maximum, sans agrandissement. En cas de doute, une seconde
comparaison utilise les originaux et la résolution haute. Les références précèdent
la photo dans un ordre stable pour favoriser le cache implicite Gemini, sans garantie
de cache fournisseur. Un ID inconnu, aucune correspondance ou un score insuffisant
laissent le choix à l'utilisateur. Une référence manquante interdit la sélection
automatique, même si une autre semble correspondre.

L'extension et la rareté sont récupérées en parallèle ; leur absence ne retarde pas
le résultat. Les informations inconnues restent inconnues. Les images de référence,
miniatures, métadonnées et le catalogue Cardmarket sont rechargés à chaque scan.
Une recherche manuelle peut compléter les descriptions.

## Mesures et benchmark

Les logs `ScanMetrics` donnent un identifiant de scan, les durées par étape,
les succès/échecs et les tokens des générations réussies. Les étapes `number-fast`
et `number-fallback` distinguent les deux lectures du parcours optimisé. La télémétrie AI SDK
est activée sans enregistrer les entrées/sorties ; un export OpenTelemetry nécessite
un exporteur configuré par l'hébergement. Aucun exporteur distant n'est ajouté.

Constituer un lot stable d'au moins 30 photos annotées : standards, parallèles,
alternate arts, mangas, plusieurs langues, reflets, flou et inclinaison. Ne pas
utiliser les mêmes photos pour régler le seuil et pour la validation finale.
Créer un manifeste JSON, les chemins d'images étant relatifs à ce manifeste :

```json
[
  {
    "id": "photo-01",
    "image": "photos/carte.jpg",
    "cardNumber": "OP01-001",
    "productId": 12345,
    "language": "EN"
  }
]
```

L'identifiant produit ci-dessus est un exemple à remplacer par la fiche vérifiée.
Aucun corpus photographique annoté n'est fourni dans le dépôt.

Depuis la racine :

```powershell
pnpm build
node --test apps/api/test/*.test.mjs
node --env-file=.env apps/api/scripts/benchmark-scan.mjs chemin/manifest.json
# Appels réels et facturables uniquement avec --run :
node --env-file=.env apps/api/scripts/benchmark-scan.mjs chemin/manifest.json --run
```

Le script valide d'abord les fichiers, puis compare l'ancien et le nouveau parcours
sur chaque photo. L'ordre des parcours alterne.
Il ne peut pas vider le cache interne Gemini. Le rapport sous `.cache/scanner-benchmarks`
contient médiane, p95, erreurs, bonnes/mauvaises sélections, langue, tokens et étapes.
Les fichiers des photos ne sont pas copiés dans le rapport. Les tokens seuls ne
constituent pas une facture : appliquer les tarifs du modèle pour estimer le coût.

Critères proposés : médiane réduite d'au moins 25 %, aucune hausse des mauvaises
sélections automatiques et pas de baisse des bonnes sélections sur le lot de validation.
Examiner aussi le p95 et les erreurs pour éviter de masquer les scans difficiles.
Le gain et le seuil ne sont pas validés tant que ce benchmark réel n'a pas été exécuté.
Le streaming, la détection des contours et le cache explicite Gemini sont différés.

## Comparer uniquement la nouvelle lecture du numéro

Ajouter `--number-comparison` au benchmark pour garder le parcours optimisé dans
les deux groupes et comparer Flash/low à la lecture rapide configurée (Lite/minimal
par défaut). Le groupe `optimized: false` devient alors la référence Flash/low ;
les autres étapes restent identiques. Le secours explicite reste Flash/low dans
les deux groupes : ce test isole le modèle et le raisonnement de première lecture.

```powershell
node --env-file=.env apps/api/scripts/benchmark-scan.mjs chemin/manifest.json --number-comparison --run
```

Ne pas comparer des photos différentes entre les groupes. Aucun gain réel de cette
modification n'est encore validé sans ce lot photographique.
