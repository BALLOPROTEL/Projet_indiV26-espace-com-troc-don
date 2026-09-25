# LOT 2 — Keycloak, OAuth2/OIDC et RBAC

## Objectif

Prouver que l'API NestJS :

- refuse une requête sans jeton ;
- valide cryptographiquement les access tokens Keycloak ;
- contrôle l'issuer et l'audience ;
- extrait les rôles de `realm_access.roles` ;
- applique les rôles `USER`, `MODERATOR` et `ADMIN`.

## Architecture locale

- Keycloak : `http://localhost:8081`
- realm : `projet-indiv26`
- audience API : `api`
- client de smoke test : `cli`
- API : `http://localhost:3000`

Keycloak est lancé en `start-dev` uniquement pour le sandbox local. Cette configuration n'est pas une cible de production.

## Credentials de démonstration

Ces comptes sont exclusivement locaux et reproductibles :

- `demo-user / demo-user-local`
- `demo-moderator / demo-moderator-local`
- `demo-admin / demo-admin-local`

Ils ne doivent jamais être réutilisés hors de ce sandbox.

## Démarrage

Depuis WSL :

```bash
git fetch origin
git switch --track origin/feat/10-lot2-keycloak-rbac

pnpm install
cp apps/api/.env.example apps/api/.env

docker compose up -d postgres keycloak
docker compose ps
```

Vérifier le realm :

```bash
curl -fsS http://localhost:8081/realms/projet-indiv26/.well-known/openid-configuration
```

Puis démarrer l'API :

```bash
pnpm api:dev
```

Dans un second terminal :

```bash
bash scripts/keycloak-smoke.sh
```

## Preuves attendues

```text
[OK] No token -> protected: HTTP 401
[OK] USER -> protected: HTTP 200
[OK] USER -> moderator: HTTP 403
[OK] MODERATOR -> moderator: HTTP 200
[OK] ADMIN -> moderator: HTTP 200
[OK] ADMIN -> admin: HTTP 200
LOT 2 smoke test: PASS
```

## Sécurité JWT

L'API utilise le JWKS publié par Keycloak et exige :

- signature JWT valide ;
- algorithme `RS256` ;
- issuer exact ;
- audience `api` ;
- token non expiré.

Les jetons ne sont jamais stockés dans le dépôt ni imprimés par le script de smoke test.

## Note sur le password grant

Le client `cli` active temporairement le Direct Access Grant uniquement pour automatiser la preuve locale 401/403/200. Ce client n'est pas l'architecture d'authentification du futur frontend. Un frontend utilisateur devra utiliser Authorization Code + PKCE.

## Gate LOT 2

Le lot est terminé lorsque :

- Keycloak démarre de manière reproductible ;
- le realm est importé ;
- les rôles sont présents dans les tokens ;
- tests unitaires authN/authZ verts ;
- typecheck/build verts ;
- CI verte ;
- smoke test réel 401/403/200 vert.
