# LOT 4 — Tests automatisés et Quality Gates

## Objectif

Le LOT 4 transforme les objectifs qualité du projet en contrôles reproductibles et bloquants dans GitHub Actions.

La chaîne qualité devient :

`lint → typecheck → unit → integration PostgreSQL → E2E HTTP → coverage gate → build`

Une Pull Request ne doit pas être fusionnée si un de ces contrôles échoue.

## 1. Lint

ESLint 9 est configuré pour le code TypeScript de l'API et les tests.

Commande :

```bash
pnpm api:lint
```

Gate : **0 erreur ESLint**.

## 2. Typecheck

Le contrôle TypeScript strict existant reste obligatoire.

```bash
pnpm api:typecheck
```

Gate : **0 erreur TypeScript**.

## 3. Tests unitaires

Les tests unitaires couvrent notamment :

- authentification JWT guard ;
- RBAC ;
- création d'annonce ;
- visibilité publique ;
- propriété ;
- modification ;
- transition REJECTED → PENDING ;
- approbation/rejet ;
- 404 métier.

```bash
pnpm api:test
```

## 4. Tests d'intégration PostgreSQL

`apps/api/test/listings.integration-spec.ts` utilise le vrai `PrismaService` et une vraie base PostgreSQL.

Scénarios :

- persistance d'une annonce PENDING ;
- récupération des annonces du propriétaire ;
- visibilité publique après approbation ;
- persistance du motif de rejet ;
- annonce rejetée non publique.

Les données du test utilisent des `ownerId` préfixés `lot4-integration-` et sont nettoyées sans effacer les autres données locales.

Commande :

```bash
pnpm api:test:integration
```

## 5. Tests d'acceptation E2E HTTP

`apps/api/test/listings.e2e-spec.ts` démarre une application NestJS de test avec :

- vrais controllers ;
- vrais guards AuthN/RBAC ;
- vrais DTO et `ValidationPipe` ;
- vrai service métier ;
- vrai Prisma/PostgreSQL ;
- vérificateur de token contrôlé uniquement pour le test.

Ce choix teste le comportement HTTP complet sans dépendre du temps de démarrage d'un serveur Keycloak dans la CI. L'intégration réelle Keycloak reste démontrée séparément par les smoke tests LOT 2 et LOT 3.

Scénario automatisé :

`USER → PENDING → USER modération 403 → MODERATOR approve → APPROVED → public`

Le test vérifie aussi :

- body invalide → 400 ;
- absence de bearer token → 401.

Commande :

```bash
pnpm api:test:e2e
```

## 6. Couverture métier

La couverture est calculée explicitement sur :

`src/listings/listings.service.ts`

C'est le backend métier actuellement livré.

Gate Jest :

- **lines ≥ 80 %** ;
- **statements ≥ 80 %**.

Commande :

```bash
pnpm api:test:coverage
```

Si le seuil n'est plus atteint, Jest retourne un code non nul et la CI échoue.

Les formats générés sont :

- texte console ;
- `coverage-summary.json` ;
- LCOV ;
- rapport HTML LCOV.

Répertoire :

`coverage/api`

## 7. Conservation de la preuve CI

GitHub Actions publie le répertoire `coverage/api` comme artifact :

`api-coverage-<commit-sha>`

Rétention : **30 jours**.

Cette preuve complète les logs GitHub Actions et pourra être utilisée dans le dossier de soutenance.

## 8. Commande qualité locale

Tous les contrôles peuvent être exécutés localement :

```bash
pnpm api:quality
```

Cette commande exécute dans l'ordre :

1. lint ;
2. typecheck ;
3. unit tests ;
4. integration PostgreSQL ;
5. E2E HTTP ;
6. coverage gate ;
7. build.

PostgreSQL doit être démarré avant les suites d'intégration/E2E.

## Gate de sortie LOT 4

Le LOT 4 est validé lorsque :

- lint = PASS ;
- typecheck = PASS ;
- unit tests = PASS ;
- integration PostgreSQL = PASS ;
- E2E HTTP = PASS ;
- couverture métier ≥ 80 % = PASS ;
- build = PASS ;
- artifact de couverture présent sur la CI ;
- la PR est empêchée de passer si l'un de ces contrôles échoue.
