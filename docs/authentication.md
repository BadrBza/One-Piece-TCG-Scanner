# Authentification

Les nouvelles inscriptions nécessitent un code e-mail à 6 chiffres, valable 10 minutes avec 5 essais maximum. Le renvoi est limité à un par minute et 5 par heure par adresse. NestJS Throttler limite également les tentatives par IP. Le mot de passe est haché avec scrypt ; le compte est créé uniquement après validation du code. Une inscription en attente expire après 24 heures.

## Configuration SMTP

Renseigner `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM` et, si nécessaire, `SMTP_USER` / `SMTP_PASSWORD` dans `.env`. `SMTP_SECURE=true` correspond au TLS dès la connexion (habituellement port 465) ; `SMTP_REQUIRE_TLS=true` impose STARTTLS. En production, TLS est obligatoire.

Définir `AUTH_VERIFICATION_SECRET` avec une valeur aléatoire privée d’au moins 32 caractères. Exemple de génération :

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Les valeurs locales par défaut ciblent un serveur de capture SMTP sur `127.0.0.1:1025`. Il faut lancer ce serveur séparément pour lire les codes dans sa boîte locale ; aucun message ne sera livré à une vraie boîte e-mail avec ces réglages. Pour une livraison réelle, remplacer ces valeurs par celles du fournisseur SMTP et une adresse d’expéditeur autorisée. L’application ne journalise ni les codes ni les tokens. Un échec d’envoi conserve l’inscription en attente et permet un renvoi ; les envois échoués comptent dans les limites.

## Sessions

- Access token opaque : 1 heure maximum.
- Refresh token opaque : rotation à chaque renouvellement, expiration absolue 24 heures après connexion, sans prolongation.
- Cookies HttpOnly / SameSite=Lax, Secure en production ; aucun token dans les réponses JSON, localStorage, sessionStorage ou l’état React. Le navigateur conserve les cookies et les envoie automatiquement.
- Seuls les hachages des tokens sont stockés en base. La déconnexion révoque la session et tous ses tokens.
- Une réponse 401 sur une requête protégée déclenche un renouvellement partagé entre les requêtes du même onglet, puis une seule nouvelle tentative. Une erreur réseau ne déconnecte pas l’utilisateur.
- Deux onglets renouvelant simultanément peuvent recevoir un 409 temporaire : réessayer l’action. Un refresh déjà consommé réutilisé après 10 secondes révoque la session.

L’ancienne migration d’authentification exemptait les comptes historiques de vérification. La reprise Prisma conserve ces exemptions, les comptes, les collections et les sessions en cours. Voir [migration et restauration](database.md).

En production, utiliser HTTPS et `NODE_ENV=production`. `FRONTEND_URL` doit correspondre exactement à l’origine du navigateur (sans slash final). Les requêtes de modification sans cette origine sont refusées. Frontend et API doivent être sur le même site ; en local sur iPhone, utiliser la même adresse IP du PC pour les deux, avec leurs ports respectifs. Le limiteur IP suppose une connexion directe à l’API ; derrière un proxy, configurer uniquement les proxys de confiance avant d’utiliser l’adresse transférée.

Routes : `POST /api/auth/register`, `login`, `verify`, `resend`, `refresh`, `logout` ; `GET /api/auth/me` et `/api/auth/verification`. L’inscription renvoie un état `verification_required`, jamais une session connectée. Le statut de vérification se retrouve grâce au cookie HttpOnly après rechargement.
