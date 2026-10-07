# Développement cloud avec GitHub Codespaces

Depuis M6, **Docker Compose est le runtime de référence dans Codespaces**. Le Web, le Gateway,
l'API legacy de fallback, Catalog, Marketplace et Notification tournent chacun dans leur propre
conteneur, avec PostgreSQL, RabbitMQ, Keycloak et MinIO.

## Démarrage

Créez un Codespace sur la branche souhaitée, puis dans le terminal :

```bash
pnpm codespaces:up
```

Cette commande :

1. calcule les URLs publiques temporaires du Codespace ;
2. adapte une copie locale du realm Keycloak ;
3. build les images applicatives M6 ;
4. démarre PostgreSQL, RabbitMQ, Keycloak et MinIO ;
5. exécute les migrations `public`, `catalog` et `marketplace` dans des jobs dédiés ;
6. initialise le bucket MinIO ;
7. démarre Legacy API, Catalog, Marketplace, Notification, Gateway et Web ;
8. vérifie les health/readiness et le DNS Docker inter-services.

Le démarrage est donc reproductible à partir d'un checkout propre : il n'est plus nécessaire de
lancer les applications une par une avec des processus `pnpm` sur l'hôte du Codespace.

## Vérification

```bash
pnpm codespaces:check
```

La certification vérifie notamment :

- Keycloak et MinIO ;
- PostgreSQL et les trois ownerships `public`, `catalog`, `marketplace` ;
- RabbitMQ ;
- Legacy API `:3099` ;
- Catalog `:3101` ;
- Marketplace `:3102` ;
- Notification `:3103` ;
- Gateway `:3000` ;
- Web `:3001` ;
- les jobs de migration/bootstrap avec code de sortie `0` ;
- Gateway → Legacy/Catalog/Marketplace par DNS Docker ;
- Marketplace → Catalog par DNS Docker ;
- Web → Gateway via le rewrite Next.js compilé dans l'image ;
- le contrat public `/api/listings` via Gateway ;
- l'acceptation du redirect URI OIDC Web et un JWT Keycloak réel jusqu'au Marketplace Service dans le smoke CI.

## Logs

```bash
pnpm codespaces:dev
```

Cette commande suit les logs des six conteneurs applicatifs. `Ctrl+C` arrête uniquement
l'affichage des logs ; les conteneurs continuent de tourner.

## Ports exposés dans Codespaces

- Web : 3001
- API Gateway : 3000
- Keycloak : 8081
- RabbitMQ Management : 15672
- MinIO Console : 9001

Les services Legacy/Catalog/Marketplace/Notification ont aussi des ports locaux pour diagnostic,
mais ils ne constituent pas l'entrée publique de l'application.

Le navigateur utilise l'URL publique Codespaces de Keycloak. Les backends valident les mêmes JWT
avec le JWKS interne `http://keycloak:8080`, ce qui évite de faire repasser le trafic
inter-conteneurs par les URLs publiques Codespaces.

## Docker Compose hors Codespaces

Le même runtime est disponible localement :

```bash
pnpm compose:up
pnpm compose:check
pnpm compose:logs
pnpm compose:down
```

Le Web est alors disponible sur `http://localhost:3001` et le Gateway sur
`http://localhost:3000`.

## Kubernetes / Minikube

Les binaires restent disponibles mais le cluster n'est jamais démarré automatiquement.
M7 adaptera Kubernetes à cette architecture multi-services.

## Fin de session

Pour arrêter la stack sans supprimer les volumes de développement :

```bash
pnpm codespaces:down
```

Avant de supprimer le Codespace, poussez évidemment vos changements Git. Les volumes du Codespace
restent des données de développement jetables ; GitHub reste la source de vérité pour le code et
les migrations.
