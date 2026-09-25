# Quality Gates et preuves

## M1 — Couverture

Objectif initial : **≥ 80 % de couverture de lignes sur le backend métier**.

Preuve : rapport de couverture produit par la CI.

## M2 — Qualité statique

Objectif :
- lint : 0 erreur ;
- typecheck : 0 erreur ;
- 0 anomalie bloquante/critique dans l'outil d'analyse statique retenu.

Preuve : logs et rapport CI.

## M3 — Vulnérabilités

Objectif : **0 vulnérabilité Critical/High non acceptée** sur les dépendances et l'image livrée.

Preuve : rapports d'audit et Trivy.

## M4 — Performance

Objectif initial : **p95 < 500 ms** sur le scénario JMeter de référence.

Le protocole de charge doit documenter :
- environnement ;
- nombre d'utilisateurs/threads ;
- ramp-up ;
- durée ;
- endpoints ;
- débit ;
- taux d'erreur ;
- p50/p95/p99 si disponibles ;
- limites de l'interprétation.

## Dette technique

Toute dérogation à un Quality Gate doit être explicite, justifiée et rattachée à une issue de remédiation. Une dégradation répétée doit être traitée avant l'ajout de nouvelles fonctionnalités.

## Politique de preuve

Une affirmation de soutenance doit être accompagnée d'au moins un des éléments suivants :

- test reproductible ;
- rapport CI ;
- log ;
- métrique ;
- capture d'état ;
- configuration versionnée ;
- démonstration ;
- décision d'architecture documentée.
