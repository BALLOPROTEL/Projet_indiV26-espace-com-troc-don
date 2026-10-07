# Migration microservices — issue #44

## Pourquoi ce chantier

Le jury demande une architecture microservices pour la soutenance. Le backend actuel `apps/api` est un monolithe NestJS qui charge dans un même processus l'authentification, les annonces, la modération, le stockage, les règles marketplace, Prisma et l'observabilité.

La migration est incrémentale afin de conserver les parcours déjà certifiés et le contrat HTTP consommé par `apps/web`.

## M0 — cartographie du monolithe

### Modules actuels

| Module actuel | Responsabilité | Cible |
| --- | --- | --- |
| `auth` | validation JWT Keycloak / rôles | Gateway + garde interne minimale par service |
| `listings` | annonces, modération, images | Catalog Service |
| `storage` | S3/MinIO | Catalog Service |
| `marketplace` | règles DON/TROC/transactions | Marketplace Service |
| `prisma` | accès à toutes les tables | séparé par service |
| `health` | probes | chaque service |
| `observability` | métriques | chaque service + agrégation Prometheus |

Le monolithe importe actuellement `PrismaModule`, `ListingsModule`, `MarketplaceModule`, `AuthModule`, `HealthModule` et `ObservabilityModule` dans un seul `AppModule`.

### Contrat public à préserver

Le frontend continue d'appeler `/api/...` via un point d'entrée unique.

Routes Catalog à préserver derrière le Gateway :

- `GET /api/listings`
- `POST /api/listings`
- `GET /api/listings/me`
- `GET /api/listings/:id`
- `PATCH /api/listings/:id`
- `PUT /api/listings/:id/images`
- `DELETE /api/listings/:id/images`
- `GET /api/listings/:id/images`
- `GET /api/listings/:id/images/:imageId/content`
- `GET /api/listings/:id/images/:imageId/content/authorized`
- `GET /api/moderation/listings`
- `POST /api/moderation/listings/:id/approve`
- `POST /api/moderation/listings/:id/reject`

Les futurs endpoints DON/TROC seront exposés par le Gateway mais implémentés dans Marketplace Service.

## Architecture cible

```text
Browser
  |
  v
Next.js Web
  |
  v
API Gateway  -------------------------- Keycloak
  | JWT propagation
  +----------+--------------------+
  |          |                    |
  v          v                    v
Catalog   Marketplace        Notification
Service   Service            Service
  |          |                    ^
  |          +------ RabbitMQ ----+
  |
 MinIO

PostgreSQL instance de dev
  |- catalog_db / catalog schema
  `- marketplace_db / marketplace schema
