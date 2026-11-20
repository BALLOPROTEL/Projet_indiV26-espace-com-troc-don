# Cahier des charges pour Codex — Refonte de La Petite Maison de l'Épouvante

**Statut : référence de conception (pas du code de production).** Date : 20 novembre 2026.
**Maquette navigable source de vérité UX/UI :** [prototype.html](./prototype.html), 24 écrans, version mobile comprise.
**Palette validée :** bleu nuit `#17324D` ; turquoise `#20AFA3` ; orange `#F28C45` ; fond `#F7F9FB` ; texte `#344054`.
**Objectif métier :** transformer progressivement l'application déjà opérationnelle DON/TROC en une plateforme **2-en-1 : boutique e-commerce + échange/troc/don**.

## Règles absolues
1. **Ne pas repartir de zéro.** Réutiliser le monorepo, Next.js 16 / React 19 / TypeScript dans `apps/web`, les microservices NestJS, Gateway, PostgreSQL, Keycloak/OIDC, MinIO, RabbitMQ et les outils de CI existants.
2. **Préserver les parcours DON/TROC** : annonces, pièces jointes MinIO, statut modération, rôles USER/MODERATOR/ADMIN, demandes, acceptation/refus, réservation, double confirmation, notifications, messagerie/profil s'ils sont présents sur la branche de travail. Aucun contournement des contrôles backend de droits/ownership.
3. **Ne pas coder la démo comme application réelle.** Le HTML fournit la référence **visuelle et de navigation** ; ses produits, annonces, prix, sessions et paiements sont simulés. Ne jamais recopier les données fictives en production ni laisser de boutons trompeurs. Connecter toute fonctionnalité réelle à une API validée ; sinon afficher un état explicite « en préparation » ou utiliser des fixtures uniquement en Storybook/dev/tests.
4. **Ne pas écraser le travail en cours.** Vérifier les PR ouvertes #146, #147 et #148, les issues #110–#113, les éventuels changements sur `main`, et éviter les conflits. Conserver les routes existantes ou créer des redirections compatibles.
5. **Pas de fusion ni d'auto-merge sans accord explicite du propriétaire.** Ne pas relancer aveuglément les CI en échec, analyser les logs. Ne jamais nettoyer/supprimer les volumes, PVC ou données utilisateur.
6. Respecter les conventions `AGENTS.md` et choisir les compétences dans `.agents/skills/` selon le besoin.
7. Accessibilité : contrastes >= 4.5:1 pour texte normal, responsive 320/390/768/1280 px, zoom 200 %, clavier, focus visible, cibles tactiles, reduced motion, formulaires accessibles, états chargement/vide/erreur.

## Écrans attendus (24)
| Domaine | Pages / maquettes |
|---|---|
| Découverte | 01 Accueil ; 02 Boutique ; 03 Fiche produit ; 04 Fanzines ; 05 Lecteur fanzine ; 06 Festival & actualités |
| Communauté | 07 Dons & trocs ; 08 Détail annonce ; 09 Publier une annonce ; 10 Messagerie |
| Achat | 11 Panier ; 12 Passer commande ; 13 Confirmation |
| Compte | 14 Connexion/inscription ; 15 Tableau de bord ; 16 Mes commandes ; 17 Mes annonces ; 18 Favoris ; 19 Notifications ; 20 Paramètres |
| Autres | 21 Modération ; 22 Aide/FAQ ; 23 Notre histoire ; 24 Contact |

## Principes UX à reproduire fidèlement
- Navigation globale commune : marque, accueil, boutique, troc/don, fanzines, actualités, compte, recherche, panier ; version mobile véritable, sans débordements.
- Identité graphique claire, premium, légèrement horrifique : maison stylisée, beaucoup d'espace, cartes à coins arrondis, fonds clairs, typographie nette, CTA orange pour achat, turquoise pour échanges, bleu nuit pour structure et titres.
- Même niveau de soin sur les écrans secondaires, états vides/erreurs, filtres, fiches, formulaires, feedback des actions.
- Aucun gros copier-coller monolithique du prototype dans Next.js. Extraire des **design tokens**, composants réutilisables, routes App Router, modèles typés et états.
- La navigation, les prix et les compteurs reposent sur la vraie donnée ; aucune métrique factice en production.

