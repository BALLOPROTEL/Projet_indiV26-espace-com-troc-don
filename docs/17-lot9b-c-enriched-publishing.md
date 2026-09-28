# LOT 9B-C — Publication enrichie

## Objectif

Raccorder le domaine marketplace du LOT 9B-A et le stockage objet du LOT 9B-B au parcours utilisateur réel.

Une annonce soumise à la modération doit désormais être exploitable comme une vraie fiche métier :

- **5 à 8 images** ;
- pour un **TROC**, **5 à 10 souhaits distincts** ;
- pour un **DON**, aucune contrepartie ;
- galerie et souhaits visibles sur la fiche publique après approbation ;
- modération PENDING / APPROVED / REJECTED conservée.

## Backend

### Création et modification

Les DTO de création et modification acceptent `tradeWishes`.

Les souhaits sont normalisés côté serveur :

- espaces périphériques supprimés ;
- doublons insensibles à la casse supprimés ;
- TROC : 5 à 10 souhaits distincts ;
- DONATION : 0 souhait.

Les relations `ListingTradeWish` sont persistées avec une position stable.

### Réponses enrichies

Les endpoints suivants renvoient désormais les métadonnées enrichies :

- `GET /api/listings` ;
- `GET /api/listings/:id` ;
- `GET /api/listings/me` ;
- `GET /api/moderation/listings`.

Une image exposée contient uniquement :

- `id` ;
- `position` ;
- `mimeType` ;
- `sizeBytes` ;
- `contentUrl`.

La clé privée S3 `objectKey` n'est jamais exposée au client.

### Gate de modération

L'approbation appelle `MarketplaceRulesService.validatePublicationAssets`.

Une annonce PENDING ne peut donc pas devenir APPROVED si :

- elle possède moins de 5 ou plus de 8 images ;
- un TROC possède moins de 5 ou plus de 10 souhaits distincts ;
- un DON contient des souhaits de contrepartie.

Le rejet reste possible pour une fiche incomplète afin que le modérateur puisse demander une correction.

## Frontend

### Espace membre

Le formulaire de création permet :

- le choix TROC / DON ;
- la saisie des informations de base ;
- la sélection de 5 à 8 images JPEG / PNG / WEBP ;
- un aperçu local de la galerie ;
- la saisie dynamique de 5 à 10 souhaits pour un TROC.

L'édition conserve les assets existants tant qu'un nouveau lot d'images n'est pas sélectionné.

### Publication technique

Le frontend :

1. crée ou met à jour la fiche JSON ;
2. envoie le lot d'images par multipart vers `PUT /api/listings/:id/images`.

Le CORS API autorise explicitement `PUT` et `DELETE` en plus des méthodes historiques afin que ce cycle d'images fonctionne depuis le navigateur.

Si l'étape image échoue après la création, la fiche reste PENDING et la gate de modération empêche toute publication incomplète.

### Affichage public

Les cartes publiques peuvent afficher la première image approuvée.

La fiche `/annonces/[id]` affiche :

- galerie complète ;
- description ;
- nature DON / TROC ;
- souhaits de contrepartie pour un TROC ;
- nombre d'images et de souhaits.

## Tests

La certification 9B-C couvre :

- validation des souhaits ;
- création enrichie ;
- absence de fuite `objectKey` ;
- blocage de l'approbation si les assets sont incomplets ;
- parcours E2E TROC avec 5 souhaits + 5 images + modération ;
- règles frontend 5–8 images et 5–10 souhaits ;
- quality gates API/Web existantes ;
- audit sécurité et Trivy inchangés.

## Commandes

```bash
pnpm publication:validate
pnpm api:quality
pnpm web:quality
pnpm api:audit:prod
pnpm security:audit:static
```

## Statut

**IN PROGRESS — implémentation versionnée sur `feat/35-lot9b-c-enriched-publishing`.**