```

## Ownership des données

### Catalog Service

Possède :

- `Listing`
- `ListingImage`
- `ListingTradeWish`

Le Catalog Service est le seul service autorisé à modifier l'état d'une annonce et sa galerie.

### Marketplace Service

Possède :

- `Proposal`
- `MarketplaceTransaction`

Il ne possède pas de clé étrangère SQL vers Catalog. Il conserve les IDs d'annonces comme références externes et valide leur état via l'API interne du Catalog Service.

### Notification Service

Ne possède aucune donnée métier critique dans la première extraction. Il consomme des événements RabbitMQ et fournit une preuve de communication asynchrone.

## Contrats inter-services initiaux

Catalog Service expose un contrat interne non public :

- `GET /internal/listings/:id` — snapshot métier minimal
- `POST /internal/listings/:id/reserve` — réservation conditionnelle
- `POST /internal/listings/:id/complete` — clôture conditionnelle
- `POST /internal/listings/:id/release` — libération après annulation si applicable

Ces routes ne sont pas appelées directement par le navigateur.

## Evénements RabbitMQ prévus

- `proposal.created`
- `proposal.accepted`
- `proposal.rejected`
- `listing.reserved`
- `transaction.completed`
- `transaction.cancelled`

Le Notification Service consomme ces événements sans bloquer la transaction HTTP principale.

## Stratégie Strangler

1. **M0** — cartographie et contrats : ce document.
2. **M1** — créer quatre processus indépendants : Gateway, Catalog, Marketplace, Notification.
3. **M2** — copier puis extraire Listing/Storage vers Catalog ; garder les routes externes inchangées.
4. **M3** — extraire Proposal/Transaction vers Marketplace et supprimer les relations SQL cross-domain.
5. **M4** — transformer l'ancien point d'entrée HTTP en Gateway ; le frontend reste inchangé.
6. **M5** — ajouter RabbitMQ et Notification Service.
7. **M6** — Docker Compose / Codespaces multi-services.
8. **M7** — Kubernetes : Deployment + Service + probes + resources par service.
9. **M8** — tests de contrat, intégration, E2E et sécurité.
10. **M9** — reprendre LOT 9B-D et 9B-E dans Marketplace Service.
11. **M10** — preuves et diagrammes de soutenance.

## Règles anti-faux-microservices

- aucun service n'importe le Prisma Client d'un autre service ;
- aucune jointure SQL entre domaines ;
- aucun accès direct au MinIO hors Catalog Service ;
- les changements d'état Catalog sont demandés via API interne ;
- le frontend ne connaît que le Gateway ;
- chaque service possède son health endpoint, son build et son processus ;
- les échanges asynchrones passent par RabbitMQ ;
- les packages partagés futurs ne contiennent que des contrats/types techniques, jamais de logique métier ou d'accès base.

## Ports de migration Codespaces

Pendant l'extraction, pour ne pas casser le monolithe encore actif :

- monolithe historique : `3000`
- Gateway skeleton : `3100`
- Catalog Service : `3101`
- Marketplace Service : `3102`
- Notification Service : `3103`

Au M4, le Gateway prendra le port public `3000` et le monolithe cessera d'être le point d'entrée.

## Critères M0

- responsabilités actuelles cartographiées ;
- routes publiques existantes figées ;
- ownership cible défini ;
- contrats inter-services initiaux définis ;
- stratégie de migration documentée.

**M0 : versionné — validation dans la PR architecture.**


## M5 — RabbitMQ + Notification Service

### Topologie

- exchange topic durable : `marketplace.events` ;
- queue Notification durable : `notification.marketplace-events.v1` ;
- bindings : `proposal.*` et `transaction.*` ;
- messages persistants, enveloppe versionnée `version: 1` ;
- publisher Marketplace en confirm channel ;
- reconnexion RabbitMQ automatique côté publisher et consumer.

### Événements réellement émis au M5

- `proposal.created` après persistance d'une proposition ;
- `proposal.accepted` après acceptation et création de la transaction ;
- `transaction.completed` après les deux confirmations et clôture métier.

Les événements prévus mais sans transition métier actuellement implémentée (`transaction.cancelled`, etc.) ne sont pas simulés artificiellement.

### Notification Service

Le Notification Service ne lit aucune table Marketplace/Catalog et ne reçoit aucun appel HTTP synchrone de Marketplace. Il consomme uniquement RabbitMQ.

Pour la démonstration jury et les tests, il conserve les 50 derniers événements reçus **en mémoire** et expose `GET /notifications/recent` sur son port interne `:3103`. Cet endpoint n'est pas routé par le Gateway public.

### Fiabilité M5

- Marketplace déclare l'exchange, la queue Notification et ses bindings avant de devenir ready ;
- publisher confirms bornés par timeout, suivi `blocked/unblocked`, puis retry avec le même `eventId` après reconstruction du channel ;
- Notification recrée son consumer après annulation broker et déduplique les redeliveries par `eventId` ;
- les payloads sont validés par type avant ACK ;
- `transaction.completed` n'est publié que par la requête qui gagne la transition conditionnelle `IN_PROGRESS → COMPLETED` ;
- le smoke M5 construit lui-même Marketplace et corrèle les trois événements à un identifiant de listing unique au run.

Le publisher attend la confirmation RabbitMQ après le commit métier, mais un broker durablement indisponible ne rollback pas une transaction métier déjà validée. Un **transactional outbox** reste donc le durcissement recommandé si une garantie de livraison at-least-once à travers une panne longue entre commit DB et publication devient obligatoire.
