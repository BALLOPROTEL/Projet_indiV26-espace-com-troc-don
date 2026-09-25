# Cadrage technique — Projet_individuel26

## Mission

Agir comme Lead Developer et démontrer la conception, le développement, la livraison et l'analyse d'une V1 sécurisée de la plateforme de La Petite Maison de l'Épouvante.

## Verticale métier retenue

Un utilisateur authentifié publie un objet à échanger ou donner. L'annonce démarre en `PENDING`. Un `MODERATOR` ou `ADMIN` peut l'approuver ou la refuser. Seules les annonces `APPROVED` sont exposées publiquement.

## User Stories principales

### US-01 — Authentification

En tant qu'utilisateur, je veux m'authentifier afin d'accéder aux fonctionnalités protégées.

Acceptation :
- non authentifié sur route protégée → 401 ;
- utilisateur valide sur route autorisée → succès ;
- USER sur route de modération → 403.

### US-02 — Création d'annonce

En tant qu'utilisateur authentifié, je veux publier un objet à échanger ou donner.

Acceptation :
- champs obligatoires validés ;
- persistance PostgreSQL ;
- statut initial `PENDING` ;
- rattachement au propriétaire.

### US-03 — Modération

En tant que modérateur, je veux approuver ou refuser une annonce.

Acceptation :
- seuls MODERATOR/ADMIN peuvent agir ;
- approbation → `APPROVED` ;
- refus → `REJECTED` ;
- action journalisée.

### US-04 — Consultation

En tant que visiteur ou utilisateur, je veux consulter les annonces approuvées.

Acceptation :
- aucune annonce `PENDING` ou `REJECTED` n'est exposée ;
- récupération bornée/paginée.

## Hors périmètre V1

Paiement réel, synchronisation complète des stocks, recommandation IA, chat complet, streaming, enchères et certification RGAA complète.

## Décisions structurantes

- monolithe modulaire pour la V1 ;
- NestJS + Prisma + PostgreSQL ;
- Next.js pour le frontend ;
- Keycloak pour OIDC/RBAC ;
- GitHub Actions + GHCR ;
- Docker + Kubernetes ;
- Prometheus/Grafana ;
- JMeter ;
- Trivy.

## Quality Gates

- couverture backend métier ≥ 80 % ;
- 0 erreur lint/typecheck ;
- 0 anomalie bloquante/critique de l'analyse statique retenue ;
- 0 Critical/High non acceptée dans les dépendances/images ;
- objectif initial p95 < 500 ms sur le scénario de charge de référence.

## Lots

LOT 0 à LOT 10 sont suivis sous forme d'issues GitHub. Les résultats, preuves et décisions doivent être attachés au lot correspondant.
