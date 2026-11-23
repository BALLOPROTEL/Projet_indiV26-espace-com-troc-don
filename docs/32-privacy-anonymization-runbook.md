# Exécution d'une anonymisation de compte

Ce document décrit le comportement technique livré avec les lots #168/#169.

## Déclenchement

1. Le membre envoie une demande `ANONYMIZE` ou `ERASE` depuis le formulaire
   Privacy authentifié.
2. La demande est persistée avec le `sub` Keycloak du membre.
3. Un ADMIN ouvre `/admin/contenus`.
4. L'ADMIN confirme explicitement l'exécution.
5. Catalog crée un ledger `PrivacyExecution` et des identifiants de
   remplacement distincts par domaine.
6. Les services sont appelés uniquement par leurs endpoints internes protégés
   par `x-internal-service-token`.
7. La demande passe à `CLOSED` uniquement lorsque tous les domaines ont
   terminé.

Une exécution en échec reste `FAILED` avec son identifiant source conservé
dans le ledger pour permettre une reprise sûre. Une exécution terminée devient
idempotente : la rejouer ne recommence pas l'anonymisation.

## Catalog

- les annonces restent comme références métier mais sont retirées du public :
  titre/description neutralisés, statut rejeté et `ownerId` remplacé ;
- les images de ces annonces sont supprimées de MinIO puis de PostgreSQL ;
- les souhaits de troc sont supprimés ;
- après intégration de #170, catégorie/ville/état sont également remis à null ;
- les favoris du compte et les favoris pointant vers ses annonces retirées sont supprimés ;
- les signalements présents dans le schéma sont anonymisés lorsqu'ils existent ;
- les anciennes demandes Contact/Privacy du compte sont détachées de l'identité,
  leur nom/e-mail/contenu sont neutralisés ;
- le ledger final ne conserve plus l'identifiant utilisateur original.

## Marketplace

- `requesterId`, `ownerId` et participants de conversations sont remplacés
  par un identifiant anonyme propre à Marketplace ;
- les messages initiaux de proposition sont supprimés ;
- les corps des messages de conversation écrits par le compte sont remplacés
  par un marqueur d'anonymisation ;
- les événements outbox contenant l'identité source sont supprimés.

Les transactions elles-mêmes restent disponibles pour préserver la cohérence
métier et les relations entre annonces/propositions.

## Notification

Les événements dont le compte est destinataire ou dont le payload contient
l'identifiant source sont supprimés.

## Commerce

- le panier est supprimé ;
- les commandes sont conservées mais passent sur un identifiant anonyme propre
  à Commerce ;
- prénom, nom, e-mail et adresse de livraison sont neutralisés ;
- les identifiants de session/intention de paiement sont retirés du modèle
  applicatif ;
- articles, quantités, montants, statut et dates de commande restent conservés
  afin de préserver l'historique transactionnel.

## Keycloak

L'identité Keycloak est un domaine séparé.

- `ANONYMIZE` : l'anonymisation applicative peut être suffisante selon la
  demande traitée.
- `ERASE` : après anonymisation applicative, la suppression de l'identité
  Keycloak doit être finalisée via la capability self-service Delete Account
  ou par l'administrateur Keycloak autorisé.

Aucun secret d'administration Keycloak n'est stocké dans le Web ou dans le
workflow d'anonymisation applicatif.

## Configuration interne

Catalog doit recevoir :

- `INTERNAL_SERVICE_TOKEN`
- `MARKETPLACE_INTERNAL_URL`
- `NOTIFICATION_INTERNAL_URL`
- `COMMERCE_INTERNAL_URL`

Marketplace, Notification et Commerce doivent recevoir le même
`INTERNAL_SERVICE_TOKEN`.

Les endpoints `/internal/privacy/users/:id/anonymize` ne sont jamais routés
par le Gateway public.
