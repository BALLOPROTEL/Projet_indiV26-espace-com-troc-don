# Dossier de preuves techniques final — 18 novembre 2026

## 1. Objet et périmètre

Ce document centralise les preuves de la version effectivement intégrée de **La Petite Maison de l’Épouvante** pour le jury CESI.

Il distingue :
- ce qui est **livré et certifié** ;
- les preuves **automatisées** ;
- les validations **manuelles** ;
- les capacités validées uniquement en **environnement laboratoire** ;
- les limites à présenter honnêtement avant toute exposition publique durable.

Il ne remplace pas les diagrammes d’architecture ni le runbook opérateur ; il sert de **matrice de traçabilité finale**.

## 2. Référence Git finale du dossier

Référence fonctionnelle au démarrage de la consolidation :

- `main` : `e886d457053ad33771374663e043ef61820ba3eb`;
- PR #129 : recette navigateur jury finale ;
- PR #130 : journal de preuve jury ;
- PR #131 : robustesse Bootstrap / fallback registre ;
- PR #132 : protocole de recette physique ;
- PR #134 : preuves accessibilité/réseau complémentaires ;
- PR #135 : README/roadmap/audit réalignés ;
- #35/#56 : LOT 9B fermé ;
- #55 : gouvernance GitHub/Kanban fermée ;
- #71/#63/#85 : frontend/UX/accessibilité fermés ;
- #80/#98 : fermés.

Le Bootstrap post-fusion #568 est **SUCCESS** sur `7f553afd03f870da9f01ba5b650c6da83917cd0b`. Le Bootstrap #569 est également **SUCCESS** sur `e886d457053ad33771374663e043ef61820ba3eb`.

## 3. Matrice de traçabilité

| Exigence / capacité | État final | Référence | Preuve principale |
| --- | --- | --- | --- |
| Architecture microservices | **PASS** | M0–M10, docs 24/25 | Gateway + Catalog + Marketplace + Notification + Keycloak + RabbitMQ + PostgreSQL + MinIO |
| API Gateway / Strangler | **PASS** | M4 / PR #48 + correctifs | routage API, JWT, multipart/binaire, fallback legacy documenté |
| Catalogue / modération | **PASS** | Catalog Service | PENDING/APPROVED/REJECTED, ownership, API publique/privée |
| Galerie / MinIO | **PASS** | LOT 9B-B/C + #129 | 5–8 images, validation fichier, accès privé/public selon état |
| Workflow DON | **PASS** | M9 / #54 + #129 | demande, refus/acceptation, réservation, double confirmation, COMPLETED |
| Workflow TROC | **PASS** | M9 / #54 + #129 | contrepartie, comparaison, double réservation, double confirmation, COMPLETED |
| RabbitMQ / Notification | **PASS** | M5/M8/#129 | `proposal.rejected`, persistance, déduplication `eventId` |
| OIDC / Keycloak | **PASS** | #99/#129 | login Chrome réel, JWT, rôles, mot de passe desktop/mobile |
| RBAC USER/MODERATOR/ADMIN | **PASS** | M8/F5/#129 | ADMIN autorisé ; USER refusé UI + backend HTTP 403 |
| Frontend V2/V3/V4 | **PASS** | #63/#85 fermés | validation propriétaire + parcours réels |
| Accessibilité / appareils | **PASS** | #71 fermé + #134 | iPhone/Safari, Android/Chrome, zoom 200 %, clavier/contrastes, reduced-motion |
| Réseau dégradé | **EN COURS** | #134 + #137 | #134 prouve l’accueil ; #137 complète fiche/galerie, Mon espace, panne Catalog et récupération |
| Kit jury | **PASS** | #125/#126/#127 | 4 acteurs, 4 annonces, 20 médias autorisés/provenance |
| Recette jury finale | **PASS** | #129 | run `44333998288` SUCCESS |
| Journal jury | **PASS** | #130 | docs/27 + docs/28, IDs/statuts réels |
| Bootstrap CI | **PASS** | #131 + runs #561/#562/#568 | fallback registre et services CI après checkout |
| Contrats / intégration | **PASS** | M8 | HTTP/JWT/RabbitMQ/services réels |
| Docker Compose | **PASS** | M6 | stack isolée et smokes CI |
| Kubernetes | **PASS laboratoire** | `docs/20-m7-kubernetes-microservices.md` | déploiements/services, probes/resources, kind/Minikube, HPA Gateway |
| Performance / HPA | **PASS laboratoire** | `docs/13-lot8-performance.md` | stress 35 962 requêtes, 0,067 % erreurs, p95 399 ms, HPA Gateway jusqu’à 4 réplicas |
| Observabilité | **PASS laboratoire** | `docs/12-lot7-observability.md` | Prometheus/Grafana, métriques, logs JSON, health/readiness |
| Sécurité dépendances/images | **PASS gates actuelles** | `docs/14-lot9-security-audit.md` + Bootstrap | audit prod HIGH/CRITICAL + Trivy HIGH/CRITICAL + registre des risques résiduels |
| Gouvernance GitHub | **PASS** | #55 fermé | README/roadmap/audit, branches, PR, Kanban V2 alignés |
| Robustesse registre ECR | **PASS** | #80/#131 | retries + fallback officiel ECR Public → Docker Hub |

