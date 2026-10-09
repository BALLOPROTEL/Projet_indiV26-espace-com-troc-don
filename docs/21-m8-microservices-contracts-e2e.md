# M8 — Contrats, intégration, E2E et sécurité microservices

> Issue #44. Branche `test/44-m8-microservices-contracts-e2e`.
> Après fusion M7 (PR #52), sans déploiement supplémentaire du Codespace saturé.

## Objectif / Definition of Done

Certifier que l'architecture microservices fonctionne **comme un système** et
pas seulement comme des processus démarrant chacun séparément.

La clôture de M8 exige :

1. **Contrats HTTP** : Gateway conserve les routes publiques `/api/*`, leurs
   chemins/query strings, JWT et réponses binaires/multipart. Les endpoints
   internes du Catalog et la Notification privée ne sont pas exposés.
2. **Contrat synchrone** : Marketplace ↔ Catalog couvre snapshot, réserve,
   complete, release, erreurs de statut 404/409 et authentification interne.
3. **Contrat asynchrone** : Publisher Marketplace → RabbitMQ → Notification,
   enveloppe versionnée `eventId,type,version,occurredAt,source,data`,
   comportements duplicate/retry, et trois événements réellement émis.
4. **E2E métier** : DON et TROC, création → proposition → acceptation →
   réservation → deux confirmations → COMPLETED, compensations et échecs.
5. **Sécurité** : authentification Keycloak/JWT, rôles et ownership, token
   inter-service, absence d'accès cross-service non autorisé, cas négatifs.
6. **CI et preuves** : tests reproductibles, journaux et critères d'acceptation
   traçables. Pas de validation fondée uniquement sur des recherches statiques.

## M8-A — Première gate de compatibilité (en cours)

Exécution locale ou CI :

```bash
pnpm m8:contracts:validate
```

Cette commande compile le routeur Gateway existant puis lance
`tests/contracts/m8-contracts.test.mjs` avec le runner natif de Node 24.
Elle vérifie :
- comportement **exécuté** du routage public Gateway ;
- préservation des paramètres de requête ;
- non-exposition des chemins internes ;
- signatures de routes internes Catalog et token inter-service ;
- contrôleurs Marketplace protégés JWT ;
- contrat d'enveloppe RabbitMQ / publisher confirm ;
- Ingress `app.* /api` dirigé directement vers Gateway.

Une CI ciblée `.github/workflows/m8-contracts.yml` exécute cette gate en
pull request. Il s'agit d'une **première régression de compatibilité**, pas
d'une certification de bout en bout du comportement réseau, des données,
des rôles ou des transactions.

## M8-A.2 — Contrat HTTP Marketplace → Catalog (en cours)

Les tests de l'implémentation réelle `CatalogClientService`, avec `fetch`
simulé et assertions sur les requêtes, sont dans
`apps/marketplace-service/src/catalog/catalog-client.service.spec.ts`.

```bash
pnpm m8:integration:unit
```

Ils valident l'authentification interne, l'encodage des IDs, les appels
GET/POST snapshot/reserve/complete/release, la correspondance 404/409,
les erreurs upstream 5xx, une réponse mal formée et une panne réseau.
Ce sont des **tests de contrat du client exécuté avec transport mocké**,
non un test réseau complet impliquant PostgreSQL, Keycloak ou RabbitMQ.

## M8-B — Intégration réelle multi-services : VALIDÉE pour DON

CI GitHub Actions : **M8-B Real Microservice Integration #37993733843**
— **SUCCESS** sur le commit `c13ab4a` (9 octobre 2026).

- Script : `scripts/m8-compose-integration.mjs`, appelé par
  `M8_RUN_INTEGRATION=true bash scripts/m6-compose-smoke.sh`.
- Stack Compose projet `projet-indiv26-m6-ci` **jetable** : Gateway, Legacy,
  Catalog, Marketplace, Notification, PostgreSQL (migrations réelles),
  RabbitMQ, MinIO et Keycloak (vrais JWT), nettoyée avec `down -v`.
- Récupération de deux JWT Keycloak distincts, audience `api` ;
  `GET /api/proposals/me` sans JWT `401`, fallback legacy `401`,
  routes Catalog internes et Notification invisibles derrière Gateway `404`.
- Deux annonces APPROVED/DONATION insérées dans **la base Catalog jetable**
  pour isoler les contrats inter-services des règles de publication/images
  (il ne s'agit pas d'un test complet du processus de modération).
- `Catalog /internal/listings/:id` refuse l'accès sans token `401`,
  accepte le token inter-service ; `404` si absent, `409` sur
  état non compatible ; `reserve → release` rétablit AVAILABLE.
- Appel HTTP authentifié **Gateway → Marketplace → Catalog** :
  demande DON `PENDING`, interdiction d'acceptation par le demandeur
  (`403`), acceptation par le propriétaire, réservation Catalog,
  confirmations par deux personnes différentes, état `COMPLETED` dans
  Marketplace **et** Catalog.
- Consommation réelle **Marketplace → RabbitMQ → Notification** :
  trois événements (`proposal.created`, `proposal.accepted`,
  `transaction.completed`) corrélés par `targetListingId`, avec
  trois `eventId` uniques et enveloppe de version 1.

**Preuve :** le job `Real HTTP + JWT + Catalog + RabbitMQ M8-B` finit
par `[M8-B] M8-B integration: PASS`.

**Limites :** la CI valide le parcours DON, pas encore le TROC, les
uploads volumineux de bout en bout, les interruptions/reconnexions,
ni le rejeu RabbitMQ d'un même `eventId`. Les tests de mappage des pannes
réseau Catalog (mock transport) restent couverts par M8-A.2 ; l'échec réel
et les scenarios de résilience restent à certifier M8-C.

Le runner GitHub a initialement subi des erreurs d'accès/rate-limit Docker
Hub (sans lancement des tests métier). Pour la CI dédiée, les images de
base Node, Alpine, PostgreSQL et RabbitMQ sont préchargées depuis un miroir
public ECR ; aucun changement n'est requis dans le Compose de développement.


## M8-C — E2E, sécurité et résilience : PASS (environnement Compose jetable)

**Preuve GitHub Actions :** [M8 Real Microservice E2E Integration #37995054517](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/actions/runs/37995054517) — **SUCCESS** sur commit `8f14b77`, 9 octobre 2026.

Les journaux confirment successivement `Real TROC E2E ... PASS`,
`TROC RabbitMQ 3 unique actual notifications: PASS`,
`RabbitMQ real duplicate ... records once: PASS`,
`Notification outage ... recovery: PASS`,
`Catalog outage ... recovery: PASS` et
`Keycloak container restart ... preserved: PASS`.

Tous ces tests ont été exécutés avec un véritable cluster de services
Docker Compose, PostgreSQL, RabbitMQ et Keycloak, et non de simples
mocks HTTP. Le scénario M8-B DON repasse également en PASS dans la même CI.

Scripts : `scripts/m8-compose-e2e.mjs` lancé après M8-B par
`M8_RUN_INTEGRATION=true M8_RUN_E2E=true bash scripts/m6-compose-smoke.sh`.
L'environnement est strictement le projet Compose jetable
`projet-indiv26-m6-ci`, avec cleanup `down -v` ; ce test ne doit jamais
être exécuté contre le cluster de démonstration Minikube M7.

Vérifications **certifiées par GitHub Actions** :

- Parcours **TROC** entre deux utilisateurs Keycloak distincts et un
  troisième utilisateur non participant ; deux annonces approuvées
  appartenant à deux propriétaires différents sont injectées dans la
  base Catalog *isolée* (la modération/les images ne sont pas couvertes).
- `TRADE_OFFER` PENDING → 2 réservations Catalog → 2 confirmations par
  des participants distincts → transaction `COMPLETED` et deux
  disponibilités `COMPLETED`, avec refus de re-confirmer.
- Authentification JWT absente/invalide, tentative de proposition sur
  sa propre annonce, mauvaise opération, annonce offerte non possédée,
  acceptation/confirmation par une tierce personne : vrais statuts HTTP
  400/401/403/409 contrôlés.
- Publication d'un **même `eventId` deux fois sur le vrai exchange
  RabbitMQ**, avec vérification d'un seul enregistrement Notification
  pendant la durée de vie d'un même processus.
- Arrêt de Notification, publication d'un message persistant pendant
  l'arrêt, redémarrage Notification et constat de livraison.
- Arrêt de Catalog : demande de don renvoyant 502 ; reprise de Catalog :
  demande authentifiée acceptée à nouveau.
- Redémarrage du conteneur Keycloak et contrôle d'une authentification
  renouvelée avec `sub` identique, puis requête JWT acceptée.

**M8-D — Déduplication persistante et multi-réplicas (nouvelle validation) :**

- `NotificationStore` enregistre chaque enveloppe en PostgreSQL, schema
  `notification`, table `notification_events`, clé primaire **`eventId`**.
  `createMany({ skipDuplicates: true })` rend l'insertion atomique entre
  réplicas et un rejeu de messages historiques inoffensif ;
- le consommateur n'ACK qu'après commit PostgreSQL. Sur panne de stockage,
  il NACK avec `requeue=true`; les enveloppes incorrectes sont rejetées
  sans réitération indéfinie ;
- l'API `/notifications/recent` ne retourne que les **50 derniers événements**,
  mais la table ne supprime pas les anciens identifiants : l'anti-doublon
  ne dépend plus de cette limite d'affichage ;
- le nouveau job Prisma `notification-migrate` s'exécute avant Notification
  dans Docker Compose et dans les manifests Kubernetes. La base est isolée
  des schémas `public`, `catalog` et `marketplace` ;
- les images Notification `m8-local` sont distinctes de l'ancien tag M7
  pour empêcher la réutilisation silencieuse d'un binaire obsolète ;
- les manifests Kubernetes déclarent **2 réplicas**, avec readiness
  RabbitMQ **et PostgreSQL**. Le nouveau validateur réclame 2/2 Ready et
  la présence de la table persistante.

**Tests réels :** [CI GitHub Actions #37997755295](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/actions/runs/37997755295)
— SUCCESS : `Durable eventId dedup survives Notification container
restart: PASS` et `Two live Notification replicas see shared inbox and
exactly one eventId: PASS`. Les validations de compilation/tests unitaires
Notification tournent en plus dans la CI de contrats M8.

**Limites explicites :** cette inbox empêche l'insertion doublon,
mais ne garantit pas « exactly once » pour d'éventuels effets externes
(SMS/e-mail) futurs : ceux-ci devront être pilotés par des jobs avec
états/outbox et clés d'idempotence dédiées. Les identifiants sont
conservés sans purge automatique afin d'éviter les rejouages tardifs ;
prévoir une politique d'archivage, de capacité et de surveillance PostgreSQL
avant charge production.

**Déploiement M7 préexistant :** les nouveaux manifests Kubernetes n'ont
pas été appliqués au cluster Codespaces déjà en fonctionnement. Son disque
étant contraint, ne pas reconstruire/charger les images `m8-local` ni
redéployer avant d'avoir vérifié l'espace disponible et préparé un plan
de restauration. La preuve **multi-réplicas live** est celle de la stack
Compose jetable GitHub Actions, pas encore un rollout du cluster M7. Le scénario de reprise RabbitMQ vérifie la
livraison d'un événement en attente, pas exactement-once à travers une
panne réseau simultanée. Le redémarrage Keycloak Compose ne prouve pas
la recréation intégrale d'un pod Kubernetes : cette dernière a déjà été
validée dans M7 avec PostgreSQL persistant. Ni montée en charge M8-C,
ni uploads binaires volumineux ne sont inclus dans ces vérifications.

M8-C est **PASS** pour les parcours et pannes listés ci-dessus. Le test de déduplication n'est pas durable entre redémarrages et le périmètre ne comprend pas la validation binaire volumineuse en bout de chaîne.

## Environnement et prudence disque

Le dernier test de charge M7 avait saturé le Codespace (93 %), puis le
nettoyage ciblé a ramené le disponible à ~3,7 Go. Les gates légères
`m8:contracts:validate` tournent en CI GitHub sans reconstruire 12 images.
Les E2E seront validés dans un environnement **jetable** disposant d'un
stockage suffisant. Ne pas détruire les PVC Minikube de M7 pour M8.

## Règle de progression

M8-A ne vaut **pas** M8 DONE. Chaque sous-étape sera mise à jour dans
l'issue #44 après preuve GitHub Actions ou logs de tests live. Fusionner M8
dans `main` seulement après les gates prévues et une validation explicite.
