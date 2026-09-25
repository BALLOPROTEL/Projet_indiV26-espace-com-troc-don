# LOT 5 — Docker, supply chain, scans et GHCR

## Objectif

Le LOT 5 transforme l'API validée par les Quality Gates du LOT 4 en image de livraison contrôlée.

La chaîne supply chain est :

`audit dépendances → build image → smoke non-root → scan Trivy → gate HIGH/CRITICAL → publication GHCR`

La publication n'a lieu que sur un push de la branche `main`, donc après validation de Pull Request.

## 1. Image API

Dockerfile :

`apps/api/Dockerfile`

Caractéristiques :

- build multi-stage ;
- base explicitement versionnée : `node:24.20.0-alpine3.22` ;
- pnpm explicitement versionné : `10.24.0` ;
- installation avec lockfile gelé ;
- génération Prisma ;
- build NestJS ;
- déploiement des dépendances de production avec `pnpm deploy --prod` ;
- runtime `NODE_ENV=production` ;
- port applicatif 3000 ;
- exécution avec l'utilisateur non-root `node`.

Le tag de base est explicitement versionné. Il reste néanmoins un tag de registre et non un digest cryptographiquement épinglé ; la traçabilité de l'image applicative est assurée par le tag de commit et les labels OCI.

## 2. Contexte Docker

Le fichier `.dockerignore` exclut notamment :

- dépôt Git ;
- `node_modules` ;
- rapports de couverture ;
- sorties de build locales ;
- fichiers `.env` ;
- logs ;
- résultats de tests temporaires.

Les secrets locaux ne doivent donc pas entrer dans le contexte de build.

## 3. Audit des dépendances

Commande locale :

```bash
pnpm api:audit:prod
```

Commande CI équivalente :

`pnpm audit --prod --audit-level=high`

Le rapport JSON est conservé sous :

`reports/security/pnpm-audit.json`

Quality Gate : aucun finding de dépendance de production au niveau qui fait échouer l'audit HIGH/CRITICAL.

## 4. Remédiation CVE-2026-40345

Le premier audit LOT 5 a détecté :

- advisory : `GHSA-ggr8-5vv4-36mx` / `CVE-2026-40345` ;
- package : `deepmerge-ts` ;
- sévérité : HIGH ;
- version vulnérable : `< 8.0.0` ;
- chemin observé : Prisma / `@prisma/config`.

La version Prisma stable utilisée dans le projet ne permet pas encore d'obtenir naturellement une version corrigée de `deepmerge-ts`. Le workspace impose donc temporairement :

```json
{
  "pnpm": {
    "overrides": {
      "deepmerge-ts": "8.0.1"
    }
  }
}
```

Cette remédiation est explicite, versionnée et doit être supprimée dès qu'une version Prisma stable embarque nativement `deepmerge-ts >= 8.0.0`.

Après modification du lockfile, les contrôles obligatoires sont :

```bash
pnpm db:generate
pnpm db:deploy
pnpm api:quality
pnpm api:audit:prod
```

Aucune baisse du seuil d'audit n'est utilisée.

## 5. Build local

```bash
pnpm api:image:build
```

Image :

`projet-indiv26-api:lot5-local`

## 6. Smoke test de l'image

```bash
pnpm api:image:smoke
```

Le script vérifie :

1. que le runtime Docker est configuré avec l'utilisateur `node` ;
2. que le conteneur démarre ;
3. que `GET /api/health/live` répond HTTP 200.

Le smoke n'exige pas une base disponible car le liveness vérifie le processus applicatif, pas la readiness PostgreSQL.

## 7. Scan Trivy

La CI utilise l'action officielle :

`aquasecurity/trivy-action@v0.36.0`

Deux passages sont effectués :

1. génération du rapport JSON ;
2. gate bloquant avec `exit-code: 1`.

Périmètre :

- vulnérabilités OS ;
- vulnérabilités des bibliothèques ;
- sévérités HIGH et CRITICAL ;
- les vulnérabilités non corrigées ne sont pas ignorées.

Rapport :

`reports/security/trivy-image.json`

Quality Gate : **0 HIGH/CRITICAL non acceptée**.

Aucune exception automatique n'est configurée dans le LOT 5. Si une exception devait devenir nécessaire, elle devrait être documentée, justifiée et rattachée à une issue de remédiation.

## 8. Artifact de sécurité

Même en cas d'échec d'un scan, la CI tente de publier :

`security-reports-<commit-sha>`

Contenu attendu :

- `pnpm-audit.json` ;
- `trivy-image.json` lorsque le build et le scan ont pu s'exécuter.

Rétention : **30 jours**.

## 9. Traçabilité de l'image

La CI calcule :

`ghcr.io/<owner>/projet-indiv26-api:sha-<12 premiers caractères du commit>`

Labels OCI intégrés :

- `org.opencontainers.image.source` ;
- `org.opencontainers.image.revision` ;
- `org.opencontainers.image.version`.

Le label `revision` contient le SHA Git complet.

## 10. Publication GHCR

Sur Pull Request :

- build ;
- smoke ;
- audit ;
- scan ;
- **aucune publication**.

Sur `main` après merge et CI verte :

- connexion à GHCR avec `GITHUB_TOKEN` ;
- push du tag de commit ;
- push du tag `latest`.

Aucun mot de passe GHCR personnel n'est versionné.

## 11. Validation locale

```bash
pnpm api:audit:prod
pnpm api:image:build
pnpm api:image:smoke
```

Scan local optionnel avec Trivy 0.74.0 :

```bash
docker run --rm \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v "$HOME/.cache/trivy:/root/.cache/" \
  aquasec/trivy:0.74.0 image \
  --severity HIGH,CRITICAL \
  --exit-code 1 \
  projet-indiv26-api:lot5-local
```

## Gate de sortie LOT 5

Le lot est validé lorsque :

- audit dépendances PASS ;
- build Docker PASS ;
- runtime non-root prouvé ;
- liveness HTTP 200 prouvée ;
- Trivy HIGH/CRITICAL PASS ;
- rapports de sécurité présents ;
- PR CI verte ;
- merge dans `main` ;
- CI post-merge verte ;
- image publiée dans GHCR avec un tag lié au commit.
