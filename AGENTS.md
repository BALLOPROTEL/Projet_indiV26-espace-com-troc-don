# Projet individuel 26 — conventions pour les agents de développement

Ce dépôt est une application **Next.js 16 / React 19 / TypeScript** connectée à un backend microservices NestJS, Gateway, Keycloak et MinIO.

## Travail GitHub
- Associer chaque changement fonctionnel à une issue de l'Epic Frontend V2 #63 et travailler sur une branche dédiée.
- Exécuter lint, typecheck, tests, CI E2E réelles et obtenir une revue Codex ; corriger les remarques avant une nouvelle revue.
- **Ne jamais fusionner ni activer l'auto-merge sans accord explicite du propriétaire.**
- Ne pas lancer de nettoyage destructif en Codespaces, ni modifier les PVC / volumes utilisateur.
- Ne pas entamer la consolidation des preuves ni la préparation des slides tant que le frontend V2 n'est pas validé.

## UI et qualité
Choisir les skills projet dans `.agents/skills/` **selon la tâche**, et non les déclencher automatiquement tous les trois :
- `emil-design-eng` : conception, implémentation et critique visuelle explicite (hiérarchie, composants, feedback, motion sobre).
- `mobile-native` : création/évaluation d'une interface tactile, responsive, écran mobile ou PWA ; inputs d'au moins 16px et essai sur appareil physique.
- `break-ui` : **uniquement** sur demande explicite de stress test, données extrêmes ou implémentation de cas limites. Ses fixtures et son toggle sont exclusivement dev/test, jamais en production.

**Revue native Codex (`@codex review`, `@codex security review`) :**
- Traiter le diff en lecture seule, sans créer de toggle, fixtures ou correctifs avant la fin de la revue ; examiner les risques UX et valeurs extrêmes si pertinent.
- Respecter le format natif structuré imposé par l'outil de revue (notamment JSON lorsqu'exigé). L'obligation de tableau Markdown `Before | After | Why` du skill `emil-design-eng` s'applique aux critiques de design rédigées pour un humain, **pas** au transport de revue Codex.

**Précautions locales prioritaires sur les exemples génériques des skills :**
- Pour les safe areas, **additionner** l'inset à l'espacement existant : `padding-top: calc(12px + env(safe-area-inset-top, 0px))`, `padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px))`. Ne jamais remplacer un padding de base par `env(...)` seul.
- Si un texte est tronqué, rendre sa version complète consultable par **toucher et clavier** : lien de détail, expansion visible ou tooltip accessible au focus et au survol. Un simple attribut HTML `title` **ne suffit pas**.
- Préserver le zoom utilisateur, le focus visible et les cibles tactiles de 44px quand cela est applicable.

Documenter les observations réelles ; distinguer analyse statique, émulation Chrome et essai sur appareil physique.

## Règles métier et sécurité
- Les chiffres proviennent des API effectives ; jamais de métriques, profils, images ou actions mockup inventés en production.
- Les rôles USER, MODERATOR et ADMIN sont affichés par la navigation, mais **les droits sont obligatoirement appliqués côté backend** (JWT + rôles + ownership).
- Préserver publication, galerie MinIO autorisée, demandes DON/TROC, double confirmation et modération.
- Les routes admin sont strictement limitées aux contrats existants ; pas de Keycloak Admin secret dans le navigateur.
- Éviter de modifier les interfaces en cours de validation sans un test de non-régression et une nouvelle revue.
