# #149 — Matrice de couverture des 24 écrans

Référence : `docs/design/plateforme-2-en-1/BRIEF-CODEX.md` et `prototype.html`.

Règle de lecture :
- **Route dédiée** = vraie page App Router ou écran OIDC externe clairement séparé.
- **Métier réel** = données/actions branchées sur les API existantes.
- **Visuel migré** = langage graphique du prototype, sans retour au design legacy.
- **À faire** = écran encore absent ou seulement présent comme section interne.

| # | Écran prototype | Route / écran actuel | Route dédiée | Métier réel | Visuel migré | Statut |
|---|---|---|---|---|---|---|
| 01 | Accueil | `/` | Oui | Oui, aperçu Catalog | Oui | Fait |
| 02 | Boutique | `/boutique` | Oui | Non, backend e-commerce absent | Oui | Visuel fait |
| 03 | Fiche produit | — | Non | Non | Non | L4 |
| 04 | Fanzines | `/fanzines` | Oui | Non, contenu réel absent | Oui | Visuel fait |
| 05 | Lecteur fanzine | — | Non | Non | Non | L6 |
| 06 | Festival & actualités | `/festival` | Oui | Non, flux éditorial absent | Oui | Visuel fait |
| 07 | Dons & trocs | `/echanges` | Oui | Oui | Oui | Fait |
| 08 | Détail annonce | `/annonces/[id]` | Oui | Oui | Oui | Fait |
| 09 | Publier une annonce | `/publier` | Oui | Oui | Oui | Fait |
| 10 | Messagerie | `/messages` | Oui | Partiel via échanges/transactions | Oui | Route dédiée, chat temps réel à compléter si requis |
| 11 | Panier | — | Non | Non | Non | L5 |
| 12 | Passer commande | — | Non | Non | Non | L5 |
| 13 | Confirmation | — | Non | Non | Non | L5 |
| 14 | Connexion / inscription | Keycloak OIDC | Oui, externe | Oui | Oui | Fait |
| 15 | Tableau de bord | `/espace` | Oui | Oui | Oui | Fait |
| 16 | Mes commandes | — | Non | Non | Non | L5 |
| 17 | Mes annonces | `/mes-annonces` | Oui | Oui | Oui | Fait |
| 18 | Favoris | — | Non | Non | Visuel seulement dans navigation | L3/L4 |
| 19 | Notifications | — | Non | Notifications backend présentes, écran dédié absent | Partiel | À créer |
| 20 | Paramètres | — | Non | Non vérifié / écran absent | Non | L3 |
| 21 | Modération | `/moderation` | Oui | Oui | Oui | Fait |
| 22 | Aide / FAQ | `/faq` | Oui | Contenu statique | Oui | Fait |
| 23 | Notre histoire | `/notre-histoire` | Oui | Contenu statique | Oui | Fait |
| 24 | Contact | `/contact` | Oui | Envoi désactivé, backend absent | Oui | Visuel fait, transmission non active |

## Décision d’architecture

Les cinq destinations publiques principales sont désormais de vraies pages :

- `/`
- `/boutique`
- `/echanges`
- `/fanzines`
- `/festival`

L’Accueil ne doit plus héberger les écrans complets de ces univers.

Pour la suite, la même règle s’applique : un écran du prototype qui représente une page autonome doit devenir une vraie route dédiée quand son lot est traité. Une section `#hash` peut rester comme compatibilité temporaire, mais ne doit pas être considérée comme la page finale.

## Prochaine extraction logique sans nouveau backend

Les écrans suivants peuvent être séparés en vraies routes tout en réutilisant les fonctions existantes, sans inventer de métier :

1. `/notifications` — écran 19, après vérification de l’API de notification existante ;
2. `/parametres` — écran 20, après vérification des préférences réellement persistées ;
3. `/favoris` — écran 18, seulement après contrat backend réel ;
4. `/mes-commandes` — écran 16, avec le backend e-commerce L4/L5.

Aucune route e-commerce transactionnelle ne doit être ouverte avant les lots L4/L5 et leurs contrats backend.
