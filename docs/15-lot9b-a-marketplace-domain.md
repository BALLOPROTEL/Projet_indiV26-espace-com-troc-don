# LOT 9B-A — Modèle marketplace et règles métier

## Objectif

Préparer le socle métier du parcours réel de don et de troc sans casser les annonces déjà existantes.

Ce sous-lot ne met pas encore en ligne l'upload d'images, les nouveaux formulaires, les demandes de don, les propositions de troc ni les écrans de transaction.

Il prépare les données et les règles consommées par les sous-lots 9B-B à 9B-E.

## 1. Séparation modération / disponibilité

La modération existante est conservée :

~~~text
PENDING
APPROVED
REJECTED
~~~

Un second cycle est ajouté pour la disponibilité réelle de l'objet :

~~~text
AVAILABLE
RESERVED
COMPLETED
~~~

Exemple :

~~~text
status = APPROVED
availabilityStatus = AVAILABLE
~~~

puis après acceptation d'une demande :

~~~text
status = APPROVED
availabilityStatus = RESERVED
~~~

et après remise effective :

~~~text
status = APPROVED
availabilityStatus = COMPLETED
~~~

Cette séparation évite de détourner le statut de modération pour gérer une transaction.

## 2. Images

Nouveau modèle ListingImage :

~~~text
id
listingId
objectKey
mimeType
sizeBytes
position
createdAt
~~~

Les fichiers binaires ne seront pas stockés dans PostgreSQL. Le futur LOT 9B-B utilisera objectKey pour référencer le fichier dans un stockage objet S3-compatible.

Règle métier préparée : minimum 5 images, maximum 8 images.

## 3. Souhaits de troc

Nouveau modèle ListingTradeWish :

~~~text
id
listingId
label
position
createdAt
~~~

Pour une annonce TRADE :
- minimum 5 souhaits distincts ;
- maximum 10 ;
- espaces superflus retirés ;
- doublons insensibles à la casse éliminés.

Pour une annonce DONATION :
- aucun souhait de troc n'est accepté.

Cette règle sera branchée au formulaire lors du LOT 9B-C.

## 4. Demandes et propositions

Nouveau modèle Proposal :

~~~text
id
targetListingId
requesterId
type
offeredListingId
message
status
resolvedAt
createdAt
updatedAt
~~~

Types :

~~~text
DONATION_REQUEST
TRADE_OFFER
~~~

États :

~~~text
PENDING
ACCEPTED
REJECTED
CANCELLED
~~~

Pour un don, offeredListingId reste vide.

Pour un troc, offeredListingId référence l'objet proposé par le demandeur.

## 5. Transaction

Nouveau modèle MarketplaceTransaction :

~~~text
id
proposalId
targetListingId
offeredListingId
ownerId
requesterId
status
ownerConfirmedAt
requesterConfirmedAt
completedAt
cancelledAt
createdAt
updatedAt
~~~

États :

~~~text
IN_PROGRESS
COMPLETED
CANCELLED
~~~

Les deux participants disposent de leur propre confirmation via ownerConfirmedAt et requesterConfirmedAt.

## 6. Règles métier versionnées

MarketplaceRulesService prépare les contrôles suivants.

Publication enrichie :
- 5 à 8 images ;
- TRADE : au moins 5 souhaits distincts, au plus 10 ;
- DONATION : aucun souhait.

Demande de don :
- le demandeur ne peut pas être propriétaire de l'objet ;
- l'annonce doit être DONATION ;
- elle doit être APPROVED ;
- elle doit être AVAILABLE.

Proposition de troc :
- l'objet cible doit être TRADE, APPROVED et AVAILABLE ;
- il ne doit pas appartenir au demandeur ;
- l'objet proposé doit être différent de l'objet cible ;
- il doit appartenir au demandeur ;
- il doit être TRADE, APPROVED et AVAILABLE.

Acceptation :
- la proposition doit être PENDING ;
- l'objet cible doit encore être disponible ;
- l'objet proposé, lorsqu'il existe, doit encore être disponible.

Confirmation :
- seuls le propriétaire de l'objet cible et le demandeur peuvent confirmer une transaction IN_PROGRESS.

## 7. Compatibilité avec l'existant

La migration ajoute Listing.availabilityStatus avec la valeur par défaut AVAILABLE.

Toutes les annonces existantes restent donc valides après migration.

Les routes existantes de création et de modération ne sont pas encore forcées à fournir 5 images ou 5 souhaits. Ce choix est volontaire : le nouveau contrat de publication sera activé lorsque l'upload et le formulaire enrichi seront prêts dans 9B-B / 9B-C.

Ainsi, LOT 9B-A ne casse pas la démonstration actuelle.

## 8. Validation

Commande dédiée :

~~~bash
pnpm marketplace:validate
~~~

Puis sur PostgreSQL local :

~~~bash
pnpm db:deploy
pnpm api:quality
~~~

La migration doit conserver les anciennes annonces et leur attribuer automatiquement availabilityStatus = AVAILABLE.

## 9. Suite

Une fois 9B-A certifié :

~~~text
LOT 9B-B
Stockage objet + upload sécurisé de 5 à 8 images
~~~

Le frontend enrichi ne commencera qu'après validation du stockage.
