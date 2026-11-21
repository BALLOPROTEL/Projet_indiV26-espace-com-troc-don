# La Petite Maison de l’Épouvante — plateforme 2-en-1

Projet individuel CESI — bloc **« Superviser et assurer le développement des applications logicielles »**.

La V2 fait évoluer le POC DON/TROC initial vers une plateforme **Boutique + Communauté** en architecture microservices, avec identité Keycloak, stockage MinIO, événements RabbitMQ, commerce réel et paiement Stripe Checkout en mode test.

> **État au 21 novembre 2026 :** la V2 consolidée est en PR #166 vers `main`. La pile fonctionnelle DON/TROC, catalogue, favoris, notifications, panier, commandes et réservation de stock est implémentée. Stripe Checkout est intégré en mode test et doit encore faire l’objet d’une recette manuelle avec secrets de test avant toute activation réelle. Le projet reste un laboratoire CESI et n’est pas déclaré production-ready.

## Fonctionnalités principales

### Communauté DON / TROC

- authentification Keycloak / OIDC Authorization Code + PKCE ;
- rôles `USER / MODERATOR / ADMIN` ;
- publication d’annonces DON/TROC ;
- galerie MinIO 5 à 8 images ;
- modération `PENDING / APPROVED / REJECTED` ;
- disponibilité `AVAILABLE / RESERVED / COMPLETED` ;
- propositions de don/troc ;
- acceptation / refus ;
- transactions avec double confirmation ;
- favoris persistés ;
- inbox de notifications personnelle ;
- conversations privées requester/owner avec messages persistés, lecture et anti-spam.

### Boutique / Commerce

- catalogue Produit distinct des annonces DON/TROC ;
- produits, variantes, prix, stock et images réels ;
- administration boutique ;
- panier utilisateur persistant ;
- recalcul serveur des prix depuis Catalog ;
- commandes avec snapshot prix/variante ;
- réservation atomique de stock ;
- annulation / expiration avec restitution ;
- Stripe Checkout hébergé en mode test ;
- webhook Stripe signé et idempotent ;
- statut `PAID` uniquement après confirmation serveur.

### UX / SEO

- refonte visuelle issue des 24 maquettes approuvées ;
- pages dédiées Accueil, Boutique, Échanges & dons, Fanzines et Festival ;
- Keycloak et espaces compte alignés avec le design system ;
- metadata annonce dynamique ;
- canonical / Open Graph / Twitter ;
- vraie 404 annonce ;
- sitemap incluant les annonces publiques.

## Architecture actuelle

```text
Navigateur
   │
   ▼
Next.js Web (:3001)
   │ /api
   ▼
API Gateway (:3000)
   ├────────► Catalog (:3101)
   │            ├─ annonces / favoris
   │            ├─ produits / variantes / stock
   │            └─ MinIO
   │
   ├────────► Marketplace (:3102)
   │            ├─ propositions
   │            ├─ transactions
   │            └─ conversations privées
   │                 │
   │                 └─ RabbitMQ ──► Notification (:3103)
   │
   ├────────► Commerce (:3104)
   │            ├─ panier
   │            ├─ commandes
   │            ├─ réservation stock via Catalog
   │            └─ Stripe Checkout / webhook
   │
   └────────► Legacy API (:3099), fallback Strangler résiduel

Keycloak : identité / JWT / RBAC
PostgreSQL : schémas public, catalog, marketplace, notification, commerce
Prometheus / Grafana : observabilité laboratoire
```

### Ownership métier

- **Catalog** : annonces, images, favoris, produits, variantes, stock et réservations.
- **Marketplace** : propositions, transactions, conversations privées.
- **Notification** : inbox événementielle utilisateur.
- **Commerce** : panier, commandes, cycle de paiement.
- **Keycloak** : identité, rôles, sessions et secrets d’authentification.

Aucun service métier ne doit importer le Prisma Client d’un autre domaine.

## Pages principales

| Route | État |
| --- | --- |
| `/` | réel |
| `/boutique` | catalogue réel |
| `/boutique/produit/[slug]` | produit réel |
| `/echanges` | DON/TROC réel |
| `/annonces/[id]` | annonce réelle + SEO dynamique |
| `/publier` | publication réelle |
| `/messages` | conversations privées réelles |
| `/favoris` | favoris réels |
| `/notifications` | inbox réelle |
| `/panier` | panier Commerce réel |
| `/commande` | commande réelle |
| `/commande/confirmation` | réservation / Stripe test |
| `/mes-commandes` | historique réel |
| `/parametres` | identité Keycloak réelle, préférences encore non persistées |
| `/moderation` | modération réelle |
| `/admin/boutique` | administration catalogue réelle |
| `/fanzines` / lecteur | visuel, backend éditorial absent |
| `/festival` | visuel, flux éditorial absent |
| `/contact` | visuel, transmission backend absente |

