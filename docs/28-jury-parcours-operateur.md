# LOT 9B-F — Runbook opérateur : démonstration jury DON/TROC

> **Plan de recette, PAS preuve de démonstration effectuée.** Le jeu de données de `demo/jury/manifest.json` est `DRAFT_NOT_READY` : le second utilisateur n'est pas provisionné dans la session cible et les vingt fichiers médias avec leur provenance ne sont pas encore livrés. Arrêt obligatoire avant publication si un prérequis échoue.

## 1. Périmètre et garde-fous

- Environnement **éphémère dédié au jury**, explicitement isolé des bases, volumes, buckets MinIO et realm utilisés par les personnes réelles ou par le Codespace courant.
- Pas de `docker compose down -v`, de nettoyage de volumes/PVC, de `prune`, de purge d'utilisateurs ni de seed silencieux. Les données de démonstration sont créées uniquement après contrôle de la destination.
- Il faut quatre identités réellement distinctes dans le Keycloak **de cette session** : membre propriétaire, membre demandeur, modérateur, administrateur. Deux comptes ayant le rôle `USER` ne peuvent pas être remplacés par un changement de rôle dans le navigateur.
- Seules les images dont l'auteur, la source, les conditions d'utilisation et l'autorisation de présentation ont été vérifiés sont admises ; ne jamais inventer de crédits. Au minimum 5 photos réelles **par article** (20 en tout).
- Aucune capture ni aucun compte provenant des fixtures jetables CI ne peut être présenté comme preuve d'un jeu de données métier réel.

## 2. Prévol : vérifier avant de toucher aux données

Sur la branche ou la version *effectivement destinée à la démonstration*, inspecter :

```bash
git status --short
git rev-parse HEAD
df -h .
pnpm jury:plan:check
pnpm jury:plan:test
pnpm jury:assets:check
```

Le premier contrôle vérifie le schéma ; le deuxième les tests de validation hors ligne. **Le troisième doit échouer tant que les images, crédits, deux acteurs réellement distincts et statut `READY_FOR_REVIEW` ne sont pas prêts.** Ne pas désactiver ni contourner cette gate pour obtenir du vert.

Avant toute recette avec connexion : relever *sans enregistrer de secrets* l'URL/nom de la stack isolée et le SHA exact ; vérifier les deux membres `USER` via une connexion réelle à ce Keycloak et un accès API authentifié. Un compte éventuellement déclaré dans un export JSON n'est **pas** une preuve qu'il est présent dans un realm déjà déployé.

### Feuille de prévol à compléter par l'opérateur

| Contrôle | Preuve à saisir | GO/NO GO |
| --- | --- | --- |
| Environnement isolé et propriété des données | URL non sensible, SHA et cible vérifiés | À faire |
| Deux membres USER différents et test de connexion | Identifiants publics de démonstration et réponse autorisée | À faire |
| Compte MODERATOR et compte ADMIN avec RBAC API | Réponses 200/403 anonymisées | À faire |
| Quatre annonces et 20 photos autorisées | Résultat de `pnpm jury:assets:check` + revue juridique | À faire |
| Médias MinIO / URLs privées et publiques | Preuves d'autorisation d'accès, sans jetons | À faire |
| Scénarios et procédure de secours expliqués | Relecteur et date | À faire |

## 3. Parcours oral et preuve attendue

Exécuter les actions **dans cet ordre** pour ne pas immobiliser une annonce nécessaire à une étape ultérieure. Les noms/logiques doivent correspondre à `demo/jury/manifest.json`.

| Étape | Acteur | Action dans le navigateur | Critère vérifiable |
| --- | --- | --- | --- |
| A | Propriétaire | Créer `don-lampe` et `don-etagere` avec 5 photos réelles chacune | Deux annonces privées en attente de modération |
| B | Propriétaire | Créer `troc-sac` avec 5 photos et au moins 5 souhaits distincts | TROC en attente, souhaits persistés |
| C | Demandeur | Créer `troc-livres` avec 5 photos et 5 souhaits | Deux propriétaires distincts |
| D | Modérateur | Contrôler les galeries privées, approuver les quatre annonces | Publiées dans le catalogue ; vérifier les 20 médias et leur persistance |
| E | Demandeur | Faire une demande DON sur `don-lampe` | Proposition `PENDING`, reçue uniquement par le bon propriétaire |
| F | Propriétaire | Refuser la demande `don-lampe` | `REJECTED`, annonce non réservée, notification au demandeur |
| G | Demandeur | Faire une demande DON sur `don-etagere` | Proposition `PENDING`, visible dans le suivi |
| H | Propriétaire | Accepter `don-etagere` | Réservation cohérente côté Catalog / Marketplace |
| I | Les deux membres | Confirmer le DON chacun depuis son propre compte | `COMPLETED` ; confirmation d'un seul membre insuffisante |
| J | Demandeur | Choisir `troc-livres` comme contrepartie de `troc-sac` | Comparaison des **deux fiches** et proposition TROC |
| K | Propriétaire | Accepter le TROC, puis les deux membres confirment | Deux annonces réservées et proposition `COMPLETED` |
| L | Administrateur | Consulter les indicateurs réels puis tester un USER sur la même route | Totaux issus des API ; ADMIN autorisé, USER refusé 403 |

À chaque passage : vérifier le changement d'état **dans les API**, pas seulement dans un toast de succès. Vérifier l'absence de doublons de notifications après actualisation, la visibilité des propositions par le bon propriétaire et le refus des accès tiers (401/403/409 selon le contrat). Les données du tableau ne sont pas des résultats déjà observés.

## 4. Journal de preuve à remplir en direct

| Parcours | Identifiant annonce / proposition | Statut constaté API | Capture / journal (sans secret) | Résultat |
| --- | --- | --- | --- | --- |
| DON refusé | À renseigner | À renseigner | À renseigner | Non testé |
| DON accepté et double-confirmé | À renseigner | À renseigner | À renseigner | Non testé |
| TROC accepté et double-confirmé | À renseigner | À renseigner | À renseigner | Non testé |
| RBAC ADMIN/USER, médias et notifications | À renseigner | À renseigner | À renseigner | Non testé |

Conserver SHA, horodatage et version de l'image applicative avec le compte rendu ; masquer tokens, mots de passe, e-mails privés, cookies, URL signées et identifiants de session.

## 5. Plan de secours et sortie

- Si compte, photo/licence, RBAC, ordre de réservation ou environnement cible n'est pas certain : **STOP**. Ne pas trafiquer les valeurs du manifeste ni forcer un état métier en base.
- Si la session est interrompue, conserver les identifiants d'annonces et propositions **hors du dépôt**. Reprendre à partir de l'état constaté ; ne pas rejouer une acceptation ou une confirmation déjà validée.
- Pour répéter le parcours depuis zéro, employer **une nouvelle stack éphémère isolée** avec de nouveaux identifiants et médias déjà vérifiés, jamais une remise à zéro du Codespace ou des volumes existants.
- En cas de problème live, montrer les traces E2E CI réellement réussies et leur SHA comme **preuve technique automatisée**, en les présentant explicitement comme des données de test synthétiques ; expliquer honnêtement la limite par rapport à une démonstration avec des photos sous licence.
- La clôture de #56/#35 ou l'annonce « jury prêt » exige les données autorisées, les deux membres réellement connectables, une exécution réussie consignée, la revue Codex, les CI applicables et la validation explicite du propriétaire.
