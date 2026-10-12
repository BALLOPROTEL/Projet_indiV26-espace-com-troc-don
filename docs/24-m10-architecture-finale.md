# M10 — Architecture microservices finale (état réel, octobre 2026)

> **Référence de soutenance technique — issue [#57](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/57), epic [#44](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/44).** Diagrammes **Mermaid éditables et affichés par GitHub** ; décrivent le code de `main` après fusion de [#60](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/pull/60) et [#61](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/pull/61), et non une architecture cible imaginaire. Les limites sont volontaires et documentées.

**Périmètre :** application Next.js, API Gateway NestJS, Catalog Service, Marketplace Service, Notification Service, Keycloak, RabbitMQ, PostgreSQL, MinIO, Legacy API du modèle Strangler, Docker Compose, Minikube/kind, Prometheus/Grafana. Les figures ci-dessous représentent des **flux logiques** ; elles ne prétendent pas à un réseau sécurisé par NetworkPolicies ou à une HA de production.

## 1. Diagramme de conteneurs — vue logique type C4 (niveau 2)

```mermaid
flowchart LR
    B["Navigateur : membre, modérateur, visiteur"]
    IN["Ingress HTTPS en Minikube / ports locaux en Compose"]
    W["Web Next.js : 3001"]
    KC["Keycloak : OIDC / PKCE"]
    G["API Gateway NestJS : 3000"]
    C["Catalog Service : 3101"]
    M["Marketplace Service : 3102"]
    N["Notification Service : 3103"]
    L["Legacy API : 3099"]
    R["RabbitMQ : exchange marketplace.events"]
    S3["MinIO : bucket listing-images"]
    PG["Instance PostgreSQL :5432"]
    PGC["Schéma catalog"]
    PGM["Schéma marketplace"]
    PGN["Schéma notification"]
    PGL["Schéma public (legacy)"]
    PGK["Base keycloak (Minikube)"]

    B -->|"HTTPS : pages"| IN
    IN -->|"/"| W
    IN -->|"/api"| G
    IN -->|"/auth host"| KC
    B <-->|"OIDC Authorization Code + PKCE"| KC
    W -.->|"proxy /api hors Ingress"| G
    G -->|"/api/listings et /api/moderation"| C
    G -->|"/api/proposals et /api/transactions"| M
    G -->|"/api/auth seulement"| L
    M -->|"HTTP interne + x-internal-service-token"| C
    M -->|"événements topic AMQP"| R
    R -->|"consommation + ack après commit"| N
    C -->|"S3 privé"| S3
    C --> PGC
    M --> PGM
    N --> PGN
    L --> PGL
    KC -.->|"Minikube seulement"| PGK
    PGC --- PG
    PGM --- PG
    PGN --- PG
    PGL --- PG
    PGK --- PG
```

**Interprétation :** les services partagent une **instance PostgreSQL de laboratoire** avec **schémas Prisma distincts** ; aucune jointure ni relation SQL interservices n'est implémentée. Les références d'annonces circulent par identifiant et contrat HTTP. En **Compose**, Keycloak démarre en `start-dev --import-realm` sans base PostgreSQL Keycloak dédiée ; en **Minikube**, il dispose de la **base PostgreSQL distincte `keycloak`** (et non d'un schéma Prisma). Le dessin différencie cette particularité.

**Routage réellement en place :** `apps/gateway/src/routes.ts` route seulement `/api/listings*` et `/api/moderation/listings*` vers Catalog, `/api/proposals*` et `/api/transactions*` vers Marketplace, `/api/auth*` vers Legacy et `/api/health/{live,ready}` et `/api/metrics` vers Gateway. **Le Gateway ne bascule pas automatiquement toute route inconnue vers Legacy** : le « fallback Strangler » est un routage résiduel explicite.

## 2. Parcours de publication et de modération — prérequis des transactions

```mermaid
sequenceDiagram
    autonumber
    actor Member as Membre
    participant Web as Web Next.js
    participant KC as Keycloak
    participant GW as API Gateway
    participant Cat as Catalog
    participant Min as MinIO
    participant DB as PostgreSQL / catalog
    actor Mod as Modérateur

    Member->>Web: Ouvrir Mon étagère
    Web->>KC: Connexion OIDC + PKCE
    KC-->>Web: Access token JWT
    Member->>Web: Déposer annonce DON/TROC et 5 à 8 images
    Web->>GW: POST /api/listings (JWT)
    GW->>Cat: POST /listings (JWT préservé)
    Cat->>DB: Enregistrer annonce PENDING + souhaits
    DB-->>Cat: ID annonce
    Cat-->>GW: ID + statut PENDING
    GW-->>Web: ID + statut PENDING
    Web->>GW: PUT /api/listings/:id/images (multipart + JWT)
    GW->>Cat: PUT /listings/:id/images
    Cat->>Min: Écrire 5 à 8 objets privés
    Cat->>DB: Métadonnées images par position
    Cat-->>GW: Métadonnées des images
    GW-->>Web: Galerie enregistrée
    Mod->>Web: Ouvrir /moderation
    Web->>GW: GET /api/moderation/listings (JWT modérateur)
    GW->>Cat: Demander les fiches PENDING
    Cat-->>Web: Titres, images, updatedAt
    Mod->>Web: Voir les 5 images privées
    Web->>GW: GET /api/listings/:id/images/:imageId/content/authorized
    GW->>Cat: JWT modérateur conservé
    Cat->>Min: Lire objet privé
    Min-->>Cat: Contenu binaire
    Cat-->>GW: Image protégée
    GW-->>Web: Réponse image avec contrôle des rôles
    Mod->>Web: Approuver la fiche
    Web->>GW: POST /api/moderation/listings/:id/approve
    GW->>Cat: JWT + reviewedUpdatedAt
    Cat->>DB: Transition conditionnelle PENDING vers APPROVED
    Cat-->>Web: Annonce publiquement visible
```

**Garde-fous vérifiés :** signature MIME, taille maximale de 5 MiB par image, 5–8 images et 5–10 souhaits TROC ; refus d'approbation incomplète, propriété des médias, autorisation `MODERATOR` / `ADMIN`, anti-stale `reviewedUpdatedAt`. Les tests Chrome et API de [#61](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/pull/61) incluent la relecture binaire des 15 images après les uploads successifs.

## 3. Séquence DON — succès, refus et notifications

```mermaid
sequenceDiagram
    autonumber
    actor R as Demandeur
    actor O as Propriétaire
    participant GW as Gateway
    participant M as Marketplace
    participant C as Catalog interne
    participant DB as PostgreSQL / marketplace
    participant MQ as RabbitMQ
    participant N as Notification
    participant ND as PostgreSQL / notification

    Note over R,O: Prérequis : annonce DON approuvée et AVAILABLE
    R->>GW: POST /api/proposals (DONATION_REQUEST + JWT)
    GW->>M: POST /proposals (JWT propagé)
    M->>C: GET /internal/listings/:id (token inter-service)
    C-->>M: Statut, type, ownerId, disponibilité
    M->>DB: Insérer proposition PENDING
    M->>MQ: Publier proposal.created (best effort)
    MQ-->>N: Livrer événement
    N->>ND: Insérer inbox unique(eventId)
    N-->>MQ: ACK après persistance
    M-->>R: Proposition créée
    O->>GW: GET /api/proposals/received (JWT)
    GW->>M: Lire propositions pour ses listings
    M->>C: GET /internal/listings/owner/:ownerId/ids
    C-->>M: Identifiants possédés
    M-->>O: Propositions reçues
    alt Refus
        O->>GW: POST /api/proposals/:id/reject
        GW->>M: Rejeter si propriétaire
        M->>DB: TX : PENDING vers REJECTED + outbox
        DB-->>M: Commit atomique
        M-->>O: Refus enregistré
        M->>MQ: Worker outbox : proposal.rejected (retry / même eventId)
        MQ-->>N: Livraison éventuellement répétée
        N->>ND: INSERT unique(eventId), ignorer doublon
        N-->>MQ: ACK après commit
    else Acceptation
        O->>GW: POST /api/proposals/:id/accept
        GW->>M: Contrôler propriétaire / proposition
        M->>C: POST /internal/listings/:id/reserve
        C-->>M: AVAILABLE vers RESERVED
        M->>DB: TX : ACCEPTED + rejets concurrents + transaction IN_PROGRESS
        DB-->>M: Commit
        M->>MQ: Publier proposal.accepted (best effort)
        M-->>O: Transaction IN_PROGRESS
        O->>GW: POST /api/transactions/:id/confirm
        GW->>M: ownerConfirmedAt
        M->>DB: Persister première confirmation
        M-->>O: Toujours IN_PROGRESS
        R->>GW: POST /api/transactions/:id/confirm
        GW->>M: requesterConfirmedAt
        M->>DB: Persister seconde confirmation
        M->>C: POST /internal/listings/:id/complete
        C-->>M: RESERVED vers COMPLETED
        M->>DB: Claim conditionnel : transaction COMPLETED
        M->>MQ: Publier transaction.completed (best effort)
        M-->>R: Transaction terminée
    end
```

**Nuance impérative :** seuls les événements `proposal.rejected` (refus explicite et refus automatiques lors d'une acceptation) passent aujourd'hui par une **outbox transactionnelle PostgreSQL** ; `proposal.created`, `proposal.accepted` et `transaction.completed` sont publiés **après** les écritures métier via le publisher RabbitMQ, sans garantie outbox équivalente. RabbitMQ utilise des confirmations de publication, et Notification persiste une inbox avec `eventId` unique ; **cela n'élimine pas le risque d'événement manquant côté producteur hors outbox**.

## 4. Séquence TROC — deux annonces, réservations et compensation

```mermaid
sequenceDiagram
    autonumber
    actor A as Demandeur
    actor B as Propriétaire
    participant GW as Gateway
    participant M as Marketplace
    participant C as Catalog interne
    participant DB as PostgreSQL / marketplace
    participant MQ as RabbitMQ
    participant N as Notification

    Note over A,B: Deux annonces TRADE APPROVED + AVAILABLE, propriétaires distincts
    A->>GW: POST /api/proposals (TRADE_OFFER, offeredListingId)
    GW->>M: JWT + IDs des deux fiches
    M->>C: GET fiche cible
    C-->>M: Propriétaire et disponibilité
    M->>C: GET fiche proposée
    C-->>M: Propriétaire demandeur, statut
    M->>DB: Créer proposition PENDING
    M->>MQ: proposal.created (best effort)
    MQ-->>N: Événement
    M-->>A: Offre enregistrée
    B->>GW: POST /api/proposals/:id/accept
    GW->>M: Acceptation du propriétaire
    M->>C: POST cible /reserve
    C-->>M: Cible RESERVED
    M->>C: POST contrepartie /reserve
    alt Une réservation échoue
        C-->>M: 409 / erreur
        M->>C: POST /release des réservations réussies
        Note over M,C: Compensation best effort, sans transaction SQL distribuée
        M-->>B: Échec (pas de transaction complète)
    else Deux réservations réussies
        C-->>M: Contrepartie RESERVED
        M->>DB: TX : ACCEPTED + rejets concurrents/outbox + transaction IN_PROGRESS
        M->>MQ: proposal.accepted (best effort)
        M-->>B: Transaction en cours
        B->>GW: POST /api/transactions/:id/confirm
        GW->>M: Première confirmation
        M->>DB: ownerConfirmedAt
        M-->>B: IN_PROGRESS
        A->>GW: POST /api/transactions/:id/confirm
        GW->>M: Deuxième confirmation
        M->>DB: requesterConfirmedAt
        M->>C: POST cible /complete
        M->>C: POST contrepartie /complete
        C-->>M: Les deux COMPLETED
        M->>DB: Claim transaction COMPLETED
        M->>MQ: transaction.completed (best effort)
        M-->>A: Échange terminé
    end
```

**Important :** le code effectue les deux changements Catalog successivement ; s'il échoue après le premier `complete`, aucune **transaction distribuée** n'annule automatiquement cette première clôture. Les réservations ont une compensation `release` *best effort* en cas d'échec d'acceptation ; l'état partiellement clos exige diagnostic et réparation opérateur. Les claims SQL conditionnels limitent les doubles transitions mais ne valent pas exactement-once interservices.

## 5. Propriété des données — frontières réelles

```mermaid
flowchart TB
    subgraph DB["Une instance PostgreSQL en laboratoire"]
      PUB[("public : Legacy API")]
      CAT[("catalog : Listing / ListingImage / ListingTradeWish")]
      MAR[("marketplace : Proposal / MarketplaceTransaction / MarketplaceOutboxEvent")]
      NOT[("notification : NotificationEvent(eventId unique)")]
      KEY[("Base keycloak distincte, Minikube")]
    end
    LEG["Legacy API"] --> PUB
    C["Catalog Service"] --> CAT
    M["Marketplace Service"] --> MAR
    N["Notification Service"] --> NOT
    KC["Keycloak"] -.->|"Minikube ; hors schémas métier"| KEY
    M -->|"HTTP avec service token, jamais SQL direct"| C
    M -->|"AMQP, pas de FK / jointure"| MQ["RabbitMQ"]
    MQ --> N
    C -->|"Objets images uniquement"| S3["MinIO / listing-images"]
```

| Propriétaire | Modèles / actifs | Accès autorisé | Interdit architecturalement |
| --- | --- | --- | --- |
| Catalog | Annonces, images (métadonnées), souhaits, modération, disponibilité | Prisma schema `catalog`, MinIO privé | Marketplace ne lit pas ses tables directement |
| Marketplace | Propositions, statuts, transactions, confirmations, outbox de refus | Prisma schema `marketplace`, API Catalog interne, RabbitMQ | Pas de FK SQL sur `catalog.Listing` |
| Notification | Événements reçus, `eventId` unique, timestamp | Prisma schema `notification`, RabbitMQ, endpoint `/notifications/recent` de labo | Ne modifie pas les annonces ni les transactions |
| Legacy | Routes d'auth résiduelles | Prisma schema `public` | Ne doit pas redevenir le backend des nouveaux flux |
| Keycloak | Comptes, rôles et realm | OIDC + JWKS ; base `keycloak` **dans Minikube uniquement** | Pas de dépendance FK métier sur les tables Keycloak |

## 6. Frontières de confiance, routing et droits

| Flux | Contrat réel | Contrôle de sécurité | Référence dans le dépôt |
| --- | --- | --- | --- |
| Navigateur ↔ Keycloak | OIDC Authorization Code + PKCE | Authentification utilisateur, issuer/audience JWT | `apps/web/lib/keycloak.ts` et `infra/keycloak/projet-indiv26-realm.json` |
| Navigateur → Gateway | `/api/*`, JWT Bearer transmis | CORS, en-têtes de sécurité, proxy 15 s ; **pas de JWT validé par Gateway** | `apps/gateway/src/main.ts`, `proxy.ts` |
| Gateway → Catalog | `/api/listings*`, `/api/moderation/listings*` → `/listings*`, `/moderation/listings*` | JWT vérifié **par Catalog** ; rôles USER/MODERATOR/ADMIN ; propriétaire des images | `apps/gateway/src/routes.ts`, `apps/catalog-service/src/auth` |
| Gateway → Marketplace | `/api/proposals*`, `/api/transactions*` → routes sans `/api` | JWT vérifié **par Marketplace** et contrôles métier propriétaire/participants | `apps/marketplace-service/src/proposals` et `transactions` |
| Gateway → Legacy | **`/api/auth*` uniquement** | Routage résiduel explicite ; dette Strangler | `apps/gateway/src/routes.ts` |
| Marketplace → Catalog | `/internal/listings/:id`, `/reserve`, `/complete`, `/release`, `/owner/:id/ids` | `x-internal-service-token` partagé, comparaison timing-safe | `catalog-client.service.ts`, `internal-service.guard.ts` |
| Marketplace → RabbitMQ | Exchange topic `marketplace.events` | URL et credentials RabbitMQ de labo ; publisher confirms ; refus via outbox | `apps/marketplace-service/src/events` |
| RabbitMQ → Notification | Queue durable `notification.marketplace-events.v1` | Contrat v1, déduplication PostgreSQL, ACK après commit | `apps/notification-service/src/rabbitmq/rabbitmq.consumer.ts` |
| Catalog → MinIO | `listing-images`, objets privés | Appels serveur S3 ; public uniquement via routes Catalog après approbation | `listing-images.service.ts`, `infra/minio` |

**Note d'exposition :** en Docker Compose, des ports de services et le `/notifications/recent` de laboratoire sont mappés sur `127.0.0.1` ; en Kubernetes, les services métiers sont internes, hors exposition Ingress. Le header de service partagé et la présence de ports locaux ne constituent **pas** une défense de production ; des contrôles réseau, l'identité de workload et des règles d'exposition supplémentaires restent nécessaires.

## 7. Déploiements et observabilité — ce qui est effectivement démontré

```mermaid
flowchart TB
    DEV["Développeur : Compose ou Minikube"]
    GH["GitHub Actions : CI / tests / scans"]
    subgraph K8S["Minikube : namespace projet-indiv26"]
      ING["Ingress nginx : TLS app/api/auth .test"]
      WEB["Deployment Web"]
      GW["Deployment Gateway + HPA 1 à 4"]
      CAT["Deployment Catalog"]
      MAR["Deployment Marketplace"]
      NOT["Deployment Notification : 2 replicas"]
      LEG["Deployment Legacy"]
      KC["Deployment Keycloak"]
      INF["PostgreSQL / MinIO + PVC"]
      RMQ["RabbitMQ + PVC"]
      JOB["Jobs : 4 migrations Prisma + MinIO bootstrap"]
      PRO["Prometheus"]
      GRAF["Grafana"]
    end
    DEV --> K8S
    GH -.->|"vérifications CI kind jetables"| K8S
    ING --> WEB
    ING --> GW
    ING --> KC
    GW --> CAT
    GW --> MAR
    GW --> LEG
    MAR --> RMQ
    RMQ --> NOT
    CAT --> INF
    MAR --> INF
    NOT --> INF
    JOB --> INF
    PRO -->|"metrics Gateway et services"| GW
    GRAF -->|"datasource Prometheus"| PRO
```

- **Compose :** services HTTP en ports locaux (`3000` Gateway, `3001` Web, `3099` Legacy, `3101` Catalog, `3102` Marketplace, `3103` Notification`), Keycloak `8081`, MinIO `9000`, RabbitMQ et PostgreSQL. Dépendances de démarrage et checks santé dans `compose.yaml` ; migrations `legacy/catalog/marketplace/notification` et init MinIO.
- **Kubernetes :** `infra/k8s/minikube/kustomization.yaml`, Services ClusterIP, probes startup/liveness/readiness, requests/limits, Secrets générés hors dépôt, PostgreSQL/RabbitMQ/MinIO persistants, 4 Jobs Prisma. L'Ingress expose `app.projet-indiv26.test`, `api.projet-indiv26.test` et `auth.projet-indiv26.test` via TLS de **labo**, non un certificat public de production.
- **Observabilité :** Prometheus/Grafana, `/api/metrics` et probes santé, JMeter et HPA de Gateway (CPU 60 %, 1–4 pods). Le `/api/health/ready` est agrégé pour diagnostic, alors que la readiness Kubernetes du Gateway utilise `/api/health/live`, par choix d'isolation.
- **Dans cette topologie, les événements passent exclusivement de Marketplace vers Notification par le broker RabbitMQ**, sans lien HTTP applicatif direct. Voir les séquences et les limites de la livraison aux sections 3, 4 et 8.

## 8. Risques et écarts POC / production — à annoncer au jury

| Risque / écart | Statut effectivement constaté | Ce que M10 ne prétend pas |
| --- | --- | --- |
| Outbox partielle | Outbox transactionnelle sur `proposal.rejected` uniquement ; autres événements publiés après commit | Pas d'exactly-once ni d'outbox universelle |
| Cohérence distribuée | Réservations séquentielles, compensation `release` best effort ; clôture des annonces séquentielle | Pas de saga persistée / 2PC / reprise automatique complète |
| Legacy | `/api/auth*` reste routé au monolithe historique | Pas de suppression complète du monolithe |
| Isolation réseau | Pas de NetworkPolicy appliquée dans `infra/k8s/minikube` ; token partagé interservices | Pas de service mesh ou mTLS applicatif |
| Protection contre surcharge | HPA sur Gateway, protections ponctuelles, pas de rate limiter distribué démontré | Pas de quota global multi-replica certifié |
| Stockage / identité | PostgreSQL/MinIO/RabbitMQ PVC de labo ; Keycloak en `start-dev` (Compose et manifest Minikube) | Pas de HA multi-zone, sauvegarde automatique ni Keycloak prod durci |
| Accès et secrets | Secrets hors versionnage pour K8s ; Compose contient des identifiants explicitement **locaux** | Ne jamais réutiliser ces secrets en production |
| Observabilité | Monitoring de labo avec Prometheus/Grafana, expérimentations JMeter | Les mesures du sandbox ne sont pas un SLO de production |
| Frontend | Fonctionnel avec couverture Chrome ; refonte UX à venir **uniquement après GO** | M10 ne lance aucune amélioration frontend |

## 9. Vérification, preuves et séquence des prochains chantiers

**Sources de vérité** : `apps/gateway/src/routes.ts` ; `apps/marketplace-service/src/proposals/proposals.service.ts`, `transactions/transactions.service.ts`, `events/outbox.worker.ts` ; `apps/catalog-service/src/internal/internal-listings.controller.ts` ; `apps/notification-service/src/rabbitmq/rabbitmq.consumer.ts` ; les trois `prisma/schema.prisma` ; `compose.yaml` et `infra/k8s/minikube`.

**Certifications précédentes** :
- [PR #61 — LOT 9B-F](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/pull/61) (merge `53fb2df`) : [Bootstrap #38313602241](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/actions/runs/38313602241) et [E2E Chrome #38313602213](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/actions/runs/38313602213), revus sur HEAD `7e346cd`.
- [Guide M7 Kubernetes](20-m7-kubernetes-microservices.md), [M8 intégration](21-m8-microservices-contracts-e2e.md), [M9 DON/TROC](22-m9-donation-trade-workflows.md), [LOT 9B-F navigateur](23-lot9bf-certification.md).

**Ordre acté par le propriétaire :** ① terminer/revoir M10 ; ② **développement frontend après GO explicite** ; ③ seulement ensuite consolider les preuves LOT 10-A (#58) ; ④ préparer présentation/répétition/vidéo LOT 10-B (#59). **Aucune action M10 n'autorise le début du chantier frontend.**

Le guide opérationnel associé est [`25-m10-operations-limits.md`](25-m10-operations-limits.md). Les schémas précédents sont des fichiers Markdown avec blocs `mermaid` : ils sont affichés par GitHub et éditables dans la PR.