## Plan d'exécution par PR courtes
**L0 — Audit & matrice d'écart.** Cartographier routes/composants/API/contrats actuels, risques et dépendances vis-à-vis des PR ouvertes. Définir design system, arborescence cible et « déjà disponible / à adapter / nouveau backend requis ». Ne pas réécrire les services métiers.

**L1 — Fondations et accueil.** Créer tokens CSS, typographie, grille, composants partagés (header, footer, buttons, cards, badges, sections, formulaires), accueil haute fidélité, navigation responsive et liens vers les modules existants. Faire de `apps/web` l'implémentation, pas de l'HTML statique. Tests visuels, lint, typecheck, tests, build. PR dédiée. **C'est le premier lot à implémenter.**

**L2 — Parcours communauté existants.** Refaire « dons & trocs », annonce, publication, mes annonces, demandes, messagerie, notifications, modération avec le design approuvé, sans régression API, permission, média, transaction ou modération. Préserver filtres et URLs existants / redirections.

**L3 — Compte & ergonomie.** Connexion OIDC Keycloak, tableau de bord, profil, réglages, favoris, historique, rôles. Vérifier les fonctionnalités déjà introduites par PR #147/#148 plutôt que recréer leurs contrats.

**L4 — Boutique.** Définir produit commercial DISTINCT d'une annonce DON/TROC ; vrais produits/catalogue, prix/stock/variantes/visibilité, recherche et catégories, fiches, images, stock sécurisé, admin catalogue. Établir les contrats, migrations et tests d'autorisation nécessaires AVANT d'exposer un achat public.

**L5 — Panier/commande.** Panier, commandes, suivi, confirmation et, ultérieurement, paiement réel via prestataire à choisir. Montants calculés et contrôlés côté serveur ; pas de carte bancaire stockée ni paiement factice présenté comme réel. Toute simulation reste explicitement non productive.

**L6 — Contenus & validation finale.** Fanzines, lecteur (droits d'accès), actualités/festival, FAQ, contact, SEO, RGAA, audit sécurité, performance et recette responsive multi-appareils ; préparation des preuves CESI.

## Premier mandat concret pour Codex
1. Lire `AGENTS.md`, `README.md`, les docs d'architecture et les PR/branches actives.
2. Étudier le prototype complet en ouvrant localement `docs/design/plateforme-2-en-1/prototype.html` dans un navigateur, inspecter les 24 pages, faire des captures si possible, comparer avec l'existant.
3. Rédiger la matrice d'écart L0 (ne pas affirmer qu'une fonctionnalité existe sans avoir vérifié le code).
4. **Implémenter L1 uniquement**, avec une PR dédiée et tests, en minimisant les conflits avec PR #146–#148.
5. Donner une liste très précise de tests manuels (commandes exactes de lancement, URLs, comptes/rôles, vérifications mobile) et indiquer clairement ce qui n'est pas encore implémenté.
6. Ne pas poursuivre automatiquement L2–L6 ni fusionner sans validation humaine.

## Critères d'acceptation de L1
- Palette exacte et cohérence visuelle reconnaissable avec la page Accueil du prototype.
- Header/footer/navigation utilisables au clavier et sur mobile ; accès continu aux parcours DON/TROC actuellement réels.
- Aucun produit, panier, paiement, compteur ou compte fictif exposé comme réel.
- Aucun changement destructeur du backend, RBAC, migrations ou déploiement.
- Lint/typecheck/tests/build applicables exécutés ; régressions connues documentées ; captures avant/après.
- PR documentée et prête pour revue Codex, sans fusion.

## Travail en parallèle
Les CI asynchrones ne doivent pas immobiliser la conversation : exécuter et contrôler les tâches indépendantes, puis revenir aux checks lorsqu'ils sont terminés ou que l'utilisateur transmet leur verdict.