## 4. Preuve métier jury — LOT 9B-F

### Références

- PR #129 ;
- HEAD certifié : `66fc61cb3bf8f498aaf4cd2a2c9cfd2b5fb4d155`;
- fusion `main` : `b17da30e01f4d96c393d37ff237f04bc26c1d3ad`;
- run jury final : `44333998288` — **SUCCESS** ;
- M8 Real Microservice E2E #199 : **SUCCESS** ;
- Bootstrap #552 : **SUCCESS** ;
- Bootstrap post-fusion #553 : **SUCCESS** ;
- Codex final : clean après ajout de la preuve backend USER → ADMIN HTTP 403.

### Résultats

- 4 acteurs distincts : propriétaire, demandeur, modérateur, administrateur ;
- 4 annonces ;
- 20 médias autorisés ;
- 20/20 médias uploadés via Chrome et vérifiés byte-à-byte ;
- DON refusé : proposition REJECTED et annonce AVAILABLE ;
- DON accepté : double confirmation, transaction/annonce COMPLETED ;
- TROC : deux annonces réservées, double confirmation, transaction et annonces COMPLETED ;
- notification `proposal.rejected` persistée une seule fois ;
- ADMIN : accès autorisé ;
- USER : refus ADMIN côté interface et HTTP 403 côté backend.

Les IDs réels du run sont consignés dans `docs/28-jury-parcours-operateur.md`.

## 5. Archive jury durable

Artifact GitHub d’origine :
- ID : `14441750513`;
- nom : `jury-final-browser-1993ea8dc4d4eb3581841794959b24c65ddf60cf`;
- SHA-256 ZIP : `07985fdadd9ad32c7973f43d8f66afd2a8753d28cd6e593c05d2431652105f76`.

Archive persistante créée hors rétention Actions :

`/Projet_individuel26/Preuves/Final_2026-11-18/jury-final-browser-evidence.zip`

Elle contient notamment les captures et `jury-final-report.json`.

## 6. Preuve frontend, accessibilité et réseau

### Automatisé

PR #134, HEAD certifié `50d9896f830d35c02ebc87e8d197695fa12349b7`, fusion `main` `e886d457053ad33771374663e043ef61820ba3eb`.

Gates :
- M8 réel : **SUCCESS** ;
- recette jury : **SUCCESS** ;
- validation structure : **SUCCESS** ;
- Codex final : clean.

