# Projet_individuel26 — Espace communautaire de troc & don

Projet individuel pour le bloc **« Superviser et assurer le développement des applications logicielles »**. Le POC de *La Petite Maison de l'Épouvante* démontre une véritable verticale métier DON/TROC avec modération, transactions et exigences d'industrialisation.

> **État au 18 novembre 2026 :** migration microservices M0–M10, frontend V2/V3/V4 et kit de démonstration jury fusionnés dans `main`. Le kit jury contient 20 médias autorisés, 20 crédits de provenance et `READY_FOR_REVIEW` (#56). La validation propriétaire desktop VISITEUR/USER/MODERATOR/ADMIN est acquise ; restent la **recette métier live finale du dataset jury** (#56/#35) et la **recette physique/accessibilité** sur iOS/Android ou appareils équivalents (#71). Le POC n'est pas un service de production et n'a pas de déploiement public permanent certifié.

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

## État des lots (18 novembre 2026)

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
| LOT 9B-F | **Kit jury READY_FOR_REVIEW** — certification technique + 20 médias autorisés/provenance + runbook fusionnés (#125/#126/#127). Recette métier live finale à consigner (#56/#35) |
| M10 | **Terminé et fusionné** (#57) — 6 schémas Mermaid, routes, sécurité, limites et runbook |
| Frontend V2 — F0–F5 | **Terminé et fusionné** — accueil 6 annonces/page, galerie MinIO, dashboard modérateur, API ADMIN et dashboard ADMIN (PR #72–#77) |
| Frontend V2/V3/V4 | **Code fusionné + validation desktop propriétaire acquise** — accueil, galerie, espace membre, modération, ADMIN, Keycloak et parcours UX V4. Recette physique/accessibilité encore requise (#71) |
| F6 (facultatif) | **Backlog non bloquant** — nouvelles fonctions sans contrats backend livrés (#70) |
| LOT 10-A/B | **Backlog** — lancer #58 puis #59 après la recette métier live #56/#35 et la recette physique #71 |

Piloter les travaux via les [issues #35](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/35), [#44](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/44), [#18](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/18), et les tâches [#55](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/55), [#56](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/56), [#57](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/57), [#58](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/58) et [#59](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/59).

## Preuves récentes vérifiées

- M9 fusionné dans `main` : [PR #54](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/pull/54) ; commit de merge [`d29d499`](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/commit/d29d4997c70f10594fc137f66361fbc46698b269).
- Sur le dernier HEAD M9 `7a5e353` : [Bootstrap CI](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/actions/runs/38090618276), [Contrats](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/actions/runs/38090618272), [E2E Chrome](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/actions/runs/38090618298) et [Web](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/actions/runs/38090618285) : **4/4 SUCCESS**.
- Sur `main` après fusion : [Bootstrap CI #38091686672](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/actions/runs/38091686672) **SUCCESS**, y compris tests, Compose, Kubernetes kind, Trivy et publication GHCR.
- [PR #61](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/pull/61) : [Bootstrap #38313602241](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/actions/runs/38313602241) et [E2E Chrome #38313602213](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/actions/runs/38313602213) SUCCESS sur le dernier HEAD revu par Codex. Les 35 captures M9/9B-F sont archivées indépendamment dans la bibliothèque privée ChatGPT. Les anciennes preuves M9 (16 PNG) le sont aussi.
- Kit jury final : PR #125 (provenance), #126 (20 médias autorisés + `READY_FOR_REVIEW`) et #127 (compte rendu/runbook) fusionnées les 18/11 ; Jury offline #52, Bootstrap #545/#546/#547 et Codex des HEAD correspondants réussis.

## Qualité, performance et limites

Le seuil de couverture métier, les validations lint/typecheck et les gates de sécurité sont exécutés en CI. La mesure de laboratoire M7 a observé un **p95 de 399 ms**, environ **0,067 % d'erreurs** et un HPA Gateway **1→4 réplicas** ; ce ne sont pas des garanties de production.

Risques résiduels documentés : absence de NetworkPolicy Kubernetes et de rate limiting distribué, images tierces pas toutes épinglées par digest, fallback legacy encore présent, effets externes SMS/e-mail non garantis exactly-once. Pas de paiement réel, de chat complet ni de certification RGAA exhaustive.

## Suite du projet — 18 novembre 2026

1. **[#56 / #35 — validation métier finale jury](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/56)** : exécuter le dataset final dans le navigateur (publication/modération, DON refusé, DON accepté + double confirmation, TROC + double confirmation, RBAC/ADMIN) et consigner les preuves.
2. **[#71 — recette physique/accessibilité](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/71)** : iPhone/Android ou équivalents physiques, zoom 200 %, clavier/focus/contrastes, clavier virtuel et réseau dégradé.
3. **[#55 — hygiène GitHub/Kanban](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/55)** : Project V2 natif à synchroniser dès qu'une connexion autorise ses champs ; branches obsolètes restantes à supprimer. Audit courant : [docs/31-audit-github-2026-11-18.md](docs/31-audit-github-2026-11-18.md).
4. **[#80 — fiabilité ECR Public](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/80)** : correctif #100 à rafraîchir depuis le `main` courant avant nouvelle validation et éventuelle fusion.
5. **[#58 — LOT 10-A](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/58)** : dossier de preuves après les recettes finales.
6. **[#59 — LOT 10-B](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/59)** : support 20 min, répétition chronométrée et vidéo de secours.
7. **Post-MVP :** #70 et l'Epic #110 avec #111–#115 restent en Backlog et ne bloquent pas le jury.

Le seul tag de snapshot actuel est `baseline-2026-10-19`. Aucune Release GitHub n'est publiée : c'est volontaire tant que les gates finales #56/#71 ne sont pas closes.
**Règle de travail :** issue → branche → CI → revue Codex → **accord explicite du propriétaire** → fusion manuelle. Ne jamais activer l'auto-merge. Après lancement de CI, transmettre immédiatement les liens et laisser la conversation disponible ; reprendre le suivi à la demande. Ne jamais nettoyer les volumes Codespaces sans autorisation explicite.
