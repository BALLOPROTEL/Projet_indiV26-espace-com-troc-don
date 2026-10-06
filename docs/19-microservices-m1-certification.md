# M1 — Certification du socle microservices

## Objectif

Prouver que le monorepo peut démarrer plusieurs processus backend indépendants avant toute extraction métier.

## Services

| Service | Port | Health |
|---|---:|---|
| API Gateway | 3100 | `/api/health/live`, `/api/health/ready` |
| Catalog Service | 3101 | `/health/live`, `/health/ready` |
| Marketplace Service | 3102 | `/health/live`, `/health/ready` |
| Notification Service | 3103 | `/health/live`, `/health/ready` |

## Validation Codespaces

Validé dans le Codespace de référence sur la branche `refactor/44-microservices-architecture` :

- `pnpm services:typecheck` : PASS pour les 4 services ;
- `pnpm services:build` : PASS pour les 4 services ;
- `pnpm services:dev` : les 4 processus NestJS démarrent simultanément ;
- health Gateway : PASS ;
- health Catalog : PASS ;
- health Marketplace : PASS ;
- health Notification : PASS ;
- PostgreSQL / Keycloak / MinIO du Codespace : PASS.

## Portée

M1 ne déplace encore aucune logique métier du monolithe. Les processus sont volontairement minimaux afin d'établir une fondation déployable/testable avant M2.

## Prochaine étape

M2 — extraire Listings, Moderation, Listing Images, règles de publication et MinIO vers `apps/catalog-service`, tout en gardant les contrats HTTP publics stables via la stratégie Strangler.
