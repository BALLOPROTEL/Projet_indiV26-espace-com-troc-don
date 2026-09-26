# Roadmap GitHub — Projet_individuel26

Cette page relie le cadrage technique au backlog GitHub.

## LOT 0 — Initialisation

Epic : [#19](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/19)

- [x] [#1 — Structure du dépôt](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/1)
- [x] [#2 — Cadrage, architecture et Quality Gates](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/2)
- [x] [#3 — Conventions Git et templates](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/3)
- [x] [#4 — CI de bootstrap](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/4)
- [ ] [#5 — Kanban GitHub Project](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/5)
- [ ] [#6 — Protection de main](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/6)
- [ ] [#7 — Environnement local](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/7)
- [ ] [#8 — Gate de sortie LOT 0](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/8)

## Backlog macro

| Lot | Issue | Objectif |
|---|---|---|
| LOT 1 | [#9](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/9) | API, PostgreSQL, Prisma, health checks |
| LOT 2 | [#10](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/10) | Keycloak / OIDC / RBAC |
| LOT 3 | [#11](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/11) | Annonces troc/don et modération |
| LOT 4 | [#12](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/12) | Tests et Quality Gates |
| LOT 5 | [#13](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/13) | Docker, scans, GHCR |
| LOT 6 | [#14](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/14) | Kubernetes / TLS / HPA |
| LOT 6B | [#26](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/26) | Frontend Next.js / UX / Keycloak PKCE |
| LOT 7 | [#15](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/15) | Observabilité |
| LOT 8 | [#16](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/16) | JMeter et expérimentations |
| LOT 9 | [#17](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/17) | Audit sécurité et remédiation |
| LOT 10 | [#18](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/18) | Preuves, soutenance, vidéo |

## Workflow Kanban prévu

`Backlog → Ready → In Progress → Review → Done`

Règle de pilotage :
- une issue non priorisée reste en **Backlog** ;
- l'issue suivante réellement exécutable passe en **Ready** ;
- une seule grosse tâche de développement doit être **In Progress** à la fois ;
- une PR ouverte fait passer l'item en **Review** ;
- **Done** exige la Definition of Done et les preuves attendues.

## État actuel

- LOT 0 : **Done**
- LOT 1 : **Done**
- LOT 2 : **Done**
- LOT 3 : **Done**
- LOT 4 : **Done**
- LOT 5 : **Done**
- LOT 6 : **Done**
- LOT 6B : **Done**
- LOT 7 : **In Progress**
- LOT 8 à LOT 10 : **Backlog**
