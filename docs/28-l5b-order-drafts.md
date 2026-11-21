# L5B — Brouillons de commande réels

## But

L5B connecte le parcours `Panier → Commande → Confirmation → Mes commandes` sans simuler une capacité de paiement qui n'existe pas encore.

## Frontière de responsabilité

- **Catalog Service** reste propriétaire des produits, variantes, prix et stocks courants.
- **Commerce Service** reste propriétaire du panier et devient propriétaire des brouillons de commande.
- **Gateway** expose uniquement les contrats publics explicites `/api/cart` et `/api/orders`.
- Le navigateur ne choisit jamais le propriétaire : le `userId` vient du JWT `sub`.

## Modèle

`Order` conserve :
- statut `DRAFT` ;
- devise et sous-total des articles au moment de la préparation ;
- coordonnées de livraison saisies par l'utilisateur ;
- clé d'idempotence côté serveur ;
- dates.

`OrderItem` conserve un snapshot immuable de :
- productId / variantId ;
- slug et nom produit ;
- libellé de variante ;
- prix unitaire ;
- quantité ;
- total de ligne.

Le navigateur ne reçoit ni `userId` interne ni clé d'idempotence.

## Création

`POST /api/orders` :
1. exige un JWT valide ;
2. exige `Idempotency-Key` ;
3. relit le panier réel depuis Commerce ;
4. relit indirectement prix/stock/statut courants via l'hydratation Catalog de L5A ;
5. refuse panier vide ou ligne indisponible ;
6. fige le snapshot en base Commerce ;
7. renvoie le même brouillon si la même clé est rejouée.

## Règle stock

L5B **ne réserve et ne décrémente aucun stock**. Le panier n'est pas vidé.

C'est volontaire : réserver du stock sans paiement réel créerait des stocks fantômes et imposerait immédiatement expiration, annulation et compensation. Ces responsabilités appartiennent au futur lot paiement/réservation.

## UX

- `/panier` active « Préparer ma commande » uniquement si toutes les lignes sont disponibles.
- `/commande` affiche le panier réel et collecte les coordonnées.
- `/commande/confirmation?id=...` relit le brouillon propriétaire.
- `/mes-commandes` affiche l'historique réel.
- Les écrans indiquent explicitement que le paiement n'est pas effectué et que le stock n'est pas réservé.

## Preuves automatisées

M6 vérifie les tables `commerce."Order"` et `commerce."OrderItem"`.

M8 vérifie :
- 401 anonyme ;
- panier vide refusé ;
- isolation entre utilisateurs ;
- création réelle ;
- replay idempotent ;
- snapshot prix immuable après changement Catalog ;
- panier conservé ;
- stock Catalog inchangé.
