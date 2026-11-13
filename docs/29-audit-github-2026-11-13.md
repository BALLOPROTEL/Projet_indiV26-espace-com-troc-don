# Audit GitHub et plan d'assainissement — 13 novembre 2026

## Mise à jour : nettoyage réellement exécuté le 13 novembre

[L'exécution GitHub Actions #43515368165](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/actions/runs/43515368165) s'est terminée **SUCCESS**. Elle a supprimé **39 branches** d'anciennes PR fusionnées, après vérification de l'état de chaque PR, de son SHA et de l'absence de PR ouverte ; puis sa propre branche temporaire. Le dépôt compte désormais **7 branches** après une deuxième exécution [#43515848969](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/actions/runs/43515848969), **SUCCESS**, qui a supprimé uniquement `feat/20-lot6b-frontend` après comparaison Git : 0 commit en avance sur main, 145 en retard, aucune PR ouverte. Les branches conservées ont toutes une raison explicite :

- `main` (protégée) ;
- `feat/56-jury-demo-kit-plan` (#84), `fix/98-keycloak-password-field` (#99), `fix/80-bootstrap-registry-fallback` (#100), `docs/github-audit-hygiene-20261113` (#101), `fix/102-security-advisories` (#103) : PR **ouvertes** ;
- `fix/96-keycloak-password-input-group` (PR #97 fermée **sans fusion**, **2 commits uniques en avance sur main**) : **préservée pour examen individuel**.

Le tag `baseline-2026-10-19` a été **créé et vérifié** sur le SHA `8a248fa7366b52341c79ace52cffdb63121c1352`, sans prétendre à une release de production ou de jury.

Un nouveau risque d'audit npm est suivi dans [#102](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/102) / [PR #103](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/pull/103) : **2 critiques + 3 élevées + 1 modérée** ont fait échouer les anciennes CI des PR #84 et #101. Le nouveau lockfile a été régénéré par pnpm : [audit sécurité #43514970640](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/actions/runs/43514970640) **« No known vulnerabilities found »** après mises à jour Next.js 16.4.1, body-parser 2.4.0, multer 2.5.0, qs 6.16.1. Ces changements restent **non fusionnés** et doivent passer leurs CI/revue complètes avant accord propriétaire.

**Le Kanban GitHub Projects V2 n'a pas été modifié** : une tentative de synchronisation automatisée, strictement limitée au projet nommé `Projet_individuel26 - Kanban`, a été exécutée dans [Actions #43516291730](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/actions/runs/43516291730) et a échoué car **le projet exact n'était pas accessible au jeton GitHub Actions**. Le script a expressément interrompu toute écriture sur les colonnes, puis supprimé sa branche de maintenance. Les 13 statuts cibles (12 issues précédentes + nouvelle issue de sécurité #102) restent documentés ; une connexion possédant les permissions GitHub Projects V2 du bon compte est nécessaire pour synchroniser le board.

---


> **Source de vérité :** GitHub consulté le 13/11/2026. Ce document distingue précisément le code déjà fusionné, les PR non fusionnées, les preuves automatisées et les validations humaines. Il ne prétend pas que le Kanban GitHub Projects V2, les tags ou les branches ont été modifiés sans vérification de leur écriture effective.

## 1. Synthèse vérifiée

| Axe | État constaté au début de l'audit | Décision |
| --- | --- | --- |
| Dépôt / branche principale | `BALLOPROTEL/Projet_indiV26-espace-com-troc-don`, branche protégée `main`, HEAD `8a248fa7366b52341c79ace52cffdb63121c1352` (19/10/2026) | Ne pas prétendre que les PR ouvertes sont intégrées |
| Dernier Bootstrap sur `main` | [run #39301448528](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/actions/runs/39301448528) : **SUCCESS** | Citer le SHA exact |
| Version package.json | `0.1.0` | Version de POC, pas de release production |
| Tags Git / releases | **0 tag**, **0 release** dans les références/release GitHub accessibles | Préparer une politique de tag, ne pas inventer de release |
| Branches avant l'audit | **45** : `main`, 3 branches de PR ouvertes, 39 branches de PR déjà fusionnées, 1 branche de PR fermée non fusionnée, 1 branche strict ancêtre de main | Conserver les 3 PR ouvertes ; supprimer les 39 fusionnées et la branche ancêtre après vérification du SHA |
| Issues de travail ouvertes | **12** (hors PR) | Triages et statuts ci-dessous |
| Pull requests ouvertes | **#84** (draft), **#99** (ready), **#100** (ready) | Aucune fusion sans GO explicite |
| GitHub Projects V2 | Projet Kanban documenté par #5/#55, mais champ `Status` non accessible via le connecteur Issues | Tableau de réconciliation ci-dessous : **cible**, pas état du board déjà modifié |

## 2. Où en est réellement le produit ?

**Livré dans `main` :** lots 0–9, architecture microservices M0–M10 et son dossier d'exploitation, DON/TROC (Marketplace), catalogue, uploads MinIO 5–8 images, modération, double confirmation, rôles Keycloak, API Gateway, Notification/RabbitMQ, CI sécurité, Docker Compose et Kubernetes, frontend V2 F0–F5/F7. Les PR #54 et #61 fournissent des recettes Chrome réelles **en environnement jetable et sur données de test**, qui ne sont pas un jeu de données jury durable.

**Non livré ou non certifié :**
- Retour utilisateur final sur les interfaces, test **iOS/Android physiques**, clavier virtuel/zoom 200 % (#71 ; frontend #63/#85).
- Import réel du second compte USER dans une **stack isolée**, au moins vingt photos avec droits vérifiés, et répétition complète sur ces données (#56, PR #84).
- Dossier final des preuves (#58), support de vingt minutes, répétition et vidéo de secours (#59), clôture LOT 10 (#18).
- F6 (catégories, localisation, favoris, messagerie…) : périmètre **optionnel non livré**, issue #70.
- Refonte Legacy/Gateway, NetworkPolicy, rate-limit distribué et quelques risques d'exploitation : dettes assumées, ne pas présenter le POC comme production certifiée.

## 3. Trois PR en attente

| PR | Dernier HEAD de référence au début de l'audit | Vérifications | Décision |
| --- | --- | --- | --- |
| [#99](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/pull/99) correctif largeur mot de passe | `b3c4c61a925977eb097167d4e255f3859360b0de` | Bootstrap #39325942169, M8 Chrome #39325942412 : SUCCESS ; Codex sans finding | Prête pour revue humaine, **non fusionnée** ; liée à #98 |
| [#100](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/pull/100) repli des pulls Docker officiels | `17a5cfc6be017d75347512eb8cffcabf9e2db749` | Bootstrap complet #39335129166 SUCCESS (Postgres, RabbitMQ, migrations, Web, Compose, Kubernetes, Trivy) ; Codex sans finding | Prête pour revue humaine, **non fusionnée** ; liée à #80 |
| [#84](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/pull/84) kit jury | `31438d020c1d40ac76123660711894e1976b7936` après correction P1 détectée par l'audit | Nouveau M8 Contracts #43509085254 et Jury offline #43509085345 SUCCESS ; **Codex de code sans finding** sur ce SHA ; Bootstrap #43509085868 encore en cours à la dernière consultation | **Draft** ; données réelles manquantes, aucun GO jury, ne pas fusionner prématurément |

**Important :** le correctif P1 de #84 empêche `TMPDIR/TMP/TEMP` (y compris symlink) d'écrire un export contenant des mots de passe sous le checkout Git, avant toute écriture de secret. Maintenir cette garde et les tests de régression.

## 4. Réconciliation Kanban à appliquer dans GitHub Projects V2

**Ces statuts sont les statuts cibles vérifiés par les preuves**, pas la confirmation d'une mutation du champ GitHub `Status` :

| Status cible | Issue(s) | Pourquoi |
| --- | --- | --- |
| **In Progress** | #55, #56, #35 | Hygiène GitHub/board à finir ; kit de données jury réel et parent LOT 9B incomplets |
| **Review** | #98, #80 | Correctifs PR #99 et #100 CI + Codex OK mais attente de GO de fusion |
| **Review** | #71, #63, #85 | Frontend/UX techniquement intégrés en grande partie ; recettes réelles appareils et approbation visuelle encore en attente |
| **Backlog** | #70 | F6 optionnel, pas nécessaire à la soutenance MVP |
| **Backlog** | #18, #58, #59 | Dossier preuves et soutenance tributaires du kit jury et de la recette physique |
| **Done** | #44, #57, #64–#69, #81, #87, #88, #92, #93 et issues historiques clôturées | Toutes déjà fermées, sous réserve de présence effective dans le projet |

Ne fermer ni #55 avant la synchronisation réelle du Kanban, ni #56/#35 avant une démonstration attestée, ni #71/#63/#85 sans recette humaine, ni #98/#80 avant l'intégration approuvée des PR. Après chaque changement de colonne, vérifier la page GitHub Project et consigner la date de contrôle dans #55.

## 5. Plan de branches : suppression sûre, sans perte de travail

Dans le snapshot initial : **39** branches non protégées pointent exactement vers le HEAD d'une PR **déjà fusionnée**. Elles sont éligibles à la suppression de la *référence de branche distante* après une dernière vérification de SHA ; les commits et historiques des PR restent consultables.

```text
chore/lot6b-roadmap-done
chore/lot7-roadmap-done
chore/lot8-roadmap-done
chore/lot9-roadmap-done
chore/71-codex-ui-design-skills
docs/55-align-project-status-after-m9
docs/55-front-v2-final-status
docs/57-m10-final-microservices-architecture
feat/9-lot1-base-technique
feat/10-lot2-keycloak-rbac
feat/11-lot3-listings-moderation
feat/12-lot4-quality-gates
feat/13-lot5-supply-chain
feat/14-lot6-kubernetes
feat/15-lot7-observability
feat/16-lot8-performance
feat/17-lot9-security-audit
feat/26-lot6b-frontend
feat/44-m9-donation-trade-workflows
feat/64-front-v2-f0-design-system-header
feat/65-front-v2-f1-home-paginated
feat/66-front-v2-f2-product-gallery
feat/67-front-v2-f3-moderation-dashboard
feat/68-front-v2-f4-admin-catalog-contract
feat/69-front-v2-f5-admin-dashboard
feat/87-personal-space-wizard-compact-list
feat/88-keycloak-login-design-v3
fix/44-m4-codex-review
fix/71-front-v2-mobile-home-ux
fix/81-front-v2-empty-photo-cards
refactor/44-m4-api-gateway
refactor/44-m5-rabbitmq-notifications
refactor/44-m6-compose-codespaces
refactor/44-m7-kubernetes-microservices
refactor/86-management-single-navigation
refactor/92-compact-moderation-queue
style/93-keycloak-balanced-login
test/44-m8-microservices-contracts-e2e
test/56-lot9bf-media-certification
```

**Ne surtout pas supprimer** : `main` (protégée), `feat/56-jury-demo-kit-plan`, `fix/98-keycloak-password-field`, `fix/80-bootstrap-registry-fallback`, et la nouvelle branche de ce rapport tant qu'une PR est ouverte. La branche `feat/20-lot6b-frontend` a été comparée à `main` : **0 commit en avance et 145 en retard** ; c'est donc une **40e candidate** sûre sous réserve d'une dernière comparaison avant suppression. En revanche, **conserver** `fix/96-keycloak-password-input-group` : PR #97 fermée sans fusion, **2 commits uniques** et divergence face à #99 ; son sort nécessite une décision spécifique.

La suppression effective nécessite un outil GitHub autorisant `DELETE /git/refs/heads/{branch}` ou l'interface authentifiée, **après relecture de la liste et vérification SHA**. Le connecteur GitHub actif ne permet que la lecture des branches et les mutations de fichiers/issues/PR ; ne pas prétendre que les branches ont été supprimées.

## 6. Tags et releases — politique proposée

Les références GitHub n'affichent **aucun tag**, et la collection des releases est vide. Le package porte `0.1.0`, mais le projet ne satisfait pas encore une publication version finale certifiée pour jury ou production.

1. **Après vérification des règles de version**, créer si souhaité un *tag de snapshot* descriptif, par exemple `baseline-2026-10-19`, sur **`8a248fa7366b52341c79ace52cffdb63121c1352`**, en précisant « baseline technique main, PR #84/#99/#100 non incluses, kit jury non prêt ».
2. Éviter de taguer `v1.0.0` ou une release `stable` : ces libellés impliqueraient à tort une préparation achevée.
3. Après GO et intégration réelle des correctifs, préparer un tag SemVer correspondant à la version publiée, avec notes exactes, lien CI sur le SHA et inventaire des limites.

**Mise à jour du 13/11 :** le tag de référence a été créé par la maintenance GitHub Actions #43515368165 ; **aucune release** n'a été créée et aucun tag existant déplacé.

## 7. Checklist de clôture du nettoyage

- [x] Vérifier le HEAD de `main`, la CI post-merge, les 3 PR, Codex et les 12 issues ouvertes.
- [x] **Actualiser les 12 issues ouvertes** par une section datée (sans effacer leur historique) et ajouter leurs labels existants : `bug`, `enhancement`, `architecture`, `documentation`.
- [x] Classer les 45 branches et isoler les 40 candidates vérifiées (39 PR fusionnées + 1 ancêtre).
- [x] Constater l'absence de tags/releases et fixer une politique de version.
- [x] Définir les statuts **cibles** du Kanban sans fermer abusivement les tâches, et les documenter dans les 12 issues.
- [ ] Appliquer les colonnes GitHub Projects V2 avec accès autorisé, puis vérifier visuellement.
- [x] Supprimer les **39 branches fusionnées** et l'éphémère branche de nettoyage : succès #43515368165 ; **1 branche historique non fusionnée avec 2 commits uniques préservée**.
- [ ] Décider séparément du sort de `fix/96-keycloak-password-input-group` (2 commits uniques non fusionnés) ; ne pas supprimer sans revue de ces commits.
- [x] Créer et vérifier le tag de référence **`baseline-2026-10-19`** sur `8a248fa` (aucune release).
- [ ] Faire approuver explicitement les fusions #99/#100 ; garder #84 draft tant que la démo et les preuves ne sont pas prêtes.
- [ ] Faire la recette réelle #71/#56, puis les preuves #58 et le support #59.

**Règle invariante :** aucune fusion de PR ni action destructrice sur les données, PVC, volumes utilisateur ou Codespaces sans autorisation explicite. Ce rapport est un audit de gouvernance, pas un certificat de conformité production.
