# L5A — Commerce Service et panier utilisateur

## Décision

Le panier est porté par un microservice `commerce-service` indépendant sur le port `3104`.

Il n'est pas ajouté à Catalog : Catalog reste propriétaire des produits, variantes, prix, stocks et médias. Commerce reste propriétaire de l'état de panier d'un utilisateur.

## Flux

```text
Browser
  |
  v
Next.js Web
  |
  v
Gateway :3000
  |
  +--> Catalog :3101
  |      - Product / ProductVariant / ProductImage
  |      - prix et stock de référence
  |
  +--> Commerce :3104
         - Cart / CartItem
         - propriétaire = sub JWT Keycloak
         |
         +--> GET Catalog /internal/products/:productId/variants/:variantId
              x-internal-service-token
```

## Propriété des données

### Catalog / PostgreSQL `catalog`

- Product
- ProductVariant
- ProductImage
- prix courant
- stock courant
- statut DRAFT / PUBLISHED / ARCHIVED

### Commerce / PostgreSQL `commerce`

- Cart
- CartItem
- `productId`
- `variantId`
- `quantity`

Commerce ne stocke pas de prix et ne possède aucune FK SQL vers Catalog.

## Règles de sécurité

- le panier est identifié exclusivement par le `sub` du JWT vérifié dans Commerce ;
- le navigateur ne fournit jamais de prix accepté par le backend ;
- `priceCents` et tout champ non prévu sont rejetés par le ValidationPipe ;
- Commerce lit le prix et le stock courants via Catalog ;
- le token interne Catalog n'est jamais exposé au frontend ;
- le Gateway n'expose que `/api/cart` et `/api/cart/*` pour ce domaine.

## Règles métier L5A

- ajouter au panier ne réserve pas le stock ;
- quantité autorisée : 1 à 99 et jamais supérieure au stock courant à l'écriture ;
- un produit doit être PUBLISHED ;
- une variante doit être active ;
- si prix, stock ou statut changent après l'ajout, le prochain GET panier reflète immédiatement Catalog ;
- une ligne devenue indisponible reste visible pour permettre à l'utilisateur de la retirer ou corriger ;
- une ligne indisponible est exclue du sous-total.

## Hors périmètre

L5A ne contient volontairement pas :

- Order ;
- checkout ;
- réservation de stock ;
- paiement ;
- stockage de carte ;
- simulation de paiement réussi.

Ces sujets appartiennent à L5B/L5C et nécessitent un contrat de commande et une stratégie de réservation/idempotence distincts.