Résultats :
- desktop/mobile Chrome 320/390 ;
- cibles tactiles >= 44 px ;
- absence d’overflow sur écrans clés ;
- Keycloak desktop/mobile ;
- Tab/focus-visible ;
- forced-colors / High Contrast ;
- proxy layout équivalent zoom 200 % : accueil + ADMIN sans overflow ;
- `prefers-reduced-motion: reduce` réellement actif ;
- Slow 3G #134 : accueil Catalog utilisable ; preuve réseau complète en cours via #137 (fiche/galerie, Mon espace, panne + récupération).

Artifact :
- ID : `14473385412`;
- SHA-256 ZIP : `02f4b39b6d16e746c7e0edb6eba1723c6baadd52a9098132f4edcb3be9f8953f`.

Archive persistante :

`/Projet_individuel26/Preuves/Final_2026-11-18/accessibility-evidence-pr134.zip`

Preuves d'exploitation complémentaires regroupées dans le même dossier Library :
- `/Projet_individuel26/Preuves/Final_2026-11-18/lot7-observability-evidence.txt` ;
- `/Projet_individuel26/Preuves/Final_2026-11-18/lot7-lot9-validation-evidence.txt` ;
- `/Projet_individuel26/Preuves/Final_2026-11-18/security-reports-e886d457.zip`.

Le rapport JMeter/HPA brut historique n'est pas recopié artificiellement : ses résultats canoniques et limites sont versionnés dans `docs/13-lot8-performance.md`.

### Manuel — confirmation propriétaire

Le 18/11/2026, le propriétaire a confirmé :

- iPhone / Safari : **PASS** ;
- Android / Chrome : **PASS** ;
- vrai zoom navigateur 200 % : **PASS** ;
- clavier seul + contrastes : **PASS**.

Les versions précises des appareils/navigateurs et captures manuelles n’ont pas été consignées ; ne pas les inventer dans la soutenance.

## 7. Sécurité et qualité

Références versionnées :
- `docs/14-lot9-security-audit.md` : audit, Trivy, remédiations et risques résiduels ;
- `docs/12-lot7-observability.md` : métriques, logs, Prometheus/Grafana ;
- `docs/13-lot8-performance.md` : protocole JMeter, résultats et HPA ;
- `docs/20-m7-kubernetes-microservices.md` : validation Minikube/kind multi-services ;
- `docs/24-m10-architecture-finale.md` et `docs/25-m10-operations-limits.md` : architecture finale et limites d’exploitation.

Les gates actuelles couvrent notamment :

Artifact sécurité Bootstrap #569 :
- ID : `14474009386` ;
- nom : `security-reports-e886d457053ad33771374663e043ef61820ba3eb` ;
- digest GitHub : `sha256:a131addcbecdb080b767faa75f4a7e8952d1b2893deea50118d38bc822f8aff9` ;
- archive Library : `/Projet_individuel26/Preuves/Final_2026-11-18/security-reports-e886d457.zip`.

Lecture du rapport :
- Trivy image API : **0 vulnérabilité détectée** ;
- `pnpm audit` : **0 HIGH / 0 CRITICAL**, mais **2 advisories MODERATE** sur Next.js 16.4.1 ;
- les primitives citées dans ces advisories (`unstable_cache`, `'use cache'`, `next/root-params`) ne sont pas utilisées dans le dépôt au moment de cette preuve ;
- la mise à niveau Next.js reste toutefois à réaliser dans le backlog sécurité post-jury #115.

Les gates actuelles couvrent notamment :

- lint / typecheck / tests unitaires ;
- intégration PostgreSQL ;
- E2E HTTP ;
- contrats Gateway/Catalog/Marketplace/Notification ;
- smokes RabbitMQ/Gateway ;
- Docker Compose M6 ;
- Kubernetes M7 en environnement laboratoire ;
- audit dépendances production HIGH/CRITICAL ;
- Trivy HIGH/CRITICAL ;
- revues Codex sur les PR sensibles ;
- RBAC backend explicite sur la route ADMIN ;
- absence de secrets loggés dans les workflows de certification.

