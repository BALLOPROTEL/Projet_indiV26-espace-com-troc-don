# Security policy — POC

## Baseline

Le POC applique les principes suivants :

- authentification centralisée via Keycloak/OIDC ;
- autorisation RBAC et contrôles d'appartenance sur les ressources ;
- secrets de déploiement hors du dépôt Git ;
- validation des entrées côté API ;
- scans de dépendances et d'images ;
- journalisation sans mot de passe, token ni secret ;
- TLS au niveau de l'Ingress ou de la cible de déploiement ;
- principe du moindre privilège pour les conteneurs et comptes techniques ;
- métriques protégées par un token interne dans le déploiement Kubernetes ;
- Swagger désactivé par défaut en production ;
- stockage objet privé S3-compatible pour les images ;
- credentials S3 applicatifs séparés des credentials root MinIO ;
- validation taille, MIME et signature binaire des images avant stockage.

## Credentials de démonstration locale

Le realm Keycloak et `compose.yaml` contiennent des credentials **strictement destinés au laboratoire local**.

Ils sont :
- liés à des services exposés uniquement sur `127.0.0.1` dans le compose ;
- associés à des utilisateurs de démonstration ;
- interdits de réutilisation dans une cible réelle.

Ils ne doivent jamais être remplacés dans Git par des secrets de production.

## Vulnérabilités

Les vulnérabilités et risques constatés pendant le projet sont documentés et priorisés dans `docs/14-lot9-security-audit.md`.

Une vulnérabilité Critical/High non corrigée doit faire l'objet d'une acceptation explicite et justifiée avant livraison du POC.

## Audit reproductible

```bash
pnpm security:audit:static
pnpm security:audit
```

La CI complète ces contrôles avec l'audit des dépendances, le smoke test de l'image et Trivy HIGH/CRITICAL.

## Périmètre

Ce dépôt est un projet pédagogique. Il ne doit pas être présenté comme une plateforme certifiée ou prête à la production sans les contrôles complémentaires décrits dans la documentation, notamment NetworkPolicy et rate limiting distribué.
