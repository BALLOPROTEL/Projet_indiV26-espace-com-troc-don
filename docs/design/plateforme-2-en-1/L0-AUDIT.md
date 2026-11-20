# #149 — Audit L0 : écart entre l’existant et la maquette 24 écrans

Date : 20 novembre 2026  
Référence UX/UI : `docs/design/plateforme-2-en-1/prototype.html` sur `design/plateforme-2en1-maquette-20261120`.

## Principes retenus

- Le prototype est une **source de vérité visuelle**, pas une application à copier.
- Les données fictives du prototype (produits, prix, panier, commandes, profils, compteurs, festival) ne sont jamais injectées dans la production.
- Les contrats DON/TROC, Keycloak, MinIO, Marketplace, RabbitMQ et les rôles restent inchangés dans L1.
- L1 ne crée aucun modèle commercial, aucune migration et aucun paiement.
- #146 (SEO), #147 (profil Keycloak) et #148 (conversations backend) restent des PR séparées et ne sont pas fusionnées dans ce lot.

## Matrice des 24 écrans

| # | Écran prototype | État vérifié avant L1 | Décision |
|---|---|---|---|
| 01 | Accueil | Existe, orienté DON/TROC | **Refonte L1** haute fidélité |
| 02 | Boutique | Absente | Présence visuelle “en préparation”, backend L4 |
| 03 | Fiche produit | Absente | L4 |
| 04 | Fanzines | Absente | Teaser non fictif en L1, écran L6 |
| 05 | Lecteur fanzine | Absent | L6 |
| 06 | Festival & actualités | Absent | Teaser non fictif en L1, écran L6 |
| 07 | Dons & trocs | Fonction réelle intégrée à l’accueil | Conservée et restylée sur l’accueil L1 |
| 08 | Détail annonce | Route `/annonces/[id]` réelle | Conservé ; refonte visuelle L2 |
| 09 | Publier une annonce | `/espace#publier` réel | Conservé ; refonte L2 |
| 10 | Messagerie | Pas livrée sur `main` ; backend en PR #148 | Ne pas dupliquer ; L2 après validation #148 |
| 11 | Panier | Absent | L5 ; aucun faux panier en L1 |
| 12 | Passer commande | Absent | L5 |
| 13 | Confirmation | Absente | L5 |
| 14 | Connexion / inscription | Keycloak/OIDC réel | Conserver Keycloak ; habillage L3 |
| 15 | Tableau de bord | `/espace` réel | Conserver ; refonte L3 |
| 16 | Mes commandes | Absent | L5 |
| 17 | Mes annonces | `/espace#mes-articles` réel | Conserver ; refonte L2/L3 |
| 18 | Favoris | Absents | L3 après contrat réel |
| 19 | Notifications | Backend RabbitMQ/Notification réel, pas d’écran dédié | L3 |
| 20 | Paramètres | Gestion Keycloak en PR #147 | Ne pas recréer ; L3 après validation #147 |
| 21 | Modération | `/moderation` réelle | Conserver ; refonte L2 |
| 22 | Aide / FAQ | Absente | L6 |
| 23 | Notre histoire | Absente | L6 |
| 24 | Contact | Absent | L6 |

## L1 implémenté dans cette PR

- design tokens isolés `--pm-*` avec la palette validée ;
- marque / maison partagée ;
- header compact fidèle au prototype ;
- menu compte plus léger sans perdre les accès rôle ;
- navigation mobile fixe avec safe-area ;
- footer 4 colonnes adapté aux fonctions réellement disponibles ;
- accueil 2-en-1 haute fidélité ;
- DON/TROC alimenté par la vraie API Catalog ;
- boutique/fanzines/actualités explicitement marqués “en préparation” ;
- recherche, filtres, pagination et états loading/error/empty conservés ;
- aucun changement backend, RBAC, base, migration ou paiement.

## Risques / dépendances pour la suite

- #147 devra être intégré avant la refonte L3 du profil/compte.
- #148 devra être intégré avant l’UI messagerie de L2.
- #146 devra être réévalué avant toute refonte du détail annonce/SEO en L2/L6.
- La validation mobile physique (Safari iPhone + Chrome Android) reste humaine : l’émulation ne suffit pas pour safe-area, hover tactile et clavier logiciel.
