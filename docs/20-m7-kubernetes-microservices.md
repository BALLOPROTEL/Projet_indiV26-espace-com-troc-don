# M7 — Kubernetes multi-services

## Objectif

M7 porte sur Kubernetes l'architecture microservices certifiée en M6. Le sandbox de référence reste Minikube pour la démonstration, tandis que la CI utilise kind pour vérifier automatiquement un vrai cluster.

La cible n'est plus l'ancien monolithe Kubernetes du LOT 6. Les workloads applicatifs sont désormais séparés :

- Web ;
- API Gateway ;
- Legacy API, uniquement comme fallback Strangler ;
- Catalog Service ;
- Marketplace Service ;
- Notification Service ;
- PostgreSQL ;
- RabbitMQ ;
- Keycloak ;
- MinIO.

Prometheus et Grafana restent présents et l'observabilité est désormais rattachée au Gateway.

## Topologie

```text
Browser
  |
  +-- https://app.projet-indiv26.local  -> Web
  |
  +-- https://api.projet-indiv26.local  -> API Gateway
  |                                         |
  |                                         +-> legacy-api:3099
  |                                         +-> catalog-service:3101
  |                                         +-> marketplace-service:3102
  |
  +-- https://auth.projet-indiv26.local -> Keycloak

Marketplace Service -> catalog-service:3101
Marketplace Service -> rabbitmq:5672 -> Notification Service
Catalog Service     -> postgres:5432 (schema catalog)
Marketplace Service -> postgres:5432 (schema marketplace)
Legacy API          -> postgres:5432 (schema public)
Catalog Service     -> minio:9000
```

Aucun appel inter-service applicatif ne dépend de `localhost` ou `127.0.0.1`.

## Workloads et isolation

Chaque application possède son propre `Deployment` et son propre `Service` ClusterIP.

Les trois ownerships Prisma sont migrés par des Jobs séparés :

- `legacy-migrate` ;
- `catalog-migrate` ;
- `marketplace-migrate`.

MinIO garde un Job `minio-bootstrap` dédié.

Les Secrets ne sont pas versionnés. `scripts/m7-k8s-runtime-config.sh` les crée ou les réutilise pour le cluster courant, puis génère :

- URLs PostgreSQL par schéma ;
- token inter-service Catalog/Marketplace ;
- URL RabbitMQ ;
- token de métriques Gateway ;
- credentials Keycloak ;
- credentials MinIO ;
- realm Keycloak adapté aux URLs Kubernetes ;
- certificat TLS local pour les trois hosts de démonstration.

## Probes et ressources

Les six workloads applicatifs possèdent des probes Kubernetes et des requests/limits.

Le Gateway utilise :

- startup : `/api/health/live` ;
- liveness : `/api/health/live` ;
- readiness : `/api/health/ready`.

Legacy utilise les mêmes chemins avec le préfixe `/api`. Catalog, Marketplace et Notification utilisent `/health/live` et `/health/ready`. Le Web est sondé sur `/`.

PostgreSQL, RabbitMQ, Keycloak et MinIO ont également leurs contrôles de disponibilité.

## HPA

Le HPA est maintenant appliqué au Gateway, le véritable point d'entrée backend :

- minReplicas : 1 ;
- maxReplicas : 4 ;
- cible CPU : 60 % ;
- scale-down stabilization : 60 s.

## Ingress et TLS

Un seul Ingress `platform` expose :

- `app.projet-indiv26.local` -> Web ;
- `api.projet-indiv26.local` -> Gateway ;
- `auth.projet-indiv26.local` -> Keycloak.

Le certificat local contient les trois SAN DNS.

Le frontend conserve son contrat public `/api`; son image est compilée avec `API_INTERNAL_URL=http://gateway:3000`.

## Déploiement Minikube

```bash
pnpm m7:k8s:up
```

Cette commande :

1. démarre Minikube si nécessaire ;
2. active Ingress et metrics-server ;
3. build les images runtime et migration ;
4. charge les images locales dans Minikube ;
5. crée/réutilise les Secrets runtime ;
6. adapte le realm Keycloak ;
7. déploie PostgreSQL, RabbitMQ, MinIO et Keycloak ;
8. exécute les Jobs MinIO et Prisma ;
9. applique le Kustomize complet ;
10. attend les rollouts ;
11. exécute la validation M7.

## Validation statique

```bash
pnpm m7:k8s:validate:manifests
```

La gate vérifie notamment :

- Deployments/Services séparés ;
- images M7 ;
- Jobs de migration ;
- DNS Kubernetes ;
- absence de localhost inter-service ;
- probes ;
- requests/limits ;
- HPA Gateway ;
- Ingress TLS ;
- discovery Prometheus du Gateway.

## Validation live Minikube

```bash
pnpm m7:k8s:validate
```

Elle vérifie en plus :

- rollouts des workloads ;
- Jobs terminés ;
- RabbitMQ opérationnel ;
- Gateway -> Legacy/Catalog/Marketplace via DNS Kubernetes ;
- Marketplace -> Catalog via DNS Kubernetes ;
- HTTPS Ingress Web/Gateway/Keycloak ;
- JWT Keycloak réel, issuer/audience inclus, accepté jusqu'au Marketplace Service ;
- métriques HPA disponibles.

## Smoke CI kind

```bash
pnpm m7:k8s:smoke
```

Le smoke crée un cluster kind éphémère, charge les images locales, applique la même stack Kustomize et vérifie le réseau inter-services ainsi qu'un JWT réel via le Gateway.

L'Ingress et metrics-server sont certifiés statiquement dans cette gate CI ; leur preuve dynamique complète reste exécutée par le scénario Minikube.

## Limites assumées

M7 reste un sandbox de soutenance :

- un seul nœud Minikube/kind ;
- PostgreSQL, RabbitMQ et MinIO non HA ;
- certificat autosigné ;
- pas de secret manager externe ;
- pas encore de NetworkPolicy complète ;
- pas de GitOps ni de Helm.

Ces sujets ne sont pas présentés comme des garanties de production.
