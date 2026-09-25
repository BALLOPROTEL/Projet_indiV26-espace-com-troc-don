# LOT 3 — Annonces de troc/don et modération

## Objectif

Le LOT 3 livre la première verticale métier complète du POC : un utilisateur authentifié crée une annonce de troc ou de donation, la modération décide de sa publication, et seules les annonces approuvées deviennent visibles publiquement.

## Modèle métier

Une `Listing` contient :

- `id`
- `ownerId` : sujet OIDC Keycloak de l'auteur
- `title`
- `description`
- `operationType` : `TRADE` ou `DONATION`
- `status` : `PENDING`, `APPROVED` ou `REJECTED`
- `moderationReason`
- `createdAt`
- `updatedAt`

Les données d'identité complètes ne sont pas dupliquées dans PostgreSQL : le lien avec l'identité est le `sub` OIDC.

## Règles métier

1. Toute nouvelle annonce est créée en `PENDING`.
2. Seules les annonces `APPROVED` sont visibles sur l'endpoint public.
3. Le propriétaire voit toutes ses propres annonces, quel que soit leur statut.
4. Seul le propriétaire peut modifier son annonce.
5. Une annonce `APPROVED` n'est plus modifiable par son propriétaire.
6. La modification d'une annonce `REJECTED` la remet en `PENDING` et efface le motif de rejet.
7. Seuls `MODERATOR` et `ADMIN` accèdent aux endpoints de modération.
8. Seule une annonce `PENDING` peut être approuvée ou rejetée.
9. Un rejet exige un motif de modération.
10. Les entrées HTTP sont filtrées et validées par `ValidationPipe`.

## Endpoints

### Public

- `GET /api/listings` : annonces `APPROVED` uniquement.

### Authentifié

- `POST /api/listings` : création en `PENDING`.
- `GET /api/listings/me` : annonces de l'utilisateur courant.
- `PATCH /api/listings/:id` : modification par le propriétaire selon les règles métier.

### Modération

- `GET /api/moderation/listings?status=PENDING`
- `POST /api/moderation/listings/:id/approve`
- `POST /api/moderation/listings/:id/reject`

## OpenAPI

Swagger est exposé localement sur :

- UI : `http://localhost:3000/docs`
- JSON : `http://localhost:3000/docs-json`

Le schéma annonce les DTO et l'authentification Bearer JWT.

## Preuve E2E

Le script `scripts/lot3-smoke.sh` vérifie réellement avec Keycloak, NestJS et PostgreSQL :

1. Swagger disponible ;
2. USER crée une annonce → `201`, statut `PENDING` ;
3. l'annonce PENDING n'est pas publique ;
4. le propriétaire la voit dans `/api/listings/me` ;
5. USER tente la modération → `403` ;
6. MODERATOR voit l'annonce en file de modération ;
7. MODERATOR approuve → `APPROVED` ;
8. l'annonce devient publique ;
9. une deuxième annonce est rejetée et reste non publique ;
10. USER tente de modifier l'annonce d'un autre propriétaire → `403`.

Résultat attendu :

`LOT 3 smoke test: PASS`

## Commandes de validation

```bash
pnpm install
pnpm db:generate
pnpm db:deploy
pnpm api:typecheck
pnpm api:test
pnpm api:build

docker compose up -d postgres keycloak
pnpm api:dev
# autre terminal
bash scripts/lot3-smoke.sh
```

## Limites du LOT 3

Le LOT 3 porte sur la verticale métier backend. Le frontend Next.js, la couverture/gates renforcées, l'image applicative, Kubernetes, l'observabilité, la charge et l'audit de sécurité sont traités dans les lots suivants.
