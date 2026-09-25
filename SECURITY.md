# Security policy — POC

## Baseline

Le POC applique les principes suivants :

- authentification centralisée via Keycloak/OIDC ;
- autorisation RBAC et contrôles d'appartenance sur les ressources ;
- secrets hors du dépôt Git ;
- validation des entrées côté API ;
- scans de dépendances et d'images ;
- journalisation sans mot de passe, token ni secret ;
- TLS au niveau de l'Ingress ou de la cible de déploiement ;
- principe du moindre privilège pour les conteneurs et comptes techniques.

## Vulnérabilités

Les vulnérabilités constatées pendant le projet sont documentées et priorisées dans le plan de remédiation. Une vulnérabilité Critical/High non corrigée doit faire l'objet d'une acceptation explicite et justifiée avant livraison du POC.

## Périmètre

Ce dépôt est un projet pédagogique. Il ne doit pas être présenté comme une plateforme e-commerce certifiée ou prête à la production sans les contrôles complémentaires décrits dans la documentation.
