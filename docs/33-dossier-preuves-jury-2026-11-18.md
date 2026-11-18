# Dossier de preuves techniques — état du 18 novembre 2026

## 1. Objet

Ce document centralise les preuves de la version réellement intégrée du projet **La Petite Maison de l’Épouvante**.

Il distingue :
- les éléments **livrés et prouvés** ;
- les preuves **automatisées** ;
- les validations **manuelles/physiques** qui restent encore à réaliser ;
- les dettes non bloquantes pour la soutenance.

Il ne remplace ni les diagrammes M10 ni le runbook jury : il sert de **table de traçabilité** pour la soutenance.

## 2. Référence Git

Référence au démarrage de ce dossier :

- `main` après PR #130 : `e995595101a1c8dc15c1741650d068ab5c1d5140`.
- PR #129 fusionnée : recette navigateur jury finale.
- PR #130 fusionnée : journal de preuve final versionné.
- Bootstrap post-fusion de #129 : #553 — **SUCCESS** sur `b17da30e01f4d96c393d37ff237f04bc26c1d3ad`.
- Bootstrap post-fusion de #130 : #556 — contrôle post-fusion lancé sur `e995595…` au moment de cette photographie du dossier.

## 3. Matrice de traçabilité

| Exigence / capacité | État | Référence code / PR | Preuve |
| --- | --- | --- | --- |
| Architecture microservices | **PASS** | M0–M10, docs 24/25, Epic #44 clôturée | Gateway + Catalog + Marketplace + Notification + Keycloak + RabbitMQ + PostgreSQL + MinIO documentés et testés |
| API Gateway / Strangler | **PASS** | M4 / PR #48 + correctifs | Routage public `/api`, JWT propagé, multipart/binaire, fallback legacy documenté |
| Catalogue / modération | **PASS** | Catalog Service | PENDING/APPROVED/REJECTED, ownership, API publique et privée |
| Stockage images MinIO | **PASS** | LOT 9B-B/C | validation MIME/taille/signature, galerie 5–8 images, contrôle d'accès |
| Workflow DON | **PASS** | M9 / #54 + #129 | demande, refus/acceptation, réservation, double confirmation, COMPLETED |
| Workflow TROC | **PASS** | M9 / #54 + #129 | contrepartie, comparaison, deux réservations, double confirmation, COMPLETED |
| RabbitMQ / Notification | **PASS** | M5 + M8 + #129 | événements persistés, déduplication par `eventId`, `proposal.rejected` unique |
| OIDC / Keycloak | **PASS** | LOT 2 + #99 + #129 | comptes réels de démo, JWT, rôles, login Chrome réel |
| RBAC USER/MODERATOR/ADMIN | **PASS** | M8, frontend F5, #129 | ADMIN positif ; USER refusé côté UI et API ADMIN HTTP 403 |
| Frontend V2/V3/V4 | **PASS desktop / Review physique** | #63/#85, UX V4 #105/#106 | validation propriétaire desktop ; #71 conserve les contrôles physiques |
| Champ mot de passe Keycloak | **PASS** | #99 ; issue #98 fermée | run jury final : desktop 1280, mobile 390/320, Tab/focus, forced-colors |
| Kit de données jury | **PASS** | #125/#126/#127 | 4 acteurs, 4 annonces, 20 médias autorisés, provenance et runbook |
| Recette finale jury | **PASS** | PR #129 | Jury final browser recette #2 / run `44333998288` |
| Journal de recette final | **PASS** | PR #130 | docs/27 + docs/28 mis à jour avec IDs et statuts réels |
| CI Bootstrap | **PASS sur version fonctionnelle certifiée** | #129 / main `b17da30e` | Bootstrap #552 PR + #553 post-fusion SUCCESS |
| Contrats / intégration microservices | **PASS** | M8 | contrats + intégration réelle Keycloak/Gateway/Marketplace/Catalog/RabbitMQ |
| Docker Compose | **PASS** | M6 | stack complète et smokes CI |
| Kubernetes | **PASS laboratoire** | M7 | 12 deployments, probes/resources, Minikube/kind, HPA |
| Performance / HPA | **PASS laboratoire** | M7/M8 | 35 962 requêtes, erreur 0,067 %, p95 399 ms, HPA Gateway 1→4 |
| Observabilité | **PASS laboratoire** | LOT 7 / M10 | Prometheus/Grafana, health/readiness et métriques documentés |
| Sécurité dépendances / image | **PASS gates actuelles** | Bootstrap | audit production HIGH/CRITICAL + Trivy HIGH/CRITICAL |
| Accessibilité / appareils physiques | **À FINALISER** | #71 / PR #132 | iPhone Safari, Android Chrome, zoom 200 %, clavier seul, réseau dégradé |
| Robustesse registre ECR | **EN COURS non bloquant** | #80 / PR #131 | fallback ECR Public → Docker Hub officiel en validation |

## 4. Preuve jury finale — LOT 9B-F

### Run

