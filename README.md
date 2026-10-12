# Projet_individuel26 — Espace communautaire de troc & don

Projet individuel pour le bloc **« Superviser et assurer le développement des applications logicielles »**. Le POC de *La Petite Maison de l'Épouvante* démontre une véritable verticale métier DON/TROC avec modération, transactions et exigences d'industrialisation.

> **État vérifié au 12 octobre 2026 : M9 fusionné dans `main` (PR #54, merge `d29d499`) ; LOT 9B-F et M10/LOT 10 encore à livrer.** Le POC n'est pas un service de production et n'a pas de déploiement public permanent certifié.

## Fonctionnalités livrées

- Authentification Keycloak / OIDC (Authorization Code + PKCE) et rôles `USER`, `MODERATOR`, `ADMIN`.
- Création d'annonces DON/TROC ; galerie MinIO (5 à 8 images) ; au moins 5 souhaits pour le TROC ; validation des fichiers.
- Modération `PENDING / APPROVED / REJECTED` distincte de la disponibilité `AVAILABLE / RESERVED / COMPLETED`.
- Visiteur : consultation des annonces approuvées. Membre : demandes envoyées/reçues, choix de sa contrepartie TROC, comparaison et suivi.
- Propriétaire : acceptation/refus, réservation ; double confirmation des participants et clôture transactionnelle.
- Notification Service : événements RabbitMQ, stockage PostgreSQL et déduplication ; outbox transactionnelle sur les refus métier.
- Tests unitaires, intégration, contrats, E2E HTTP/JWT, navigateur Chrome + comptes Keycloak, audit de dépendances et Trivy.

## Architecture microservices en place

```text
Navigateur → Web (Next.js :3001) → API Gateway (:3000) → Catalog (:3101) → MinIO
                                                 ├→ Marketplace (:3102) → Catalog API interne
                                                 │                └→ RabbitMQ → Notification (:3103)
                                                 └→ Legacy API (:3099), fallback temporaire
Keycloak → OIDC/JWT                  PostgreSQL : ownerships public, catalog, marketplace, notification
```

- **Catalog Service** possède annonces, images, souhaits et modération ; Marketplace ne consulte ses objets que par API.
- **Marketplace Service** possède demandes/propositions, transactions et confirmations.
- **Notification Service** consomme RabbitMQ ; une inbox PostgreSQL et une clé `eventId` permettent de dédupliquer les réceptions.
- **Gateway** préserve les URLs publiques `/api/...` et les jetons JWT ; le fallback Legacy reste une dette Strangler documentée.
- **Docker Compose / Codespaces** et **Kubernetes kind/Minikube** ont des recettes et des tests CI ; observabilité Prometheus/Grafana et expérimentation JMeter/HPA.

Voir [architecture](docs/01-architecture.md), [migration](docs/18-microservices-migration.md), [Kubernetes](docs/20-m7-kubernetes-microservices.md) et [workflows M9](docs/22-m9-donation-trade-workflows.md).

## Démarrer le POC dans GitHub Codespaces

Depuis la racine du dépôt, en vérifiant l'espace disque **avant** tout build :

```bash
git status
df -h .
docker system df
pnpm codespaces:up
pnpm codespaces:check
```

Ouvrir le port `3001` via l'onglet **PORTS** ; Keycloak utilise le port `8081`. Pour les journaux : `pnpm codespaces:dev` ; pour arrêter sans supprimer les volumes : `pnpm codespaces:down`.

La CI utilise des environnements Docker/Kind jetables pour éviter de saturer le Codespace. **Ne pas effacer les PVC ni lancer de nettoyage destructeur automatiquement.** Voir [guide Codespaces](docs/18-codespaces.md).

## État des lots (12 octobre 2026)

| Lot / jalon | Résultat |
| --- | --- |
| LOT 0–5 | **Terminé** — gouvernance, API, Keycloak, catalogue, modération, qualité, supply-chain |
| LOT 6–6B | **Terminé** — Kubernetes, TLS, HPA et frontend Next.js |
| LOT 7–9 | **Terminé** — observabilité, JMeter, sécurité et corrections |
| LOT 9B-A/B/C | **Terminé** — règles métier, images MinIO, publication enrichie |
| M0–M4 | **Fusionné** — extraction Catalog/Marketplace et API Gateway |
| M5–M7 | **Fusionné** — RabbitMQ/Notification, Compose/Codespaces, Kubernetes multi-services |
| M8 | **Fusionné** — contrats, E2E microservices, pannes et notifications durables |
| M9 / LOT 9B-D/E | **Fusionné** — workflow DON/TROC et recette Chrome réelle, PR #54 |
| LOT 9B-F | **À finaliser** — certification transversale incluant de vraies galeries et données de démonstration |
| M10 / LOT 10 | **À préparer** — architecture finale, preuves, présentation et répétition jury |

Piloter les travaux via les [issues #35](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/35), [#44](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/44), [#18](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/18), et les tâches [#55 à #59](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues?q=is%3Aissue+is%3Aopen).

## Preuves récentes vérifiées

- M9 fusionné dans `main` : [PR #54](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/pull/54) ; commit de merge [`d29d499`](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/commit/d29d4997c70f10594fc137f66361fbc46698b269).
- Sur le dernier HEAD M9 `7a5e353` : [Bootstrap CI](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/actions/runs/38090618276), [Contrats](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/actions/runs/38090618272), [E2E Chrome](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/actions/runs/38090618298) et [Web](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/actions/runs/38090618285) : **4/4 SUCCESS**.
- Sur `main` après fusion : [Bootstrap CI #38091686672](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/actions/runs/38091686672) **SUCCESS**, y compris tests, Compose, Kubernetes kind, Trivy et publication GHCR.
- Les captures Chrome sont archivées 7 jours par GitHub Actions : les conserver durablement pour LOT 10.

## Qualité, performance et limites

Le seuil de couverture métier, les validations lint/typecheck et les gates de sécurité sont exécutés en CI. La mesure de laboratoire M7 a observé un **p95 de 399 ms**, environ **0,067 % d'erreurs** et un HPA Gateway **1→4 réplicas** ; ce ne sont pas des garanties de production.

Risques résiduels documentés : absence de NetworkPolicy Kubernetes et de rate limiting distribué, images tierces pas toutes épinglées par digest, fallback legacy encore présent, effets externes SMS/e-mail non garantis exactly-once. Pas de paiement réel, de chat complet ni de certification RGAA exhaustive.

## Prochain ordre de travail

1. [#55](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/55) — documentation/roadmap et pilotage.
2. [#56](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/56) — LOT 9B-F, recette complète et données.
3. [#57](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/57) — M10, documentation architecture finale.
4. [#58](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/58) — dossier de preuves jury.
5. [#59](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/59) — support 20 min, répétition et vidéo.

**Règle d'exécution :** ne pas prolonger les séances pour attendre les CI longues ; transmettre la PR et les liens de runs, puis vérifier leurs résultats sur demande. Une PR ne sera fusionnée qu'après les validations exigées et l'accord du propriétaire.
