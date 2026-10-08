# M8 — Contrats, intégration, E2E et sécurité microservices

> Issue #44. Branche `test/44-m8-microservices-contracts-e2e`.
> Après fusion M7 (PR #52), sans déploiement supplémentaire du Codespace saturé.

## Objectif / Definition of Done

Certifier que l'architecture microservices fonctionne **comme un système** et
pas seulement comme des processus démarrant chacun séparément.

La clôture de M8 exige :

1. **Contrats HTTP** : Gateway conserve les routes publiques `/api/*`, leurs
   chemins/query strings, JWT et réponses binaires/multipart. Les endpoints
   internes du Catalog et la Notification privée ne sont pas exposés.
2. **Contrat synchrone** : Marketplace ↔ Catalog couvre snapshot, réserve,
   complete, release, erreurs de statut 404/409 et authentification interne.
3. **Contrat asynchrone** : Publisher Marketplace → RabbitMQ → Notification,
   enveloppe versionnée `eventId,type,version,occurredAt,source,data`,
   comportements duplicate/retry, et trois événements réellement émis.
4. **E2E métier** : DON et TROC, création → proposition → acceptation →
   réservation → deux confirmations → COMPLETED, compensations et échecs.
5. **Sécurité** : authentification Keycloak/JWT, rôles et ownership, token
   inter-service, absence d'accès cross-service non autorisé, cas négatifs.
6. **CI et preuves** : tests reproductibles, journaux et critères d'acceptation
   traçables. Pas de validation fondée uniquement sur des recherches statiques.

## M8-A — Première gate de compatibilité (en cours)

Exécution locale ou CI :

```bash
pnpm m8:contracts:validate
```

Cette commande compile le routeur Gateway existant puis lance
`tests/contracts/m8-contracts.test.mjs` avec le runner natif de Node 24.
Elle vérifie :
- comportement **exécuté** du routage public Gateway ;
- préservation des paramètres de requête ;
- non-exposition des chemins internes ;
- signatures de routes internes Catalog et token inter-service ;
- contrôleurs Marketplace protégés JWT ;
- contrat d'enveloppe RabbitMQ / publisher confirm ;
- Ingress `app.* /api` dirigé directement vers Gateway.

Une CI ciblée `.github/workflows/m8-contracts.yml` exécute cette gate en
pull request. Il s'agit d'une **première régression de compatibilité**, pas
d'une certification de bout en bout du comportement réseau, des données,
des rôles ou des transactions.

## M8-B — Intégrations réelles (à implémenter)

- Test HTTP vrai Gateway → Catalog/Marketplace/Legacy, avec réponses 200/401/404
  et contenu multipart/binaire non corrompu, plutôt qu'un stub seul.
- Test d'une requête non autorisée Catalog `/internal/listings/:id`
  puis de la même requête avec le token inter-service.
- Intégration Marketplace → Catalog : réponses métier, conflit de réservation,
  indisponibilité upstream, timeout.
- RabbitMQ : publication/consommation de vrais messages, corrélation
  `eventId` et preuve de déduplication.

Les scripts M4 et M5 déjà présents peuvent servir de base, mais leur
réutilisation doit rester indépendante d'un cluster M7 existant.

## M8-C — E2E, sécurité et résilience (à implémenter)

- DON/TROC avec base jetable, transactions et statuts vérifiés en base
  **de leur propre service** ;
- cas 401, 403, 404, 409 et tentatives d'opérations d'un autre propriétaire ;
- arrêt/reprise Catalog, RabbitMQ, Keycloak et Notification selon des
  scénarios isolés, sans effet sur le déploiement de démonstration ;
- test de non-régression sur `sub` Keycloak après redémarrage ;
- rapport de preuves par parcours, résultats observés et limites.

## Environnement et prudence disque

Le dernier test de charge M7 avait saturé le Codespace (93 %), puis le
nettoyage ciblé a ramené le disponible à ~3,7 Go. Les gates légères
`m8:contracts:validate` tournent en CI GitHub sans reconstruire 12 images.
Les E2E seront validés dans un environnement **jetable** disposant d'un
stockage suffisant. Ne pas détruire les PVC Minikube de M7 pour M8.

## Règle de progression

M8-A ne vaut **pas** M8 DONE. Chaque sous-étape sera mise à jour dans
l'issue #44 après preuve GitHub Actions ou logs de tests live. Fusionner M8
dans `main` seulement après les gates prévues et une validation explicite.
