# M9 — Workflows DON et TROC — LOT 9B-D / LOT 9B-E

Issue #44 (migration microservices), issue #35 (parcours métier). Base `main` intégrant M8 via PR #53.

## Périmètre réalisé

### Backend microservices
- `GET /api/proposals/received` : boîte de réception authentifiée du propriétaire, via `GET /internal/listings/owner/:ownerId/ids` protégé par `InternalServiceGuard`. Aucun accès à la base Catalog depuis Marketplace.
- `POST /api/proposals/:id/reject` : refus autorisé uniquement au propriétaire de l'annonce cible ; transition conditionnelle `PENDING → REJECTED`, `resolvedAt`, HTTP 403 non-propriétaire et HTTP 409 après décision. Pas de réservation Catalog lors du refus.
- `proposal.rejected` version 1 consommé et dédupliqué durablement dans Notification/PostgreSQL.
- Correction Codex P1 : transition du refus et écriture `MarketplaceOutboxEvent` atomiques dans une transaction Prisma. Worker de republication RabbitMQ, `eventId` stable et déduplication Notification.
- Correction Codex P2 : erreurs de lecture/JSON de la liste d'annonces du propriétaire renvoyées en HTTP 502 ; tests de réponse non JSON et de corps interrompu.
- Les parcours M8 de création de demande, acceptation, réservation et double confirmation sont conservés.

### Frontend
- Fiche DON : demande depuis une session Keycloak, message facultatif.
- Fiche TROC : sélection d'une annonce personnelle approuvée et disponible, comparaison visuelle des deux fiches, message facultatif.
- Espace membre : demandes envoyées/reçues, refus/acceptation, suivi des transactions et confirmation par les deux participants.
- Accès aux données privées uniquement avec JWT ; affichage adapté aux annonces indisponibles.

## CI certifiées sur `81ff5a42a7e5a90a0d57cd52d4aa2c4c371093da` (10 octobre 2026)

| Gate | GitHub Actions | Résultat |
| --- | --- | --- |
| Bootstrap CI (migrations, tests services, web, Docker Compose, Kubernetes, Trivy) | [#38083313818](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/actions/runs/38083313818) | SUCCESS |
| M8 Microservices Contracts (contrats Gateway, Catalog, Notification) | [#38083313823](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/actions/runs/38083313823) | SUCCESS |
| M8 Real Microservice E2E Integration (DON/TROC, auth, RabbitMQ, pannes, M9 et navigateur) | [#38083313814](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/actions/runs/38083313814) | SUCCESS |
| M9 Web Donation Trade Quality (lint, typecheck, unitaires, build) | [#38083313820](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/actions/runs/38083313820) | SUCCESS |

Le journal E2E #38083313814 atteste : accès propriétaire/demandeur, refus et conflits HTTP 409, absence de réservation au refus, `proposal.rejected` stocké une fois, arrêt réel de RabbitMQ puis livraison de l'outbox après reprise.

### Navigateur réel (Chrome headless, stack Compose jetable)

Run [#38083313814](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/actions/runs/38083313814) : PASS pour la fiche DON desktop/mobile, écran de connexion, connexion Keycloak du propriétaire et boîte de réception montrant « refusée », déconnexion, connexion Keycloak du demandeur et liste envoyée montrant « refusée ».

Artefact : `m9-browser-visual-d1db122e2b3e83c28758117c38821c4d51fce1cc` (5 captures : `don-detail-desktop.png`, `don-detail-mobile.png`, `espace-login-desktop.png`, `espace-owner-inbox-desktop.png`, `espace-requester-outbox-desktop.png`).

**Limite de couverture explicite :** ce smoke navigateur confirme l'authentification des deux rôles et l'affichage des états, pas l'intégralité des interactions navigateur « création de demande DON/TROC → acceptation → double confirmation ». Le parcours backend réel associé est couvert par les E2E microservices ; une recette visuelle/manuelle de ces clics reste recommandée avant la fusion.

## Revue, sécurité et décision de fusion

- Nouvelle revue Codex sur `b315807` : trois P2 pris en compte avant fusion : migration Marketplace au démarrage de `services:dev`, message de succès Web conservé si un rafraîchissement échoue, et outbox atomique pour les propositions refusées automatiquement lors d'une acceptation. Test unitaire pour les refus concurrents ajoutés. **Les nouvelles CI doivent certifier ces changements.**
- Codex a rendu deux remarques sur le commit `51b855f` : P1 outbox et P2 HTTP 502. Les correctifs sont présents sur le HEAD `81ff5a4`, la CI et les tests de panne sont verts.
- Une **relecture Codex du HEAD final** doit être examinée avant de déclarer la PR prête pour fusion ; ne pas assimiler la revue antérieure du commit `51b855f` à une approbation du HEAD actuel.
- La PR #54 reste **ouverte et en brouillon**. Aucune fusion, activation d'auto-merge ou modification du Codespace/Minikube sans accord explicite du propriétaire.
- CI GitHub Actions utilise une stack Docker Compose jetable : le Codespace à espace disque limité reste intact.

**Statut : validations automatisées M9 réussies ; revue du HEAD final et GO utilisateur pour fusion encore requis.**
