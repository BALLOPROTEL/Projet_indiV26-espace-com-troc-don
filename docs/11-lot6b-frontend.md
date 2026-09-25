# LOT 6B — Frontend Next.js, UX éditoriale et Keycloak PKCE

## Objectif

Le LOT 6B transforme la verticale backend validée aux LOT 1 à 6 en application réellement démontrable.

Le frontend doit permettre le parcours :

`visiteur → connexion → création PENDING → modération → APPROVED → publication publique`

## 1. Direction artistique

Le projet évite volontairement les codes visuels génériques des dashboards SaaS.

Direction retenue :

**cabinet de curiosités éditorial / brocante contemporaine**

Palette :
- ivoire / papier ;
- bordeaux patiné ;
- vert mousse ;
- terracotta ;
- laiton discret.

Principes :
- titres serif éditoriaux ;
- texte système lisible ;
- composition légèrement asymétrique ;
- fiches d'inventaire comme cartes d'annonces ;
- ombres et rotations très discrètes ;
- pas de dark theme noir/bleu ;
- pas de grands gradients violet/bleu ;
- pas de composants UI génériques sans contexte métier.

## 2. Stack

- Next.js 16.3.6 ;
- React 19.3.0 ;
- TypeScript strict ;
- Keycloak JS 26.2.4 ;
- Vitest 5.0.1 ;
- ESLint / eslint-config-next.

Versions relevées au démarrage du lot depuis les packages npm publiés.

## 3. Routes

### `/`

Cabinet public.

Fonctions :
- récupérer `GET /api/listings` ;
- n'afficher que ce que l'API expose publiquement ;
- distinguer TROC et DON ;
- gérer loading / empty / error ;
- inviter vers l'espace membre.

### `/espace`

Espace membre.

Fonctions :
- authentification Keycloak ;
- consultation `GET /api/listings/me` ;
- création `POST /api/listings` ;
- modification `PATCH /api/listings/:id` ;
- statut PENDING / APPROVED / REJECTED ;
- motif de rejet visible ;
- une annonce APPROVED n'est plus éditable.

### `/moderation`

Réserve de modération.

Fonctions :
- visible dans la navigation uniquement pour MODERATOR / ADMIN ;
- contrôle du rôle dans la page ;
- file PENDING ;
- approbation ;
- rejet avec motif.

Le frontend ne remplace jamais le contrôle serveur : l'API conserve ses guards RBAC.

## 4. Authentification navigateur

Un client Keycloak public `web` est ajouté au realm reproductible.

Configuration :
- Standard Flow : activé ;
- Direct Access Grant : désactivé ;
- client public ;
- PKCE : S256 ;
- redirect URI locale : port 3001 ;
- audience `api` ajoutée à l'access token.

Le frontend utilise :
- `check-sso` au chargement ;
- Authorization Code + PKCE ;
- rafraîchissement du token avant les appels protégés ;
- logout avec retour à l'application.

Le client CLI utilisé pour les smoke tests LOT 2 reste séparé.

## 4bis. Thème Keycloak

Le redirect vers Keycloak est volontaire : les identifiants restent gérés par l'Identity Provider.

Pour éviter l'apparence technique du thème par défaut, un thème `petite-maison` est versionné dans :

`infra/keycloak/themes/petite-maison`

Le thème :
- reprend l'identité ivoire / bordeaux / vert mousse du frontend ;
- affiche le branding `La Petite Maison de l’Épouvante` ;
- force le français comme locale du realm ;
- personnalise les champs et le bouton de connexion ;
- conserve les templates Keycloak standards via héritage `keycloak.v2`.

Le thème est monté dans le conteneur local via Docker Compose et sélectionné par `loginTheme: petite-maison`.

Cette approche conserve la séparation de sécurité OIDC : le frontend ne collecte jamais le mot de passe utilisateur.

## 5. CORS API

L'API accepte explicitement les origines configurées via :

`WEB_ORIGIN`

Valeur locale par défaut :

```text
http://localhost:3001,http://127.0.0.1:3001
```

Méthodes exposées :
- GET ;
- POST ;
- PATCH ;
- OPTIONS.

Headers :
- Content-Type ;
- Authorization.

## 6. Couche API frontend

Le module `apps/web/lib/api.ts` centralise :
- URL API ;
- Bearer token ;
- parsing des erreurs ;
- appels publics ;
- appels propriétaire ;
- appels de modération.

Les types Listing sont centralisés dans `lib/types.ts`.

## 7. UX / accessibilité

Éléments intégrés :
- HTML sémantique ;
- labels explicites ;
- boutons natifs ;
- focus visible ;
- contraste chaud mais lisible ;
- états loading / empty / error ;
- annonces de feedback avec `aria-live` ;
- modale avec `role=dialog` et `aria-modal` ;
- responsive mobile/tablette/desktop ;
- support `prefers-reduced-motion`.

Une revue RGAA plus formelle pourra être intégrée au LOT 9 / consolidation finale.

## 8. Qualité

Commandes :

```bash
pnpm web:lint
pnpm web:typecheck
pnpm web:test
pnpm web:build
pnpm web:quality
```

Tests initiaux :
- labels métier TROC/DON ;
- labels de statuts ;
- règle UI de verrouillage d'une annonce APPROVED.

Ces tests ne remplacent pas les tests API du LOT 4.

## 9. Démarrage local

Prérequis :
- PostgreSQL ;
- Keycloak ;
- API ;
- frontend.

Après mise à jour du realm Keycloak, recréer le conteneur pour réimporter le client `web`.

Exemple :

```bash
docker compose rm -sf keycloak
docker compose up -d keycloak
```

API :

```bash
pnpm api:dev
```

Frontend dans un autre terminal :

```bash
pnpm web:dev
```

URL :

`http://localhost:3001`

## 10. Comptes de démonstration

Utilisateur :
- `demo-user`
- mot de passe local déjà défini dans le realm de démonstration.

Modérateur :
- `demo-moderator`

Administrateur :
- `demo-admin`

Les secrets de démonstration existants sont strictement destinés au sandbox local.

## Gate de sortie LOT 6B

- frontend installé avec lockfile ;
- lint PASS ;
- typecheck PASS ;
- tests PASS ;
- build Next.js PASS ;
- login PKCE fonctionnel ;
- USER crée une annonce ;
- annonce visible dans `Mon étagère` ;
- MODERATOR voit la file PENDING ;
- MODERATOR approuve ou rejette ;
- APPROVED apparaît sur l'accueil ;
- navigation responsive ;
- CI PR verte ;
- merge main ;
- CI post-merge verte.
