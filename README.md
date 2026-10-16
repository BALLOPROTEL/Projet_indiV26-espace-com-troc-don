# Projet_individuel26 — Espace communautaire de troc & don

Projet individuel pour le bloc **« Superviser et assurer le développement des applications logicielles »**. Le POC de *La Petite Maison de l'Épouvante* démontre une véritable verticale métier DON/TROC avec modération, transactions et exigences d'industrialisation.

> **État au 13 octobre 2026 : M9 et certification métier LOT 9B-F fusionnés dans `main` (PR #54 et #61). M10 : documentation d'architecture en revue (issue #57).** Les données de démonstration jury restent à préparer ; le frontend n'est pas lancé en l'absence du GO spécifique. Le POC n'est pas un service de production et n'a pas de déploiement public permanent certifié.

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

Voir [**M10 : architecture finale et six diagrammes Mermaid**](docs/24-m10-architecture-finale.md), [exploitation et limites M10](docs/25-m10-operations-limits.md), [architecture historique](docs/01-architecture.md), [migration](docs/18-microservices-migration.md), [Kubernetes](docs/20-m7-kubernetes-microservices.md) et [workflows M9](docs/22-m9-donation-trade-workflows.md).

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

## État des lots (16 octobre 2026)

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
| LOT 9B-F | **Certification technique fusionnée** — 3 annonces, 15 images réelles, modération privée et DON/TROC Chrome. Kit de données jury restant (#56) |
| M10 | **Terminé et fusionné** (#57) — 6 schémas Mermaid, routes, sécurité, limites et runbook |
| Frontend V2 — F0–F5 | **Terminé et fusionné** — accueil 6 annonces/page, galerie MinIO, dashboard modérateur, API ADMIN et dashboard ADMIN (PR #72–#77) |
| Frontend V2 — F7 | **Code et qualité fusionnés** — skills Emil Kowalski et ergonomie mobile, états sans photo (PR #78, #79, #82). Recette sur vrais appareils encore requise (#71) |
| F6 (facultatif) | **Backlog non bloquant** — nouvelles fonctions sans contrats backend livrés (#70) |
| LOT 10-A/B | **En attente** — preuves et soutenance uniquement après la phase frontend autorisée |

Piloter les travaux via les [issues #35](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/35), [#44](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/44), [#18](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/18), et les tâches [#55 à #59](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues?q=is%3Aissue+is%3Aopen).

## Preuves récentes vérifiées

- M9 fusionné dans `main` : [PR #54](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/pull/54) ; commit de merge [`d29d499`](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/commit/d29d4997c70f10594fc137f66361fbc46698b269).
- Sur le dernier HEAD M9 `7a5e353` : [Bootstrap CI](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/actions/runs/38090618276), [Contrats](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/actions/runs/38090618272), [E2E Chrome](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/actions/runs/38090618298) et [Web](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/actions/runs/38090618285) : **4/4 SUCCESS**.
- Sur `main` après fusion : [Bootstrap CI #38091686672](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/actions/runs/38091686672) **SUCCESS**, y compris tests, Compose, Kubernetes kind, Trivy et publication GHCR.
- [PR #61](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/pull/61) : [Bootstrap #38313602241](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/actions/runs/38313602241) et [E2E Chrome #38313602213](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/actions/runs/38313602213) SUCCESS sur le dernier HEAD revu par Codex. Les 35 captures M9/9B-F sont archivées indépendamment dans la bibliothèque privée ChatGPT. Les anciennes preuves M9 (16 PNG) le sont aussi.

## Qualité, performance et limites

Le seuil de couverture métier, les validations lint/typecheck et les gates de sécurité sont exécutés en CI. La mesure de laboratoire M7 a observé un **p95 de 399 ms**, environ **0,067 % d'erreurs** et un HPA Gateway **1→4 réplicas** ; ce ne sont pas des garanties de production.

Risques résiduels documentés : absence de NetworkPolicy Kubernetes et de rate limiting distribué, images tierces pas toutes épinglées par digest, fallback legacy encore présent, effets externes SMS/e-mail non garantis exactly-once. Pas de paiement réel, de chat complet ni de certification RGAA exhaustive.

## Suite du projet — 16 octobre 2026

1. **Frontend V2 code intégré :** F0–F5 et F7 ont été fusionnés, notamment [#79](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/pull/79) et [#82](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/pull/82). La recette physique iPhone/Android, clavier et zoom à 200 % reste à réaliser dans [#71](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/71).
2. **[#56 — LOT 9B-F](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/56)** : constituer le kit de démonstration jury, avec données réinitialisables et scénario métier DON/TROC complet ; l'E2E technique existant n'est pas ce kit.
3. **[#55 — pilotage](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/55)** : synchroniser visuellement les colonnes du GitHub Projects V2 ; la présente documentation ne change pas ces colonnes.
4. **[#58 — LOT 10-A](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/58)** : dossier de preuves, après la recette frontend et le kit de démonstration.
5. **[#59 — LOT 10-B](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/59)** : support de soutenance et vidéo de secours.

Le POC n'est pas une plateforme haute disponibilité certifiée. La fiabilité des pulls ECR Public dans Actions reste suivie dans [#80](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/80).

**Règle de travail :** issue → branche → CI → revue Codex → approbation → fusion. Après lancement de CI, transmettre immédiatement les liens et laisser la conversation disponible ; reprendre le suivi à la demande. Ne jamais nettoyer les volumes Codespaces sans autorisation explicite.
