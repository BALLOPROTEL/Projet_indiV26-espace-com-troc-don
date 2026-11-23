# Recette manuelle V2 finale — hors Stripe

Cette recette valide les lots #168, #169, #170 et #171. Stripe est
volontairement hors périmètre de certification finale.

## 0. Démarrage du candidat d'intégration

Dans GitHub Codespaces :

```bash
git fetch origin
git switch release/v2-integration-candidate
git pull --ff-only

pnpm install
pnpm codespaces:down
pnpm codespaces:up
pnpm codespaces:check
```

Ne pas lancer `docker compose up` directement dans Codespaces.

## 1. Pages Legal / RGPD

Ouvrir successivement :

- `/confidentialite`
- `/conditions`
- `/mentions-legales`

Attendu :

- aucune 404 ;
- liens accessibles depuis le footer ;
- aucune identité juridique fictive inventée ;
- l'avertissement projet pédagogique reste visible tant que les variables
  légales réelles ne sont pas renseignées.

## 2. Export des données du compte

Avec un compte USER authentifié :

1. ouvrir `/parametres` ;
2. cliquer **Exporter mes données** ;
3. ouvrir le JSON téléchargé.

Attendu :

- schéma `petite-maison-account-export/v1` ;
- identité Keycloak ;
- annonces et favoris ;
- propositions, transactions, conversations et messages accessibles ;
- notifications ;
- panier et commandes ;
- aucun mot de passe ;
- aucun secret ;
- aucune donnée de carte bancaire.

## 3. Demande Privacy et anonymisation applicative

Utiliser un compte de test jetable.

### 3.1 Cas autorisé

1. depuis `/parametres`, choisir **Demander l'anonymisation** ;
2. envoyer une demande `ANONYMIZE` ;
3. se connecter en ADMIN ;
4. ouvrir `/admin/contenus` ;
5. retrouver la demande Privacy ;
6. cliquer **Traiter anonymisation** ;
7. confirmer **Exécuter l’anonymisation**.

Attendu :

- la demande passe à `CLOSED` ;
- les annonces du compte ne sont plus publiques ;
- les médias MinIO des annonces possédées sont supprimés ;
- les favoris sont supprimés ;
- les notifications identifiant le compte sont supprimées ;
- les identités Marketplace sont remplacées par un identifiant anonyme stable ;
- les corps des messages Marketplace du compte sont neutralisés ;
- le panier est supprimé ;
- les commandes sont conservées mais leurs coordonnées sont neutralisées ;
- l'exécution peut être rejouée sans créer une nouvelle identité anonyme.

### 3.2 Garde-fous métier

Avant l'anonymisation, créer séparément les situations suivantes et vérifier
que l'ADMIN reçoit un refus **avant toute mutation** :

- une annonce du compte est `RESERVED` ;
- une transaction Marketplace est `IN_PROGRESS` ;
- une commande est `AWAITING_PAYMENT`.

Attendu : l'utilisateur doit terminer, annuler ou laisser expirer le flux actif
avant de pouvoir être anonymisé.

### 3.3 Demande ERASE

Une demande `ERASE` anonymise d'abord les données applicatives de la même
façon. La suppression de l'identité Keycloak reste une étape distincte et ne
doit être effectuée qu'après le succès de l'anonymisation applicative.

## 4. Fanzines réels

En ADMIN, `/admin/contenus` :

1. créer un fanzine en brouillon ;
2. vérifier qu'il n'apparaît pas sur `/fanzines` ;
3. le publier ;
4. vérifier son apparition sur `/fanzines` ;
5. ouvrir le lecteur par son slug ;
6. archiver le fanzine ;
7. vérifier sa disparition du public.

Aucun faux prix ni faux abonnement ne doit apparaître.

## 5. Festival / actualités réels

En ADMIN :

1. créer une publication avec titre, résumé, contenu, lieu et date ;
2. vérifier qu'un brouillon reste privé ;
3. publier ;
4. vérifier `/festival` ;
5. archiver ;
6. vérifier sa disparition du flux public.

## 6. Contact réel

Depuis `/contact` :

1. envoyer un message public valide ;
2. vérifier la référence retournée ;
3. en ADMIN, ouvrir `/admin/contenus` ;
4. retrouver le message ;
5. passer son statut `NEW -> IN_PROGRESS -> CLOSED`.

Répéter rapidement plusieurs envois pour confirmer que le rate limit finit par
refuser l'abus.

## 7. Annonces enrichies

Créer une annonce avec :

- catégorie ;
- ville uniquement, sans adresse précise ;
- état de l'objet ;
- 5 à 8 images.

Faire approuver par MODERATOR.

Attendu sur `/echanges` et la fiche :

- catégorie affichée ;
- ville affichée ;
- état affiché ;
- recherche texte fonctionnelle ;
- filtre catégorie ;
- filtre ville ;
- filtre état.

Les anciennes annonces sans ces champs doivent toujours rester valides.

## 8. Signalements

Avec un autre USER :

1. ouvrir une annonce approuvée ;
2. cliquer **Signaler cette annonce** ;
3. choisir un motif et envoyer.

Attendu :

- impossible de signaler sa propre annonce ;
- un même compte ne peut pas signaler deux fois la même annonce ;
- la file apparaît dans `/moderation`.

En MODERATOR/ADMIN :

- `DISMISSED` : l'annonce reste publique ;
- `REVIEWED` : le signalement sort de la file ouverte sans retirer l'annonce ;
- `ACTIONED` sur une annonce `AVAILABLE` : l'annonce est retirée ;
- `ACTIONED` sur une annonce `RESERVED` ou `COMPLETED` : refus pour ne
  pas casser une transaction active/historique.

## 9. Protection de main

État observé avant durcissement :

- `main protected: true` ;
- seul `Validate repository structure` est actuellement obligatoire.

Après intégration de #175, depuis une copie du dépôt disposant de `gh` et
d'un token Repository Administration :

```bash
export GH_TOKEN='TOKEN_ADMIN_GITHUB'
./scripts/github-main-protection.sh --audit
./scripts/github-main-protection.sh --apply
./scripts/github-main-protection.sh --audit
```

Verdict attendu : les trois checks suivants sont obligatoires :

- `Validate repository structure`
- `Contract compatibility M8`
- `M9 Web lint typecheck unit build`

Et :

- strict = true ;
- admins protégés ;
- conversations résolues ;
- force-push interdit ;
- suppression de `main` interdite.

## 10. Releases

À faire seulement après intégration finale sur `main`.

Dans GitHub :

**Actions -> Manual controlled release -> Run workflow**

### Release jury historique

Choisir :

- `release_kind = jury-final-2026-11-19`

Le workflow doit verrouiller :

- SHA `209761290d04827f68941b990a887d61186dc234`
- tag `jury-final-2026-11-19`
- titre `Jury Final — 2026-11-19`

### Release V2

Choisir :

- `release_kind = v2`
- `tag = v2.0.0`
- titre `V2 — Plateforme 2-en-1`

Le workflow doit taguer le HEAD réel de `main`, refuser toute réécriture de
tag et publier les notes `docs/releases/v2.0.0.md`.

## Verdict final

La V2 hors Stripe est validée lorsque :

- les CI des PR métier sont vertes ;
- la CI du candidat #176 est verte ;
- la recette manuelle ci-dessus passe ;
- les PR ne sont fusionnées qu'après ordre explicite du propriétaire ;
- la protection `main` est durcie ;
- les releases jury et V2 sont publiées sur leurs SHA corrects.
