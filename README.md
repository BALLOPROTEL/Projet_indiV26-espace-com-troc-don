# Projet_individuel26 — Espace communautaire de troc & don

Projet individuel pour le bloc **« Superviser et assurer le développement des applications logicielles »**. Le POC de *La Petite Maison de l'Épouvante* démontre une véritable verticale métier DON/TROC avec modération, transactions et exigences d'industrialisation.

> **État au 18 novembre 2026 :** migration microservices M0–M10, frontend V2/V3/V4 et LOT 9B sont terminés. La recette jury finale a été exécutée avec succès sur 4 acteurs, 4 annonces et 20 médias réels ; #56 et #35 sont fermés. La dette CI ECR #80 est également fermée. La seule gate avant LOT 10 est désormais la **recette physique/accessibilité #71** (iPhone/Safari, Android/Chrome, zoom 200 %, clavier/contrastes/reduced-motion et réseau dégradé). Le POC n'est pas un service de production et n'a pas de déploiement public permanent certifié.

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
| LOT 9B-F | **TERMINÉ** — kit jury + recette finale Chrome réelle + preuves versionnées (#129/#130). #56/#35 fermés |
| M10 | **Terminé et fusionné** (#57) — 6 schémas Mermaid, routes, sécurité, limites et runbook |
| Frontend V2 — F0–F5 | **Terminé et fusionné** — accueil 6 annonces/page, galerie MinIO, dashboard modérateur, API ADMIN et dashboard ADMIN (PR #72–#77) |
| Frontend V2/V3/V4 | **Code fusionné + validation desktop propriétaire acquise** — accueil, galerie, espace membre, modération, ADMIN, Keycloak et parcours UX V4. Recette physique/accessibilité encore requise (#71) |
| F6 (facultatif) | **Backlog non bloquant** — nouvelles fonctions sans contrats backend livrés (#70) |
| LOT 10-A/B | **Backlog bloqué par #71** — lancer #58 puis #59 après la recette physique/accessibilité |

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

1. **[#71 — recette physique/accessibilité](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/71)** : terminer les contrôles physiques/manuels (iPhone/Safari, Android/Chrome, zoom navigateur 200 %, clavier + contrastes + `prefers-reduced-motion`, réseau dégradé). La PR #134 ajoute des preuves Chrome supplémentaires pour reduced-motion, Slow 3G et un proxy de mise en page équivalent zoom.
2. **[#55 — GitHub Projects V2](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/55)** : seul le déplacement visuel des cartes reste manuel ; branches et PR sont nettoyées.
3. **[#58 — LOT 10-A](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/58)** : dossier de preuves après fermeture de #71.
4. **[#59 — LOT 10-B](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/59)** : support 20 min, répétition chronométrée et vidéo de secours après #58.
5. **Post-MVP :** #70 et l'Epic #110 avec #111–#115 restent en Backlog et ne bloquent pas le jury.

LOT 9B (#35/#56), le bug Keycloak #98 et la dette CI #80 sont fermés. Le tag `baseline-2026-10-19` reste le snapshot historique. Aucune Release finale n'est publiée tant que #71 n'est pas close.
**Règle de travail :** issue → branche → CI → revue Codex → **accord explicite du propriétaire** → fusion manuelle. Ne jamais activer l'auto-merge. Après lancement de CI, transmettre immédiatement les liens et laisser la conversation disponible ; reprendre le suivi à la demande. Ne jamais nettoyer les volumes Codespaces sans autorisation explicite.