## Démarrage GitHub Codespaces

Dans Codespaces, **ne pas utiliser `docker compose up` directement** : le Compose générique utilise des URLs localhost incompatibles avec les ports publics GitHub.

```bash
git status --short
df -h .

pnpm install
pnpm codespaces:up
pnpm codespaces:check
```

Ouvrir le port Web `3001` depuis l’onglet **PORTS**.

Keycloak utilise le port `8081` public du Codespace. Le script `codespaces:up` génère les URLs `app.github.dev` et recrée Keycloak avec le realm adapté.

Arrêt non destructif :

```bash
pnpm codespaces:down
```

## Stripe en mode test

Le Web ne contient aucune clé Stripe.

Variables serveur :

```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

Ne jamais versionner ces valeurs.

Flux :

```text
DRAFT
  -> réservation Catalog
AWAITING_PAYMENT
  -> Stripe Checkout
  -> webhook signé
  -> commit de réservation
PAID
```

Le retour navigateur Stripe n’est **jamais** utilisé comme preuve de paiement ; seul le webhook signé peut passer une commande à `PAID`.

## CI / certification

Workflows principaux :

- Bootstrap CI ;
- M8 Microservices Contracts ;
- M8 Real Microservice E2E Integration ;
- M9 Web Donation Trade Quality ;
- Jury final browser recette ;
- Jury demo offline validation ;
- Jury assets acquisition.

Les gates couvrent notamment :

- lint / typecheck / tests unitaires ;
- Prisma migrations ;
- intégration PostgreSQL ;
- Gateway / Catalog / Marketplace / Notification / Commerce ;
- RabbitMQ ;
- Docker Compose ;
- Kubernetes kind/Minikube de laboratoire ;
- navigateur Chrome réel ;
- audit de dépendances ;
- Trivy HIGH/CRITICAL ;
- tests DON/TROC, RBAC et conversations privées.

## État GitHub V2

La V2 est consolidée dans la PR **#166**.

Les anciennes PR #146 (SEO), #147 (profil) et #148 (conversations) ont divergé de la refonte ; leurs capacités utiles ont été portées manuellement dans la branche de consolidation au lieu d’être fusionnées aveuglément.

La pile #150 → #164 reste historique tant que #166 n’est pas validée et intégrée.

**Aucune fusion et aucun auto-merge sans accord explicite du propriétaire.**

## Limites assumées

Le projet est démontrable mais n’est pas une cible production complète.

Restent notamment :

- PostgreSQL partagé et principaux SQL insuffisamment isolés ;
- Legacy API encore présente ;
- outbox non généralisée à tous les événements ;
- absence de NetworkPolicy et mTLS ;
- rate limiting distribué incomplet ;
- HA / sauvegardes production non démontrées ;
- observabilité principalement centrée sur Gateway ;
- Fanzines / Festival sans backend éditorial ;
- Contact sans backend ;
- préférences utilisateur non persistées ;
- conformité légale / RGPD #112 à finaliser avant publication publique ;
- Stripe uniquement en mode test à ce stade.

## Documentation de référence

- [Architecture finale M10](docs/24-m10-architecture-finale.md)
- [Runbook et limites](docs/25-m10-operations-limits.md)
- [Codespaces](docs/18-codespaces.md)
- [Commerce panier](docs/27-l5a-commerce-cart.md)
- [Commandes](docs/28-l5b-order-drafts.md)
- [Réservation stock](docs/29-l5c1-stock-reservations.md)
- [Stripe Checkout](docs/30-l5c2-stripe-checkout.md)
- [Couverture des 24 écrans](docs/design/plateforme-2-en-1/L0-SCREEN-COVERAGE.md)
- [Dossier preuves jury](docs/33-dossier-preuves-jury-2026-11-18.md)
- [Soutenance 20 minutes](docs/34-soutenance-jury-20min.md)

## Règle de travail

```text
issue
  -> branche
  -> implémentation
  -> CI
  -> recette
  -> accord explicite propriétaire
  -> fusion manuelle
```

Ne jamais relancer une CI en échec sans investigation de la cause racine et ne jamais bloquer le travail indépendant en attendant une CI longue.