### Couverture de tests

Bootstrap #569 (`main` `e886d457053ad33771374663e043ef61820ba3eb`) publie l'artifact GitHub :

- ID : `14472463019`;
- nom : `api-coverage-e886d457053ad33771374663e043ef61820ba3eb`;
- digest GitHub : `sha256:ec29463f36812a6513a024fba769855d2d8cf53ec4cfb5025bbfc4211eb477a4`;
- contenu : `coverage-summary.json`, `lcov.info` et rapport HTML ;
- archive Library persistante : `/Projet_individuel26/Preuves/Final_2026-11-18/api-coverage-e886d457.zip`.

Résultat du `coverage-summary.json` :
- lignes : **96,44 %** (163/169) ;
- statements : **96,61 %** (171/177) ;
- fonctions : **100 %** (42/42) ;
- branches : **93,51 %** (101/108).

**Périmètre à ne pas sur-vendre :** cette couverture concerne uniquement les trois fichiers API configurés dans la gate Jest de couverture :
- `apps/api/src/listings/image-file.validator.ts` ;
- `apps/api/src/listings/listing-images.service.ts` ;
- `apps/api/src/listings/listings.service.ts`.

Elle ne constitue donc pas un pourcentage de couverture global de tous les microservices ni du frontend. Les autres couches sont couvertes par leurs tests unitaires, contrats, intégration et E2E sans agrégation chiffrée globale.

## 8. Architecture et limites assumées

Références :
- `docs/24-m10-architecture-finale.md` ;
- `docs/25-m10-operations-limits.md`.

Limites à présenter au jury :

- la stratégie Strangler conserve encore un fallback Legacy documenté ;
- les domaines possèdent leur ownership logique mais certains composants de laboratoire partagent encore l’infrastructure physique ;
- l’outbox n’est pas généralisée à tous les domaines ;
- le realm Keycloak et le dataset de jury sont des environnements de démonstration ;
- Kubernetes, HPA, observabilité et performances sont prouvés en environnement laboratoire, pas comme SLO de production ;
- HTTPS durable, conformité légale, SEO, anti-spam et autres durcissements publics restent dans le backlog post-jury #110–#115 ;
- aucune Release de production ne doit être annoncée avant le gel final #59.

## 9. Gouvernance du dépôt

État acquis :
- LOT 9B #35/#56 : fermé ;
- frontend/accessibilité #71/#63/#85 : réouverts temporairement jusqu’à validation réseau complète #137 ;
- Keycloak #98 : fermé ;
- robustesse CI #80 : fermé ;
- synchronisation GitHub/Kanban #55 : fermée ;
- branches historiques nettoyées ;
- `main` protégée ;
- tag historique `baseline-2026-10-19` conservé ;
- aucune Release finale prématurée.

## 10. Archives historiques complémentaires

- M9 : 16 captures historiques ;
- LOT 9B-F historique : 35 captures ;
- SHA-256 archive historique LOT 9B-F : `f0e410c75806c0afb73f435108c83ff91f167d2090b35737f9d9f82304f12fb4`.

Ces archives complètent les preuves #129/#134 mais ne remplacent pas les runs finaux.

## 11. Verdict #58

**READY TO CLOSE après merge de la présente consolidation.**

Les prérequis fonctionnels, UX, sécurité, CI et gouvernance sont satisfaits. La validation accessibilité/réseau attend encore la preuve complète #137 ; le dossier reste Draft jusqu’à son succès. Les artifacts critiques déjà disponibles ont été exportés vers une archive persistante.

Après fusion de cette documentation et contrôle CI/Codex :
1. fermer #58 ;
2. passer #18 en cours sur LOT 10-B ;
3. démarrer #59 : support de 20 minutes, script oral, répétition chronométrée et démo/vidéo de secours ;
4. créer le tag/release jury uniquement après validation finale #59.
