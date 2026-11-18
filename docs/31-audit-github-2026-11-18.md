> **Mise à jour post-audit — 18 novembre 2026 :** depuis la photographie initiale ci-dessous, LOT 9B (#35/#56), #80 et #98 ont été fermés. Les branches ont été nettoyées jusqu'à `main` uniquement avant ouverture de #134. La seule gate produit avant LOT 10 est #71 ; le GitHub Projects V2 natif reste le seul blocage de gouvernance #55.

# Audit GitHub et état projet — 18 novembre 2026

## Verdict

Le cœur applicatif est **livré dans `main`** : architecture microservices M0–M10, parcours DON/TROC, galerie MinIO, modération, RBAC Keycloak, RabbitMQ/Notification, Docker Compose, Kubernetes, observabilité/performance, frontend V2 puis UX V3/V4 et kit jury avec 20 médias autorisés.

Le projet n'est toutefois **pas encore à clôturer**. La situation a évolué après cet audit initial :

- **#56 / #35 sont fermés** : la recette jury finale a été exécutée via #129 et consignée via #130.
- **#80 est fermé** : le fallback registre a été reconstruit puis fusionné via #131.
- **#98 est fermé** : le vrai Keycloak a été revalidé desktop/mobile.
- La seule gate fonctionnelle restante avant LOT 10 est **#71 — recette physique/accessibilité**.

Après #71 : **#58 dossier de preuves**, puis **#59 support 20 min, répétition et vidéo de secours**.

## État du code livré

### Fonctionnel / métier

- Authentification OIDC/PKCE Keycloak et rôles `USER`, `MODERATOR`, `ADMIN`.
- Catalogue DON/TROC et modération `PENDING / APPROVED / REJECTED`.
- Disponibilité séparée `AVAILABLE / RESERVED / COMPLETED`.
- Galerie 5–8 images via MinIO et contrôles MIME/taille/signature.
- TROC avec souhaits et sélection d'une contrepartie.
- Propositions DON/TROC, acceptation/refus, réservations et double confirmation.
- Notifications RabbitMQ, persistance PostgreSQL et déduplication côté consommateur.
- Frontend Next.js : catalogue 6/page, fiche galerie, espace membre, modération, dashboard ADMIN.
- UX V3/V4 intégrée ; validation propriétaire desktop VISITEUR/USER/MODERATOR/ADMIN acquise.

### Architecture / exploitation

- API Gateway.
- Catalog Service.
- Marketplace Service.
- Notification Service.
- Legacy API conservée temporairement dans le modèle Strangler.
- PostgreSQL par ownership logique de schémas.
- RabbitMQ, MinIO, Keycloak.
- Docker Compose / Codespaces.
- Kubernetes kind/Minikube.
- Prometheus/Grafana.
- JMeter/HPA et documentation M10.

### Qualité / DevSecOps

- lint, typecheck, tests unitaires, intégration et E2E.
- tests de contrats microservices.
- recettes Chrome avec comptes Keycloak.
- Trivy et audit de dépendances.
- protection de `main`.
- revue Codex utilisée sur les PR critiques.

## Kit jury

Les PR #125, #126 et #127 ont finalisé le kit :

- 20/20 médias présents ;
- 20/20 entrées de provenance ;
- 20/20 `authorizedForDemo: true` ;
- 20/20 `creditId` liés ;
- manifeste `READY_FOR_REVIEW` ;
- restriction Benro `personality rights` conservée ;
- runbook et compte rendu de recette technique/documentaire ;
- procédure de relance non destructive.

Gates déjà acquises : Jury demo offline #52, Bootstrap #545/#546/#547 et revues Codex associées. La recette navigateur **avec le dataset final** reste la preuve finale à produire.

## Inventaire GitHub

### Branche principale

- `main` est protégée.
- SHA de référence au début de cet audit : `1745f3e3973219ce72f710b0845ffa900a83ae90`.

### Pull Requests

Après nettoyage :

- **#100** — ouverte mais repassée en **Draft**. Le correctif ECR Public reste pertinent, mais la branche est ancienne et doit être rafraîchie depuis le `main` courant avant toute fusion.
- **#101** — fermée comme obsolète/supersédée par l'état du 18/11.

Aucune autre PR fonctionnelle n'est ouverte au moment de l'audit.

### Branches hors `main`

Branches présentes au début de l'audit :

- `chore/56-jury-assets-44275503639`
- `docs/github-audit-hygiene-20261113`
- `feat/56-jury-demo-kit-plan`
- `fix/80-bootstrap-registry-fallback`
- `fix/96-keycloak-password-input-group`
- `ops/jury-assets-acquire`

Classification :

| Branche | Décision |
| --- | --- |
| `fix/80-bootstrap-registry-fallback` | **Supprimée après remplacement de #100 par #131** |
| `docs/github-audit-hygiene-20261113` | **À supprimer** après fermeture de #101 |
| `feat/56-jury-demo-kit-plan` | **À supprimer** — #84 fermée et kit final livré via #125–#127 |
| `fix/96-keycloak-password-input-group` | **À supprimer** — supersédée par #99 fusionnée |
| `chore/56-jury-assets-44275503639` | **À supprimer** — branche opérationnelle d'acquisition, médias finaux déjà dans `main` |
| `ops/jury-assets-acquire` | **À supprimer** si aucun nouveau cycle d'acquisition n'est requis — kit final autorisé dans `main` |

La branche de ce présent audit est temporaire et doit également être supprimée après fusion de sa PR.

### Tags et Releases

- Tag existant : `baseline-2026-10-19` → `8a248fa7366b52341c79ace52cffdb63121c1352`.
- Releases GitHub : **aucune**.

Cette absence de Release reste cohérente : LOT 9B est fermé mais #71 reste ouverte. Le prochain tag/release doit correspondre à la version réellement validée après recette physique/accessibilité.

## Issues ouvertes et statut cible

| Issue | Statut cible | Motif |
| --- | --- | --- |
| #55 | In Progress | Project V2 natif + dernières branches |
| #56 | Done | recette jury finale #129/#130 terminée |
| #35 | Done | LOT 9B clôturé |
| #63 | Review | frontend livré, dépend de #71 |
| #71 | Review | recette physique/accessibilité |
| #85 | Review | UX livrée, finition humaine |
| #98 | Done | Keycloak réel revalidé via recette #129 |
| #80 | Done | #131 fusionnée, fallback registre intégré |
| #18 | Backlog | LOT 10 après recettes |
| #58 | Backlog | dossier de preuves |
| #59 | Backlog | support/répétition/vidéo |
| #70 | Backlog post-MVP | fonctionnalités facultatives |
| #110 | Backlog post-jury | Epic conformité/compte/SEO/qualité/sécurité |
| #111 | Backlog post-jury | comptes/conversations |
| #112 | Backlog post-jury | conformité légale |
| #113 | Backlog post-jury | SEO |
| #114 | Backlog post-jury | qualité web globale |
| #115 | Backlog post-jury | durcissement sécurité web |

## Kanban GitHub Projects V2

Matrice attendue :

- **In Progress** : #55 uniquement (Project V2 natif).
- **Review** : #63, #71, #85.
- **Backlog** : #18, #58, #59, #70, #110–#115.
- **Done** : tous les lots et sous-issues déjà fermés/fusionnés, notamment M0–M10, F0–F5, développement F7 automatisé, UX V4 #104 et sécurité #102.

**Limitation vérifiée :** la connexion GitHub disponible dans cette session ne permet pas la mutation du champ `Status` d'un GitHub Project V2. Les issues et la roadmap portent donc la matrice exacte, mais le déplacement visuel des cartes doit être effectué avec une session GitHub autorisée au Project V2 avant de fermer #55.

## Dette technique encore ouverte

### #80 — ECR Public

Le workflow Bootstrap courant utilise toujours PostgreSQL et RabbitMQ comme `jobs.services` depuis ECR Public. Le risque de quota avant checkout n'est donc pas supprimé structurellement.

La PR #100 avait démontré un fallback ECR Public → Docker Hub officiel et une exécution Bootstrap réussie, mais son HEAD est désormais ancien. Elle a été repassée en Draft ; il faut repartir du `main` courant et revalider.

### Architecture volontairement non production

Les limites M10 restent assumées : Legacy fallback, PostgreSQL partagé en laboratoire, NetworkPolicy/rate limiting distribué incomplets, outbox seulement partielle, environnement Keycloak de démonstration. Elles doivent être présentées comme limites, pas masquées.

## Ordre de travail recommandé

1. Terminer **#71** : recette physique/accessibilité.
2. Constituer **#58** : dossier de preuves.
3. Préparer **#59** : présentation, répétition, vidéo de secours.
4. Créer seulement alors un tag/release de version jury validée.
5. Traiter le backlog post-MVP #70/#110–#115 après la soutenance.

## Mutations effectuées pendant cet audit

- #101 fermée comme obsolète.
- #100 repassée en Draft et annotée.
- Issues principales mises à jour avec un état de référence du 18/11/2026.
- README et roadmap réalignés sur le projet actuel via la PR documentaire de cet audit.
- Matrice Kanban cible documentée.
- Tags/releases/branches inspectés et politique de nettoyage documentée.

Les suppressions de branches, la création de tags/releases et les déplacements natifs GitHub Projects V2 ne sont pas annoncés comme réalisés lorsque l'outil connecté ne fournit pas l'action correspondante.
