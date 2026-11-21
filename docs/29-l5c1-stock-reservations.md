# L5C1 — Réservation atomique de stock avant paiement

## Objectif

L5C1 ajoute une vraie étape pré-paiement sans simuler d'encaissement.

Le principe est simple :

- **Catalog** reste propriétaire du stock ;
- **Commerce** reste propriétaire de l'état de la commande ;
- une commande ne passe à `AWAITING_PAYMENT` qu'après une réservation Catalog réellement réussie ;
- aucun statut `PAID` n'existe encore.

## Catalog — source de vérité du stock

Nouveaux modèles :

- `ProductStockReservation`
- `ProductStockReservationItem`

Statuts :

- `ACTIVE`
- `RELEASED`
- `EXPIRED`
- `COMMITTED`

Une réservation est unique par `orderId`.

Le TTL par défaut est de **900 secondes / 15 minutes** et peut être configuré par `PRODUCT_RESERVATION_TTL_SECONDS` entre 60 et 3600 secondes.

### Réservation atomique

`POST /internal/product-stock-reservations`

La réservation s'exécute dans une transaction PostgreSQL `Serializable`.

Avant tout décrément :

1. toutes les variantes doivent exister ;
2. leur `productId` doit correspondre ;
3. le produit doit être `PUBLISHED` ;
4. la variante doit être active ;
5. le stock doit couvrir toute la quantité demandée.

Si une ligne échoue, la transaction entière est annulée.

Chaque décrément est ensuite protégé par `stock >= quantity`.

### Release

`POST /internal/product-stock-reservations/:orderId/release`

Une réservation ACTIVE restitue chaque quantité au stock puis devient `RELEASED`.

L'appel est idempotent pour une réservation déjà libérée ou expirée.

### Commit futur

`POST /internal/product-stock-reservations/:orderId/commit`

Ce contrat est déjà préparé pour L5C2 : après confirmation réelle d'un paiement, la réservation pourra devenir `COMMITTED` sans recréditer le stock.

L5C1 ne l'appelle pas depuis l'interface utilisateur.

## Commerce — cycle de vie de la commande

Statuts L5C1 :

- `DRAFT`
- `AWAITING_PAYMENT`
- `CANCELLED`
- `EXPIRED`

`POST /api/orders/:id/reserve` :

- vérifie que la commande appartient au JWT `sub` ;
- accepte uniquement une commande `DRAFT` ;
- transmet les lignes figées à Catalog ;
- ne passe à `AWAITING_PAYMENT` qu'après réponse Catalog ACTIVE ;
- mémorise `reservationExpiresAt`.

Si l'écriture Commerce échoue après une réservation Catalog réussie, Commerce tente une compensation `release` best effort.

`POST /api/orders/:id/cancel` :

- libère d'abord une éventuelle réservation ACTIVE ;
- marque ensuite la commande `CANCELLED`.

À la lecture d'une commande `AWAITING_PAYMENT` dont l'échéance est dépassée, Commerce appelle `release` puis marque la commande `EXPIRED`.

## UX

Sur `/commande/confirmation?id=...` :

- DRAFT → bouton **Réserver mon stock** ;
- AWAITING_PAYMENT → échéance visible + bouton paiement désactivé ;
- CANCELLED → confirmation de restitution ;
- EXPIRED → indication que le stock a été rendu au catalogue.

`/mes-commandes` affiche les vrais statuts et l'échéance lorsqu'elle existe.

## Ce que L5C1 ne fait pas

- aucune saisie de carte ;
- aucun token de paiement ;
- aucun faux paiement ;
- aucun statut payé ;
- aucun remboursement ;
- aucun webhook prestataire.

Ces éléments appartiennent à L5C2.

## Preuves

### Unitaires

Catalog :
- décrément exact multi-lignes ;
- refus avant tout décrément si une ligne manque de stock ;
- restitution sur release.

Commerce :
- DRAFT → AWAITING_PAYMENT seulement après réservation ;
- release avant CANCELLED ;
- release avant EXPIRED.

### M6

Le smoke exige les tables :

- `catalog."ProductStockReservation"`
- `catalog."ProductStockReservationItem"`

### M8

Sur produit réel :

1. stock 5 ;
2. réservation de quantité 3 → stock 2 ;
3. replay de réservation → toujours 2 ;
4. annulation → stock 5.

Aucun paiement n'est nécessaire pour certifier L5C1.
