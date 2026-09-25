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

- LOT 0 — Initialisation du projet
- LOT 1 — Base technique
- LOT 2 — Identité et RBAC
- LOT 3 — Verticale métier troc/don
- LOT 4 — Qualité et tests
- LOT 5 — Supply chain / Docker / scans
- LOT 6 — Kubernetes
- LOT 7 — Observabilité
- LOT 8 — Charge et expérimentations
- LOT 9 — Audit sécurité et remédiation
- LOT 10 — Consolidation des preuves et soutenance

Le backlog GitHub constitue la source de vérité pour l'avancement.

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

La structure, les conventions, la documentation de cadrage, les issues et la CI de bootstrap sont initialisées avant le développement métier.