- PR : #129.
- HEAD certifié : `66fc61cb3bf8f498aaf4cd2a2c9cfd2b5fb4d155`.
- Fusion dans `main` : `b17da30e01f4d96c393d37ff237f04bc26c1d3ad`.
- Jury final browser recette #2 : run `44333998288` — **SUCCESS**.
- M8 Real Microservice E2E #199 : **SUCCESS**.
- Bootstrap #552 : **SUCCESS**.
- Bootstrap post-fusion #553 : **SUCCESS**.
- Codex final : finding RBAC backend corrigé puis revue clean.

### Artifact

Artifact GitHub : `14441750513`.

Contenu :
- captures de publication ;
- galeries privées de modération ;
- comparaison TROC ;
- parcours demandeur/propriétaire ;
- dashboard ADMIN ;
- refus USER ADMIN ;
- rapport `jury-final-report.json`.

L'artifact GitHub a une rétention limitée : il doit être exporté avec le dossier final avant expiration.

### Résultats

- 4 acteurs distincts : propriétaire, demandeur, modérateur, administrateur.
- 4 annonces.
- 20 médias autorisés.
- 20/20 fichiers uploadés par le navigateur et vérifiés byte-à-byte après publication.
- DON refusé : proposition `REJECTED`, annonce `AVAILABLE`.
- DON accepté : transaction et annonce `COMPLETED`.
- TROC : transaction `COMPLETED`, cible et contrepartie `COMPLETED`.
- Notification `proposal.rejected` persistée une seule fois.
- ADMIN : accès autorisé.
- USER : refus API ADMIN HTTP 403.

Les IDs réels du run sont consignés dans `docs/28-jury-parcours-operateur.md`.

## 5. Sécurité et qualité

Les gates du dépôt incluent notamment :

- lint, typecheck, tests unitaires ;
- tests PostgreSQL d'intégration ;
- E2E HTTP ;
- couverture API ;
- tests Gateway, Catalog, Marketplace et Notification ;
- smokes RabbitMQ / Gateway ;
- Docker Compose M6 ;
- Kubernetes M7 ;
- audit `pnpm --prod` avec gate HIGH/CRITICAL ;
- Trivy HIGH/CRITICAL ;
- revue Codex sur les PR sensibles.

### Dette #80

L'échec potentiel ECR Public intervient avant checkout lorsque les images de `jobs.services` sont throttled. PR #131 remplace l'ancienne #100 et déplace PostgreSQL/RabbitMQ après checkout avec retry/fallback officiel.

Cette dette est **CI/fiabilité** et ne remet pas en cause la recette métier #129 déjà réussie.

## 6. Architecture et limites assumées

Voir :
- `docs/24-m10-architecture-finale.md` ;
- `docs/25-m10-operations-limits.md`.

Limites à présenter honnêtement au jury :
- fallback Legacy encore présent dans la stratégie Strangler ;
- PostgreSQL de laboratoire partagé physiquement mais ownership logique séparé ;
- outbox partielle selon les domaines ;
- environnement Keycloak de démonstration ;
- durcissements production supplémentaires nécessaires avant exposition publique durable.

## 7. Frontend et accessibilité

### Déjà automatisé / prouvé

- desktop + mobile Chrome 320/390 ;
- touch emulation et cibles tactiles >=44 px ;
- absence d'overflow sur écrans clés ;
- galerie 5 photos ;
- Keycloak desktop/mobile ;
- Tab / focus-visible ;
- forced-colors / High Contrast ;
- rôles et RBAC ;
- validation propriétaire desktop VISITEUR / USER / MODERATOR / ADMIN.

### Encore manuel

Le protocole #71 est versionné dans PR #132 / `docs/32-recette-physique-accessibilite-2026-11-18.md`.

Restent :
1. iPhone / Safari ;
2. Android / Chrome ;
3. zoom navigateur 200 % ;
4. clavier seul ;
5. réseau dégradé.

Le dossier #58 ne doit pas être déclaré final avant PASS de ces cinq lignes ou correction des anomalies détectées.

## 8. Archives existantes

Archives historiques documentées dans #58 :
- M9 : 16 captures ;
- LOT 9B-F historique : 35 captures, SHA-256 `f0e410c75806c0afb73f435108c83ff91f167d2090b35737f9d9f82304f12fb4`.

Ces archives complètent la nouvelle preuve #129 mais ne la remplacent pas.

## 9. Statut du dossier

**IN PROGRESS.**

Le dossier est suffisamment structuré pour préparer la soutenance, mais la fermeture #58 attend encore :
- la recette physique/accessibilité #71 ;
- l'export durable de l'artifact jury final #129 ;
- la consolidation finale des captures Prometheus/Grafana et des rapports de sécurité/performance dans le package livré ;
- la relecture finale après les éventuelles fusions #131/#132.

## 10. Ordre de finalisation

1. Terminer #71.
2. Fusionner/consigner #131 si ses gates sont vertes.
3. Fusionner #132.
4. Exporter les artifacts à rétention limitée.
5. Compléter la matrice avec les derniers SHAs/runs.
6. Relire #58 avec M10.
7. Fermer #58.
8. Passer à #59 : support 20 min, répétition et vidéo de secours.
