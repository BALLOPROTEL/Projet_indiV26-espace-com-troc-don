# Roadmap GitHub — Projet_individuel26

Cette page relie le cadrage technique au backlog GitHub.

## État courant — 21 novembre 2026

La trajectoire historique LOT 0–10 reste conservée ci-dessous, mais le développement actif a évolué vers la **V2 plateforme 2-en-1**.

### Candidate actuelle

- **PR #166 — consolidation V2 vers `main`** ;
- branche : `chore/165-v2-consolidation` ;
- base fonctionnelle : refonte 24 écrans + DON/TROC + Boutique + Commerce + Stripe test ;
- réconciliation manuelle de #146 SEO, #147 profil Keycloak et #148 conversations privées ;
- aucune fusion sans accord explicite propriétaire.

### Fonctionnalités V2 livrées dans la candidate

- [x] refonte visuelle 24 écrans / design system ;
- [x] DON/TROC, modération, transactions, double confirmation ;
- [x] favoris persistés ;
- [x] notifications personnelles ;
- [x] profil Keycloak enrichi et Account Console ;
- [x] conversations privées Marketplace + UI `/messages` ;
- [x] catalogue Produit / variantes / images / admin ;
- [x] panier Commerce ;
- [x] commandes et historique ;
- [x] réservation atomique de stock ;
- [x] Stripe Checkout test + webhook signé ;
- [x] SEO dynamique des annonces.

### Restes prioritaires

1. certifier #166 avec les workflows complets vers `main` ;
2. recette manuelle Stripe test de bout en bout ;
3. consolidation / fermeture des anciennes PR empilées après validation ;
4. mise à jour finale issues/Kanban/branches ;
5. conformité légale #112 avant publication publique ;
6. backend Contact si retenu ;
7. backend éditorial Fanzines/Festival si retenu ;
8. préférences applicatives utilisateur si retenues ;
9. tag/release V2 après validation finale.

Les éléments de production avancée (NetworkPolicy, rôles SQL distincts, HA, sauvegardes, outbox généralisée, observabilité multi-services) restent des axes d’industrialisation et non des preuves acquises.

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

## État réel — actualisé au 18 novembre 2026

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
| LOT 9B-F | **Done** | Kit final + recette Chrome réelle #129 + journal de preuve #130 ; #56/#35 fermés |
| M10 | **Done** | #57 fermée — six diagrammes Mermaid et runbook intégrés |
| Frontend V2 F0–F5 | **Done** | PR #72–#77 fusionnées : UX, 6 annonces/page, MinIO, modération, ADMIN |
| Frontend V2/V3/V4 | **Review — desktop validé, recette physique restante** | UX V4 #105/#106 intégrée ; validation propriétaire desktop acquise ; #71 ouverte pour iOS/Android, zoom/clavier/accessibilité |
| Frontend V2 F6 | **Backlog facultatif** | #70 — fonctionnalités supplémentaires hors périmètre minimal |
| LOT 9B-F kit jury | **Done** | #56 fermé ; 4 acteurs, 4 annonces, 20 médias, DON/TROC/RBAC certifiés |
| LOT 10-A/B | **Backlog bloqué par #71** | #58/#59 démarrent après la recette physique/accessibilité |

### Plan d'exécution approuvé

| Ordre | Issue | Domaine | Statut cible Kanban |
| --- | --- | --- | --- |
| 1 | [#55](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/55) | Documentation / synchronisation des issues et Kanban | **In Progress** |
| 2 | [#56](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/56) / [#35](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/35) | LOT 9B-F : recette finale et preuve versionnées | **Done** |
| 3 | [#57](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/57) | M10 : six diagrammes et runbook intégrés | **Done** |
| 3B | [#63](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/63) / [#71](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/71) / [#85](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/85) | Frontend V2/V3/V4 intégré ; validation desktop acquise ; recette physique restante | **Review** |
| 4 | [#58](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/58) | LOT 10-A : dossier de preuves | **Backlog** |
| 5 | [#59](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/59) | LOT 10-B : support, répétition, vidéo | **Backlog** |

Les statuts ci-dessus sont le **plan documentaire** ; leur application aux colonnes du GitHub Project nécessite une mise à jour spécifique du board (non pilotée par le connecteur GitHub Issues).

### Références de certification

- PR #54 : https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/pull/54
- M9 4/4 CI SUCCESS : [Bootstrap #38090618276](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/actions/runs/38090618276), [Contracts #38090618272](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/actions/runs/38090618272), [Chrome #38090618298](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/actions/runs/38090618298), [Web #38090618285](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/actions/runs/38090618285).
- CI post-fusion `main` : [#38091686672](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/actions/runs/38091686672) **SUCCESS**.
- Le dernier E2E Chrome sur [PR #61](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/pull/61) **a certifié la publication depuis l'interface, l'upload de cinq images par annonce, la modération privée, le DON/TROC et la double confirmation** : [Bootstrap #38313602241](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/actions/runs/38313602241) et [E2E #38313602213](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/actions/runs/38313602213) SUCCESS. L'archivage des captures est indépendant d'Actions. Les données crédibles du jury ont été préparées, autorisées puis exécutées dans la recette finale #129 ; la preuve est versionnée via #130.

### Règle de travail

Une seule grosse tâche de développement est en cours à la fois. Ne pas bloquer la conversation pour les CI longues : la PR et le lien des runs sont transmis dès le lancement ; les résultats sont vérifiés sur demande.

### Priorités confirmées le 18 novembre 2026

**Recette physique/accessibilité #71 → dossier de preuves #58 → soutenance #59 → tag/release jury final.**

Le kit jury est certifié et LOT 9B est fermé. #80 est également fermé via #131. La seule gate avant LOT 10 est #71 ; #58/#59 restent Backlog jusqu'à sa fermeture. Le Project V2 natif reste à synchroniser via #55 ; les statuts documentés ne doivent pas être confondus avec une mutation effective du Board.

Architecture M10 : [six diagrammes](24-m10-architecture-finale.md) et [runbook d'exploitation](25-m10-operations-limits.md). Les statuts de ce fichier **ne constituent pas une mise à jour des colonnes GitHub Projects V2**.
