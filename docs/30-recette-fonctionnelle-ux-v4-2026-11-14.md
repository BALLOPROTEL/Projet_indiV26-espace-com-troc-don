# Recette fonctionnelle UX V4 — 14 novembre 2026

**Projet :** La Petite Maison de l'Épouvante — DON / TROC  
**Référence testée :** `main` = `ce3c822d22334243f2e1c5599c2f9e951c370065`.  
**Statut :** CI sur `main` réussie ; **recette humaine Codespaces non terminée**. Le présent document ne certifie ni une production publique ni les appareils physiques.

## 1. Preuves réelles déjà obtenues

| Contrôle | Preuve | Verdict |
| --- | --- | --- |
| Bootstrap post-fusion UX V4 sur `main` (tests, Docker, Kubernetes, audit, Trivy) | [Actions #43614200315](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/actions/runs/43614200315) | **PASS** |
| Chrome réel, JWT Keycloak, deux comptes, DON et TROC, acceptation/refus/double confirmation | [M8 E2E #43612548179](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/actions/runs/43612548179) | **PASS** |
| Web lint, typecheck, Vitest et build | [M9 Quality #43612548216](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/actions/runs/43612548216) | **PASS** |
| Correctif champ mot de passe Keycloak et bouton œil (mesures de dimensions, Tab, écran 390 px) | Même E2E Chrome, captures `uxv3-keycloak-desktop-1280.png` et `uxv3-keycloak-mobile-390.png` | **PASS en CI** |
| Accueil 6 cartes/page, recherche, pagination, images manquantes, 320/390 px | Même E2E Chrome, fichiers `f1-*.png` et `f7-*.png` | **PASS en CI** |
| MODERATOR n'accède pas au tableau ADMIN, ADMIN voit les vrais totaux de Catalog | Même E2E Chrome, fichiers `f5-*.png` | **PASS en CI** |
| 5 photos par annonce, galerie privée, publication via modération, DON/TROC de bout en bout | Même E2E Chrome, fichiers `9bf-*.png` | **PASS sur fixtures isolées** |
| Revue Codex de la refonte, problèmes de fragment après Keycloak corrigés | [PR #105](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/pull/105) | **PASS sans finding** |

La recette Chrome fournit **50 captures** dans l'artefact `m9-browser-visual-*` du run M8. Ce sont des comptes et données *de test isolés*, pas les comptes du propriétaire ni des photos destinées à la soutenance.

## 2. Renforcement automatisé en cours

La branche `test/104-uxv4-browser-regression` ajoute des assertions Chrome *réelles* (sans simulation) :
- Accueil : les vrais liens `#annonces`, `/espace#publier`, `#fonctionnement` et les trois étapes.
- Fiche : le fragment `#faire-une-demande` est réappliqué après chargement asynchrone de l'article.
- Membre : `#publier`, `#mes-articles`, `#mes-echanges` et restauration de l'ancre après Keycloak.
- Modérateur : guide de contrôle en trois étapes ; interdiction d'accéder à ADMIN inchangée.
- Administrateur : trois raccourcis vers les vraies pages et vrais chiffres Catalog.
- Captures supplémentaires si le test passe : `uxv4-*.png` dans l'artefact E2E.

**Ne déclarer ces nouveaux tests réussis qu'après CI verte du SHA de la PR correspondante.**

## 3. Recette manuelle dans le Codespace du propriétaire

**Préconditions :** mêmes comptes réellement autorisés, instance Codespaces existante, préservation de la base et des volumes.

Vérifier `git status --short`. **Si modifications locales : ne pas changer de branche ni écraser ces fichiers**. Dans un arbre propre, `git switch main && git pull --ff-only` puis `pnpm codespaces:up && pnpm codespaces:check`. Ouvrir le **Web via port 3001**, et Keycloak par la redirection du site (port 8081). Ne pas utiliser `docker compose down -v`, `docker system prune`, ni réinitialiser la base.

| Profil | Geste concret sur la vraie UI | Résultat attendu | Statut |
| --- | --- | --- | --- |
| Visiteur | Ouvrir accueil, Comment ça marche, rechercher, filtrer et parcourir page 2 | Menu et CTA visibles, pagination sans doublon, navigation logique sans connexion | **À confirmer** |
| USER A | Se connecter, afficher/cacher le mot de passe, onglet Mes annonces, publier un DON avec photos autorisées | Champ aligné ; annonce sauvegardée en attente de modération | **À confirmer** |
| MODERATOR | Accéder à la file, voir galerie privée, approuver une annonce et motiver un refus | Actions réservées au modérateur ; refus d'accès à `/admin` | **À confirmer** |
| USER B | Demander le DON et proposer un TROC sur annonce disponible, avec compte distinct | Demandes visibles dans Mes échanges envoyées | **À confirmer** |
| USER A | Voir demandes reçues, accepter ou refuser ; vérifier état réservé | Statuts cohérents, aucune action interdite possible | **À confirmer** |
| USER A puis B | Confirmer réellement chaque remise, chacun depuis son compte | Après 1re confirmation : En cours ; après 2e : Terminé | **À confirmer** |
| ADMIN | Consulter dashboard, comparer indicateurs avec annonces, accéder à modération | Comptages réels, rôles sécurisés ; pas de fausses fonctionnalités admin | **À confirmer** |
| Mobile | Tester 320/390 px, paysage, clavier virtuel, zoom 200 %, navigation Tab/focus | Pas de débordement horizontal ni de boutons cachés, cibles utilisables | **À confirmer** |

**Sécurité :** jamais de vrais secrets, cookies, JWT, mots de passe ou identifiants sensibles dans les captures/logs. Les cas de création d'annonce et de transaction agissent sur de vraies données : utiliser uniquement des comptes/objets de recette, avec accord du propriétaire.

## 4. Conditions de clôture

- [x] Code sécurité, Keycloak et UX V4 fusionné dans `main`.
- [x] Bootstrap post-fusion principal vert.
- [x] E2E métier existant et screenshots de base verts en CI.
- [ ] Nouveau scénario ciblé de navigation V4 vert sur son SHA, puis fusion après revue.
- [ ] Recette propriétaire sur son Codespace, rôles USER/MODERATOR/ADMIN et 320/390 px.
- [ ] Contrôle Safari iPhone / Chrome Android et zoom 200 % avec captures exploitables.
- [ ] Compte rendu des anomalies et corrections ; validation finale explicite du propriétaire.

**Tickets associés :** [#104 UX V4](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/104), [#71 qualité/mobile](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/71), [#98 login](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/98), [#56 kit jury](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/56).
