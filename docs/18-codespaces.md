# Développement cloud avec GitHub Codespaces

Cette configuration permet de développer le projet individuel dans GitHub Codespaces sans conserver
le dépôt, les `node_modules`, les images Docker, PostgreSQL, Keycloak ou MinIO sur le PC Windows.

## Démarrage

Depuis GitHub, créez un Codespace sur la branche qui contient `.devcontainer/`.

Le premier démarrage installe automatiquement :

- Node.js 24 ;
- pnpm 10.24.0 ;
- Docker-in-Docker ;
- kubectl, Helm et Minikube ;
- les dépendances pnpm ;
- le client Prisma.

Les services lourds ne démarrent pas automatiquement afin d'économiser le quota gratuit.

Dans le terminal :

```bash
pnpm codespaces:up
pnpm codespaces:check
pnpm codespaces:dev
```

`codespaces:up` prépare automatiquement les URLs temporaires du Codespace, adapte le realm
Keycloak sans modifier le fichier suivi par Git, démarre PostgreSQL, Keycloak et MinIO, initialise
le bucket privé et applique les migrations Prisma.

`codespaces:dev` lance l'API NestJS et le frontend Next.js dans le même terminal.

## Ports

- Web : 3001
- API / Swagger : 3000
- Keycloak : 8081
- MinIO Console : 9001

Le frontend utilise un proxy Next.js vers l'API afin de conserver les appels applicatifs sur
l'origine Web. Keycloak reste exposé sur son port Codespaces dédié pour le flux OIDC navigateur.

## Kubernetes / Minikube

Les binaires sont disponibles, mais le cluster n'est jamais démarré automatiquement. Les commandes
du projet restent disponibles :

```bash
pnpm k8s:up
pnpm k8s:validate
pnpm obs:up
pnpm obs:validate
pnpm load:run
```

Ces opérations sont beaucoup plus lourdes que le développement Web/API classique. Ne les lancez
que lorsque vous avez besoin de produire les preuves Kubernetes, observabilité ou charge.

## Fin de session

Avant de supprimer le Codespace :

```bash
git status
git add .
git commit -m "..."
git push
```

Puis arrêtez ou supprimez le Codespace depuis GitHub. La suppression libère également son stockage.

Pour arrêter seulement PostgreSQL, Keycloak et MinIO sans supprimer les volumes Docker :

```bash
pnpm codespaces:down
```

Les données du Codespace sont des données de développement jetables. GitHub reste la source de
vérité pour le code et les migrations.
