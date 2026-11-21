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
| 02 | Boutique | `/boutique` | Oui | Oui, Catalog Produit réel | Oui | Fait |
| 03 | Fiche produit | `/boutique/produit/[slug]` | Oui | Oui, variantes/prix/stock/images réels | Oui | Fait |
| 04 | Fanzines | `/fanzines` | Oui | Non, contenu réel absent | Oui | Visuel fait |
| 05 | Lecteur fanzine | `/fanzines/lecteur` | Oui | Non, contenu éditorial absent | Oui | Visuel fait |
| 06 | Festival & actualités | `/festival` | Oui | Non, flux éditorial absent | Oui | Visuel fait |
| 07 | Dons & trocs | `/echanges` | Oui | Oui | Oui | Fait |
| 08 | Détail annonce | `/annonces/[id]` | Oui | Oui | Oui | Fait |
| 09 | Publier une annonce | `/publier` | Oui | Oui | Oui | Fait |
| 10 | Messagerie | `/messages` | Oui | Oui, conversations privées persistées | Oui | Fait (messagerie asynchrone, pas WebSocket) |
| 11 | Panier | `/panier` | Oui | Oui, Commerce Service | Oui | Fait |
| 12 | Passer commande | `/commande` | Oui | Oui, brouillon réel + coordonnées | Oui | Fait |
| 13 | Confirmation | `/commande/confirmation` | Oui | Oui, réservation stock + Stripe test | Oui | Fait |
| 14 | Connexion / inscription | Keycloak OIDC | Oui, externe | Oui | Oui | Fait |
| 15 | Tableau de bord | `/espace` | Oui | Oui | Oui | Fait |
| 16 | Mes commandes | `/mes-commandes` | Oui | Oui, historique Commerce réel | Oui | Fait |
| 17 | Mes annonces | `/mes-annonces` | Oui | Oui | Oui | Fait |
| 18 | Favoris | `/favoris` | Oui | Oui, persistance Catalog par JWT `sub` | Oui | Fait |
| 19 | Notifications | `/notifications` | Oui | Oui, inbox utilisateur personnelle | Oui | Fait |
| 20 | Paramètres | `/parametres` | Oui | Identité Keycloak réelle ; préférences applicatives non persistées | Oui | Partiel |
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

## État après séparation 24/24

Les 24 écrans du prototype possèdent maintenant une destination dédiée ou, pour l’authentification, l’écran Keycloak externe.

Les contrats Boutique/Commerce sont désormais branchés : produits, images, favoris, panier, commandes, réservation de stock et paiement Stripe **en mode test** utilisent des données réelles.

Les surfaces qui restent volontairement non transactionnelles ou partielles sont :
- Fanzines et lecteur numérique : contenu éditorial réel absent ;
- Festival : flux éditorial/programme réel absent ;
- Contact : transmission backend absente ;
- Paramètres : identité Keycloak réelle, préférences applicatives non persistées.

La priorité n’est plus la création des écrans mais la consolidation GitHub, la certification globale et les derniers contrats éditoriaux/légaux.
