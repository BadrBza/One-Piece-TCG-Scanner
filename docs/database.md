# SQLite et Prisma

Prisma **7.10.0** utilise `better-sqlite3`. Un client NestJS unique dessert les quatre repositories ; les contrats HTTP restent inchangés. `DATABASE_PATH` reste facultatif, avec `apps/api/data/app.db` par défaut. Pour un autre fichier, utiliser un chemin absolu dans `.env` ou l’environnement.

## Activation

Arrêter l’API et Prisma Studio, puis lancer depuis la racine :

```powershell
pnpm --filter @opscan/api db:prepare
pnpm dev
```

La commande vérifie le schéma et l’intégrité, crée une sauvegarde SQLite cohérente à côté du fichier existant (`app.db.backup-<date>.db`), reprend la version 5 puis applique les migrations Prisma. Elle accepte aussi une base vide et ne modifie pas une base déjà à jour. Un ancien schéma, une modification inattendue ou une migration inachevée bloque la préparation sans réinitialisation.

Les migrations conservent les données et les contraintes : ajout d’un identifiant aux envois de codes, puis alignement des déclarations SQL sur Prisma. Les horodatages restent des entiers en millisecondes (`BigInt` côté Prisma) et les dates texte restent inchangées. Les identifiants existants restent identiques ; les futurs identifiants numériques utilisent `AUTOINCREMENT`.

## Restauration

API et Studio arrêtés, conserver le fichier ayant échoué à part, puis remplacer la base par **la sauvegarde dont le chemin a été affiché** :

```powershell
Copy-Item -LiteralPath 'CHEMIN_DE_LA_SAUVEGARDE.db' -Destination 'apps/api/data/app.db' -Force
```

Adapter la destination si `DATABASE_PATH` est renseigné. S’il reste des fichiers `-wal`, `-shm` ou `-journal` associés, les déplacer avec la base écartée avant restauration. Revenir aussi au code antérieur pour utiliser une sauvegarde v5, ou relancer la préparation après correction. Toute modification faite après la sauvegarde sera perdue lors de la restauration.

## Commandes

| Commande depuis la racine | Usage |
| --- | --- |
| `pnpm --filter @opscan/api db:generate` | Générer le client TypeScript, également fait avant build/dev |
| `pnpm --filter @opscan/api db:prepare` | Première activation avec sauvegarde et contrôles, ou préparation idempotente |
| `pnpm --filter @opscan/api db:migrate` | Appliquer les migrations suivantes sur une base déjà gérée par Prisma, après sauvegarde |
| `pnpm --filter @opscan/api db:studio` | Explorer les données localement |
| `pnpm --filter @opscan/api test:database` | Après compilation API : vérifier la migration et les parcours sur des bases isolées |

Pour faire évoluer le schéma, générer une migration avec `prisma migrate dev --create-only` **sur une base de développement isolée**, puis relire son SQL. Prisma ne représente pas les `CHECK` : les recopier lors de toute reconstruction de `portfolio_cards`. Ne pas utiliser `db push` ou `migrate reset` sur les données à conserver.

Les vérifications ciblées remplacent l’ancien test SQL d’authentification : comparaison des données sur une copie de la base locale, base vide, refus des schémas inconnus, inscription, tokens, cookies, concurrence, collection et cotes. SMTP et catalogues sont simulés ; aucun appel IA n’est effectué.
