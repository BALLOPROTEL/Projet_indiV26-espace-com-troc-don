# LOT 1 — Base technique

## Objectif

Obtenir une API NestJS exécutable, reliée à PostgreSQL via Prisma et capable d'exposer des health checks utilisables ensuite par Docker et Kubernetes.

## Branche

`feat/9-lot1-base-technique`

## Démarrage local

Depuis WSL :

```bash
cd ~/projets/Projet_individuel26/Projet_indiV26-espace-com-troc-don

git fetch origin
git switch feat/9-lot1-base-technique

cp apps/api/.env.example apps/api/.env

docker compose up -d postgres
docker compose ps

pnpm install
pnpm db:generate
pnpm db:deploy

pnpm api:typecheck
pnpm api:test
pnpm api:build
pnpm api:dev
```

Dans un second terminal :

```bash
curl -i http://localhost:3000/api/health/live
curl -i http://localhost:3000/api/health/ready
```

Résultat attendu :

- `/api/health/live` → HTTP 200 ;
- `/api/health/ready` → HTTP 200 lorsque PostgreSQL est disponible ;
- `/api/health/ready` → HTTP 503 lorsque PostgreSQL est indisponible.

## PostgreSQL

Le service local utilise :

- image : `postgres:16-alpine`
- base : `projet_indiv26`
- utilisateur : `app`
- port : `5432`

Le mot de passe du compose est uniquement destiné au développement local. Il ne constitue pas un secret de production.

## Migration initiale

La migration LOT 1 est volontairement une baseline sans table métier. Les tables métier apparaîtront au LOT 3 pour éviter d'introduire artificiellement des modèles qui n'appartiennent pas à la base technique.

## Gate LOT 1

Le lot est prêt à être clôturé lorsque :

- l'installation pnpm est reproductible et le lockfile est versionné ;
- PostgreSQL est Healthy ;
- Prisma Client est généré ;
- `prisma migrate deploy` fonctionne ;
- typecheck, tests et build passent ;
- liveness = 200 ;
- readiness = 200 avec DB et 503 sans DB ;
- la CI exécute les vérifications applicatives.
