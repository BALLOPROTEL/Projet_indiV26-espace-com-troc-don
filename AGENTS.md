# Projet individuel 26 — conventions pour les agents de développement

Ce dépôt est une application **Next.js 16 / React 19 / TypeScript** connectée à un backend microservices NestJS, Gateway, Keycloak et MinIO.

## Travail GitHub
- Associer chaque changement fonctionnel à une issue de l'Epic Frontend V2 #63 et travailler sur une branche dédiée.
- Exécuter lint, typecheck, tests, CI E2E réelles et obtenir une revue Codex ; corriger les remarques avant une nouvelle revue.
- **Ne jamais fusionner ni activer l'auto-merge sans accord explicite du propriétaire.**
- Ne pas lancer de nettoyage destructif en Codespaces, ni modifier les PVC / volumes utilisateur.
- Ne pas entamer la consolidation des preuves ni la préparation des slides tant que le frontend V2 n'est pas validé.

## UI et qualité
Pour toute création ou revue d'interface, appliquer les trois skills projet disponibles dans `.agents/skills/` :
- `emil-design-eng` : hiérarchie, cohérence des composants, feedback et animations sobres.
- `mobile-native` : interactions tactiles, inputs 16px, responsive, clavier mobile et test sur vrai téléphone.
- `break-ui` : états vides/erreurs, nombres élevés, textes longs, traductions et zoom 200 %. Les fixtures et interrupteurs de test sont uniquement pour le développement.
Documenter les observations réelles ; distinguer analyse statique, émulation Chrome et essai sur appareil physique.

## Règles métier et sécurité
- Les chiffres proviennent des API effectives ; jamais de métriques, profils, images ou actions mockup inventés en production.
- Les rôles USER, MODERATOR et ADMIN sont affichés par la navigation, mais **les droits sont obligatoirement appliqués côté backend** (JWT + rôles + ownership).
- Préserver publication, galerie MinIO autorisée, demandes DON/TROC, double confirmation et modération.
- Les routes admin sont strictement limitées aux contrats existants ; pas de Keycloak Admin secret dans le navigateur.
- Éviter de modifier les interfaces en cours de validation sans un test de non-régression et une nouvelle revue.
