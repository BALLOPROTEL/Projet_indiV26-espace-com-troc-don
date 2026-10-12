# M10 — Exploitation, résilience, retour arrière et préparation technique

**Complément du [dossier d'architecture M10](24-m10-architecture-finale.md), issue [#57](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/57).** Procédures de référence **lecture seule** par défaut ; ne pas appliquer de nettoyage destructif sur le Codespace ou sur Minikube.

## 1. Environnements et contrat du diagramme

| Aspect | Docker Compose / Codespaces | Minikube M7 / kind CI |
| --- | --- | --- |
| Frontend / Gateway | Web `:3001`, Gateway `:3000` ; ports bindés localement | Ingress TLS `app/api/auth.projet-indiv26.test` |
| Services | Catalog `:3101`, Marketplace `:3102`, Notification `:3103`, Legacy `:3099` | Deployments et Services distincts, ports internes |
| Identité | Keycloak `start-dev` + realm importé, `:8081` local | Keycloak `start-dev` derrière Ingress TLS de labo, base PG dédiée `keycloak` |
| Persistance | PG partagé avec schémas `public/catalog/marketplace/notification` + volumes PG/RabbitMQ/MinIO | PG partagé sur PVC, DB Keycloak distincte, PVC RabbitMQ/MinIO |
| Migrations | Conteneurs temporaires `legacy-migrate`, `catalog-migrate`, `marketplace-migrate`, `notification-migrate` | 4 Jobs Prisma, init MinIO, versionnement d'images locales |
| Santé | Healthchecks de démarrage Compose | Probes startup/liveness/readiness avec ressources |
| Scaling / monitor | Vérifications HTTP en CI jetable | Gateway HPA min 1/max 4 CPU 60 % ; Prometheus/Grafana |

L'instance PostgreSQL est partagée pour simplifier le laboratoire ; l'**ownership logique** demeure strictement séparé. Les secrets du Compose sont des valeurs d'exemple locales, **jamais** de production.

## 2. Endpoints et chemins de diagnostic

| Cible | Liveness | Readiness / diagnostic | Propriétaire |
| --- | --- | --- | --- |
| Gateway | `/api/health/live` | `/api/health/ready` | `apps/gateway` |
| Legacy API | `/api/health/live` | `/api/health/ready` | `apps/api` |
| Catalog | `/health/live` | `/health/ready` | `apps/catalog-service` |
| Marketplace | `/health/live` | `/health/ready` | `apps/marketplace-service` |
| Notification | `/health/live` | `/health/ready` | `apps/notification-service` |
| Web | `/` | Page / espace membre | `apps/web` |
| Identity | Métadonnées `/realms/projet-indiv26/.well-known/openid-configuration` | Idem + cohérence de l'issuer | Keycloak |

Le Gateway expose la santé agrégée `/api/health/ready`, mais sa **readiness de pod** est configurée sur `/api/health/live` pour éviter de retirer l'entrée HTTP du service si un backend tombe : `infra/k8s/minikube/gateway-deployment.yaml`.

## 3. Vérifications non destructives conseillées

Depuis un environnement **déjà démarré** seulement, sans déclencher de reconstructions lourdes :

```bash
git status --short
df -h .
docker compose ps
docker compose logs --tail=30 gateway catalog-service marketplace-service notification-service
```

Pour la topologie Kubernetes, uniquement si un cluster M7 compatible est **déjà** sélectionné :

```bash
kubectl config current-context
kubectl get deploy,svc,job,ingress -n projet-indiv26
kubectl get hpa gateway -n projet-indiv26
kubectl get pods -n projet-indiv26
```

**Ne pas exécuter automatiquement :** `docker compose down -v`, `kubectl delete pvc`, purge d'images/volumes, `pnpm m7:k8s:up`, reconstructions Minikube ou changement de contexte Kubernetes. Les CI disposent de stacks jetables isolées.

## 4. Mécanique métier et recovery

- **Publication** : une annonce est d'abord `PENDING` ; 5–8 images privées stockées dans MinIO ; modérateur doit ouvrir la galerie privée avant approbation. Une annonce approuvée ne peut plus être librement éditée. Les routes publiques ne servent pas les photos privées tant que l'annonce est `PENDING`.
- **Acceptation DON** : `POST /internal/listings/:id/reserve` fait passer l'annonce à `RESERVED` ; Marketplace effectue le claim conditionnel de l'acceptation et stocke `MarketplaceTransaction`. En conflit, le service tente `release`.
- **TROC** : réservation séquentielle **des deux** annonces, puis création d'une seule transaction. En cas d'échec sur la seconde réservation, compensation `release` de la première ; cette compensation est *best effort*. Vérifier manuellement les états en cas de panne au milieu.
- **Deux confirmations** : le premier accusé de remise laisse la transaction `IN_PROGRESS` ; le second complète les annonces via Catalog puis fait passer Marketplace à `COMPLETED`. L'écriture interservices n'est pas atomique. En cas d'erreur réseau, **diagnostiquer** les deux fiches Catalog, la transaction Marketplace et l'outbox ; ne pas relancer aveuglément une confirmation.
- **Refus** : une transaction Prisma écrit simultanément la transition `REJECTED` et un événement dans `MarketplaceOutboxEvent`. Un worker réessaie la publication avec le même `eventId` ; Notification insère dans une inbox durable avec unicité `eventId` et ACK RabbitMQ après persistance.
- **Autres événements** : `proposal.created`, `proposal.accepted`, `transaction.completed` sont publiés hors transaction métier, via publisher confirms. **Risque d'événement manquant en cas de crash entre commit et publish**, non résolu par l'inbox du consommateur.

## 5. Parcours de panne / diagnostic de cause racine

| Symptôme | Diagnostic non destructif | Limite et remédiation |
| --- | --- | --- |
| Gateway 502 | Consulter `/api/health/ready` + santé Catalog/Marketplace/Legacy ; logs Gateway | Timeout proxy 15 s ; ne jamais présenter Gateway comme coupe-circuit complet |
| `401/403` | Vérifier issuer, audience, roles, propriété et token interne pour `/internal` | 401 auth absente/invalide ; 403 souvent propriété/rôle métier |
| `409` sur transaction | Consulter disponibilité Catalog et état `Proposal` / `MarketplaceTransaction` | Claims conditionnels ; concurrence légitime ou reprise partielle |
| Images privées impossibles à charger | Vérifier MinIO, identité propriétaire/modérateur, statut PENDING, signature MIME | Ne pas activer un bucket public pour masquer le problème |
| Événements absents | Examiner publisher, outbox si refus, queue RabbitMQ, inbox Notification par `eventId` | Outbox **partielle** : événements hors outbox non rejouables automatiquement depuis la DB |
| Deux annonces avec états divergents | Comparer la transaction et chaque disponibilité Catalog | Aucune saga de réparation entièrement automatique démontrée |
| Keycloak redémarre et sujet change | Vérifier issuer, UUID `sub`, procédure de snapshot M7 | Ne pas considérer `start-dev` comme production |

## 6. Stratégie de retour arrière / démo de secours technique

1. **Avant toute manipulation**, relever `git rev-parse HEAD`, contexte Kubernetes, état des pods, santé Gateway/Catalog/Marketplace/Notification et captures existantes. Ne jamais exposer ni copier les secrets.
2. **Rollback applicatif d'une PR** : produire une PR `revert` ciblée et passer les tests sur un environnement isolé avant de revenir sur une version publiée. Les migrations de schéma peuvent être **non réversibles** : vérifier les évolutions Prisma avant toute rétrogradation.
3. **Rollback Kubernetes** : les Deployments ont un historique limité ; un `rollout undo` n'est envisageable que lorsque l'image et le schéma de DB restent compatibles. **Ne pas exécuter sans sauvegarde et accord**.
4. **État métier partiel** : comparer les deux `Listing` Catalog, `Proposal` / `MarketplaceTransaction` Marketplace, l'événement outbox et l'inbox Notification. Réparer via procédure explicitement revue ; ne pas supprimer de ligne/volume ou recréer de transaction sans preuve.
5. **Pour présenter l'architecture sans réinitialiser l'environnement**, ouvrir les diagrammes Mermaid de [M10](24-m10-architecture-finale.md), afficher une page publique existante et montrer les chemins d'API/health. Cela constitue un **plan technique de lecture**, pas encore le scénario oral, les slides ou la vidéo de LOT 10-B.

## 7. Matrice des preuves et liens de lecture, sans consolidation LOT 10

La finalité de M10 est de relier les décisions de schéma à des fichiers vérifiables, **pas** de commencer le dossier de preuves, la présentation ni les nouveaux développements frontend.

- [Routage Gateway](../apps/gateway/src/routes.ts) ; [Middleware proxy](../apps/gateway/src/proxy.ts).
- [Catalog API interne](../apps/catalog-service/src/internal/internal-listings.controller.ts) ; [Modération](../apps/catalog-service/src/listings/moderation.controller.ts) ; [S3/MinIO](../apps/catalog-service/src/listings/listing-images.service.ts).
- [Proposals](../apps/marketplace-service/src/proposals/proposals.service.ts) ; [Transactions](../apps/marketplace-service/src/transactions/transactions.service.ts) ; [Outbox](../apps/marketplace-service/src/events/outbox.worker.ts).
- [RabbitMQ consumer](../apps/notification-service/src/rabbitmq/rabbitmq.consumer.ts) ; [Notification inbox](../apps/notification-service/src/notifications/notification.store.ts).
- [Docker Compose](../compose.yaml) ; [Kubernetes manifests](../infra/k8s/minikube/kustomization.yaml) ; [Ingress](../infra/k8s/minikube/platform-ingress.yaml) ; [HPA](../infra/k8s/minikube/gateway-hpa.yaml).

**Phase frontend (prochaine après M10) : attente du GO explicite du propriétaire.** Aucune modification de `apps/web` ou de son interface n'entre dans cette PR. Les issues [#58](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/58) et [#59](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/59) demeurent **en attente**.
