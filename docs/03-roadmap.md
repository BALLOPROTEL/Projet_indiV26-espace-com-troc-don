# Roadmap GitHub — Projet_individuel26

Cette page relie le cadrage technique au backlog GitHub.

## LOT 0 — Initialisation

Epic : [#19](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/19)

- [x] [#1 — Structure du dépôt](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/1)
- [x] [#2 — Cadrage, architecture et Quality Gates](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/2)
- [x] [#3 — Conventions Git et templates](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/3)
- [x] [#4 — CI de bootstrap](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/4)
- [x] [#5 — Kanban GitHub Project](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/5)
- [x] [#6 — Protection de main](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/6)
- [x] [#7 — Environnement local](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/7)
- [x] [#8 — Gate de sortie LOT 0](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/8)

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
| LOT 9B | [#35](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/35) | Parcours métier réel : images, don, troc et transactions |
| LOT 10 | [#18](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/18) | Preuves, soutenance, vidéo |

## Workflow Kanban prévu

`Backlog → Ready → In Progress → Review → Done`

Règle de pilotage :
- une issue non priorisée reste en **Backlog** ;
- l'issue suivante réellement exécutable passe en **Ready** ;
- une seule grosse tâche de développement doit être **In Progress** à la fois ;
- une PR ouverte fait passer l'item en **Review** ;
- **Done** exige la Definition of Done et les preuves attendues.

## État réel — audit du 12 octobre 2026

| Lot ou jalon | Statut | Preuve |
| --- | --- | --- |
| LOT 0–5 | **Done** | Issues historiques #19, #9–#13 clôturées |
| LOT 6–6B | **Done** | #14 / #26 clôturées : Kubernetes, TLS, HPA, Next.js |
| LOT 7–9 | **Done** | #15–#17 clôturées : observabilité, JMeter, sécurité |
| LOT 9B-A/B/C | **Done** | PR #36, #38, #40 fusionnées |
| M0–M4 | **Done** | PR #47, #48 et #49 fusionnées |
| M5–M7 | **Done** | PR #50, #51 et #52 fusionnées |
| M8 | **Done** | PR #53 fusionnée |
| M9 / LOT 9B-D/E | **Done** | PR #54 fusionnée (commit d29d499), Chrome 2 comptes |
| LOT 9B-F | **Ready** | #56 — certification finale de #35 ; pas encore achevée |
| M10 / LOT 10 | **Backlog** | #57, #58, #59 ; pilotage #44 et #18 |

### Plan d'exécution approuvé

| Ordre | Issue | Domaine | Statut cible Kanban |
| --- | --- | --- | --- |
| 1 | [#55](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/55) | Documentation / synchronisation des issues et Kanban | **In Progress** |
| 2 | [#56](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/56) | LOT 9B-F : recette intégrée avec vrais médias | **Ready** |
| 3 | [#57](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/57) | M10 : architecture, diagrammes, séquences | **Backlog** |
| 4 | [#58](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/58) | LOT 10-A : dossier de preuves | **Backlog** |
| 5 | [#59](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/59) | LOT 10-B : support, répétition, vidéo | **Backlog** |

Les statuts ci-dessus sont le **plan documentaire** ; leur application aux colonnes du GitHub Project nécessite une mise à jour spécifique du board (non pilotée par le connecteur GitHub Issues).

### Références de certification

- PR #54 : https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/pull/54
- M9 4/4 CI SUCCESS : [Bootstrap #38090618276](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/actions/runs/38090618276), [Contracts #38090618272](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/actions/runs/38090618272), [Chrome #38090618298](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/actions/runs/38090618298), [Web #38090618285](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/actions/runs/38090618285).
- CI post-fusion `main` : [#38091686672](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/actions/runs/38091686672) **SUCCESS**.
- Les derniers E2E Chrome ont certifié des fixtures métier jetables, mais pas encore le parcours complet depuis l'upload de **5–8 images** : rester vigilant pour #56.

### Règle de travail

Une seule grosse tâche de développement est en cours à la fois. Ne pas bloquer la conversation pour les CI longues : la PR et le lien des runs sont transmis dès le lancement ; les résultats sont vérifiés sur demande.
