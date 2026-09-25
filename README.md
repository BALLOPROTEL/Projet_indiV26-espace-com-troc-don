# Projet_individuel26 — Espace communautaire de troc & don

POC individuel réalisé dans le cadre du bloc **« Superviser et assurer le développement des applications logicielles »**.

## Objectif

Démontrer une verticale métier complète et industrialisée : un utilisateur authentifié publie une annonce de **troc** ou de **don**, puis un modérateur l'approuve ou la refuse avant publication.

Le projet est volontairement limité fonctionnellement afin de concentrer l'évaluation sur la qualité d'ingénierie : architecture, sécurité, tests, CI/CD, conteneurisation, orchestration, observabilité, montée en charge, audit et remédiation.

## Périmètre V1

- Authentification et rôles `USER`, `MODERATOR`, `ADMIN`
- Création d'une annonce
- Statuts `PENDING`, `APPROVED`, `REJECTED`
- Modération
- Consultation publique des annonces approuvées
- Tests automatisés
- CI/CD
- Docker + Kubernetes
- Observabilité
- Tests de charge
- Analyse de sécurité et plan de remédiation

## Architecture cible

- Frontend : Next.js / React
- Backend : NestJS
- ORM : Prisma
- Base de données : PostgreSQL
- Identity Provider : Keycloak / OIDC / RBAC
- CI/CD : GitHub Actions
- Registry : GHCR
- Conteneurs : Docker
- Orchestration : Kubernetes / Minikube pour le POC
- Observabilité : Prometheus + Grafana
- Charge : JMeter
- Sécurité supply-chain : Trivy + audit des dépendances

Voir [docs/01-architecture.md](docs/01-architecture.md).

## Quality Gates initiaux

1. Couverture backend métier ≥ 80 %
2. 0 erreur lint/typecheck et 0 anomalie bloquante/critique de l'analyse statique retenue
3. 0 vulnérabilité Critical/High non acceptée dans les dépendances ou l'image livrée
4. Objectif initial de latence p95 < 500 ms sur le scénario de référence documenté

Les seuils sont des **objectifs de cadrage** : toute modification doit être justifiée par des mesures réelles.

## Stratégie Git

- `main` : branche de référence
- Une branche courte par issue : `feat/<issue>-...`, `fix/<issue>-...`, `chore/<issue>-...`, `docs/<issue>-...`
- Pull Request avant intégration des changements applicatifs
- Conventional Commits recommandés
- Une PR doit référencer l'issue associée et fournir les preuves utiles

Voir [CONTRIBUTING.md](CONTRIBUTING.md).

## Roadmap

- [EPIC LOT 0 — Initialisation #19](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/19)
- LOT 1 — Base technique : [#9](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/9)
- LOT 2 — Identité et RBAC : [#10](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/10)
- LOT 3 — Verticale métier troc/don : [#11](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/11)
- LOT 4 — Qualité et tests : [#12](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/12)
- LOT 5 — Supply chain / Docker / scans : [#13](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/13)
- LOT 6 — Kubernetes : [#14](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/14)
- LOT 7 — Observabilité : [#15](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/15)
- LOT 8 — Charge et expérimentations : [#16](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/16)
- LOT 9 — Audit sécurité et remédiation : [#17](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/17)
- LOT 10 — Consolidation des preuves et soutenance : [#18](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/18)

Voir la vue détaillée dans [docs/03-roadmap.md](docs/03-roadmap.md).

## Structure cible

```text
.
├── apps/
│   ├── api/
│   └── web/
├── docs/
├── infra/
│   └── k8s/
├── tests/
│   └── load/
├── .github/
│   ├── ISSUE_TEMPLATE/
│   └── workflows/
└── README.md
```

## État actuel

**LOT 0 — Initialisation : EN COURS**

Déjà réalisé :
- structure du dépôt ;
- cadrage, architecture et Quality Gates ;
- conventions Git et templates ;
- baseline sécurité ;
- backlog LOT 1 → LOT 10 ;
- CI de bootstrap : **verte**.

Restent avant le GO LOT 1 :
- GitHub Project / Kanban ;
- protection de `main` ;
- environnement local de développement ;
- revue finale du gate LOT 0.
