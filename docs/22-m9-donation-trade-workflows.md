# M9 — Workflows DON et TROC — LOT 9B-D / LOT 9B-E

Issue #44 (migration), issue #35 (parcours métier). Reprise du modèle microservices M8 fusionné.

## Déjà certifié par M8

- Création de demandes `DONATION_REQUEST` et offres `TRADE_OFFER` par le Marketplace Service
- Conditions d'acceptation et réservation Catalog pour un ou deux objets
- Double confirmation d'une transaction et état `COMPLETED`
- JWT Keycloak / ownership, événements RabbitMQ, déduplication durable
- E2E DON/TROC dans la CI, **mais sur annonces précréées**, sans parcours frontend utilisateur.

## M9 — Livrables développés sur la branche

### Backend

- `GET /api/proposals/received` : propositions adressées aux annonces du membre authentifié.
  Marketplace récupère uniquement les identifiants de ses annonces depuis
  `GET /internal/listings/owner/:ownerId/ids`, protégé par `InternalServiceGuard` ;
  aucun accès Prisma cross-service.
- `POST /api/proposals/:id/reject` : refus strictement réservé au propriétaire
  de l'annonce cible, transition conditionnelle `PENDING → REJECTED` avec
  `resolvedAt`, refus concurrent `409`, réponse `403` pour un non-propriétaire.
  Aucune réservation Catalog lors d'un refus.
- `proposal.rejected` : nouvel événement RabbitMQ version 1, validé et conservé
  par le Notification Service PostgreSQL durable.

### Frontend

- Fiche publique DON : demande authentifiée avec message facultatif ;
- Fiche publique TROC : sélection d'un de ses objets `APPROVED / AVAILABLE`,
  comparaison des deux fiches avant envoi, message facultatif ;
- Espace membre : demandes envoyées/reçues, boutons accepter/refuser,
  visualisation des contreparties, transactions et confirmations des deux
  participants ; données privées consultées seulement avec JWT ;
- Affichage informatif si une annonce n'est plus disponible.

## Gates à terminer avant fusion

- Types/lint/build Web ; tests unitaires Marketplace / Notification ;
- Contrats Gateway / Catalog interne ; tests E2E DON/TROC de M8 sans régression ;
- Nouveau E2E réel M9 : propriétaire reçoit proposition, refuse, 409 en cas
  de double refus/acceptation, notification RabbitMQ `proposal.rejected`,
  aucune réservation après refus, comparaison des deux annonces ;
- Vérification CI sécurité, Bootstrap complète, revue de PR et corrections ;
- Vérifications UX sans toucher au Minikube Codespaces M7/M8 (disque limité).

**Statut initial : EN COURS.** La PR reste en brouillon tant que la CI
et les parcours réels M9 n'ont pas été certifiés.
