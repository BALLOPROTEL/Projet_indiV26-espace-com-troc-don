# M9 — LOT 9B-D / E — DON et TROC — CERTIFIÉ ET FUSIONNÉ

**État vérifié : 12 octobre 2026.** M9 est intégré à `main` par la [PR #54](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/pull/54), merge commit [`d29d499`](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/commit/d29d4997c70f10594fc137f66361fbc46698b269). Issue de migration [#44](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/44), epic métier [#35](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/35).

## Fonctionnalités livrées

### Backend Marketplace et Catalog

- `GET /api/proposals/received` : réception pour le propriétaire par lecture de l'API Catalog interne sécurisée (sans accès à sa base SQL).
- `POST /api/proposals/:id/reject` : refus réservé au propriétaire ; transition conditionnelle PENDING → REJECTED, 403/404/409 et non-réservation Catalog.
- `POST /api/proposals/:id/accept` : acceptation, réservation Catalog, création de transaction ; propositions concurrentes automatiquement rejetées avec événements outbox atomiques.
- `POST /api/transactions/:id/confirm` : première confirmation sans clôture, deuxième confirmation → COMPLETED et clôture des annonces, pour DON ou TROC.
- `proposal.rejected` : événement versionné RabbitMQ via outbox transactionnelle Prisma, replay après indisponibilité et déduplication PostgreSQL Notification.
- Erreurs de l'API interne Catalog : HTTP 502 lors d'une réponse amont invalide / interruption du flux, selon les tests de contrat.

### Web Next.js

- Fiche DON : envoyer une demande authentifiée avec message facultatif.
- Fiche TROC : choisir son annonce approuvée/disponible, voir les deux objets côte à côte et proposer l'échange.
- Espace membre : demandes envoyées/reçues, acceptation/refus, historique, notifications d'état, confirmation des deux participants.
- Affichage des annonces déjà réservées/attribuées, vérifications de rôles et maintien des réponses d'action si le rafraîchissement échoue.

## Preuves GitHub Actions finales

| CI — HEAD de PR `7a5e353` | Run | Verdict |
| --- | --- | --- |
| Bootstrap — migrations, tests, Docker Compose, Kubernetes kind, Trivy | [#38090618276](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/actions/runs/38090618276) | **SUCCESS** |
| M8 Microservices Contracts | [#38090618272](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/actions/runs/38090618272) | **SUCCESS** |
| Real Microservice E2E — HTTP/JWT/RabbitMQ/Keycloak/Chrome | [#38090618298](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/actions/runs/38090618298) | **SUCCESS** |
| M9 Web — lint, typecheck, tests, build | [#38090618285](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/actions/runs/38090618285) | **SUCCESS** |

**Post-fusion sur `main`** : [Bootstrap #38091686672](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/actions/runs/38091686672) **SUCCESS** ; publication immuable GHCR également validée.

## Recette visuelle Chrome réelle

Le script `scripts/m9-browser-visual.mjs` pilote une vraie instance Chrome/CDP et Keycloak (`demo-user`, `demo-moderator`) dans une stack CI jetable. Les assertions portent sur les clics utilisateur réels, et les requêtes API de suivi sont en **lecture seule**.

- Deux demandes DON et une offre TROC avec comparaison : envoyées puis visibles côté demandeur.
- Changement de compte, réception chez le propriétaire, refus de la première demande et acceptation des deux autres.
- Première confirmation des transactions : restent IN_PROGRESS ; seconde confirmation : deviennent COMPLETED.
- Disponibilité Catalog : annonces terminées indisponibles ; annonce refusée disponible ; impossibilité de reproposer un don terminé.
- Captures automatiques en plus du smoke initial : **16 fichiers PNG**, artefact GitHub Actions à rétention courte (7 jours).
- Corrections Codex : navigation CDP attend la bonne URL et le bon identifiant rendu ; IDs des quatre fixtures à préfixes distincts ; dernier review `7a5e353` sans anomalie majeure.

[Artefact Chrome de la dernière CI M9](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/actions/runs/38090618298/artifacts/11684230573) — conservation jusqu'au 17 octobre 2026.

## Limites et étapes suivantes

Les quatre fixtures Chrome du parcours transactionnel sont des **annonces synthétiques approuvées**, sans galerie réelle. Les contrôles métier DON/TROC, RabbitMQ, Keycloak et double confirmation sont certifiés, **mais pas encore un enchaînement intégral depuis un upload d'au moins 5 images puis modération jusqu'à la transaction**. Cette dernière recette et les données de démonstration reproductibles relèvent de **LOT 9B-F**, issue [#56](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/56).

Le Codespace saturé n'a pas été modifié pour ces certifications ; ne pas supprimer les PVC Minikube sans plan de retour arrière. M10 (dossier d'architecture) : [#57](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/57).

**Décision : M9 DONE, LOT 9B-F READY, M10 / LOT 10 BACKLOG.** Les CI longues ne sont pas attendues en conversation : on transmet leurs liens puis on vérifie sur demande.
