# GitHub hardening et releases — #171

## État observé avant durcissement

Audit du 23 novembre 2026 :

- `main` est bien marquée **protected: true** ;
- un seul check est actuellement requis :
  `Validate repository structure` ;
- aucun Ruleset GitHub n'est présent ;
- l'auto-merge est désactivé au niveau dépôt ;
- aucune GitHub Release n'est publiée ;
- le seul tag existant est `baseline-2026-10-19`.

Le endpoint détaillé de branch protection renvoie `403` avec l'intégration
GitHub utilisée par ChatGPT, car cette intégration ne dispose pas du droit
Repository Administration. Le script ci-dessous permet donc l'audit et
l'application finale avec un token administrateur explicite.

## Protection cible de `main`

La configuration cible requiert une PR et les trois jobs stables suivants :

- `Validate repository structure` — Bootstrap CI ;
- `Contract compatibility M8` — M8 Microservices Contracts ;
- `M9 Web lint typecheck unit build` — qualité Web.

Autres garde-fous :

- branche à jour avec `main` avant merge (`strict: true`) ;
- conversation review résolue ;
- protection appliquée aussi aux administrateurs ;
- aucun force-push ;
- aucune suppression de `main` ;
- zéro approbation externe obligatoire, car le dépôt peut être maintenu par une seule personne ;
- auto-merge reste désactivé au niveau dépôt.

### Audit / application

Le script `scripts/github-main-protection.sh` n'embarque aucun secret.

Avec un token finement scoped disposant de **Repository Administration** :

```bash
export GH_TOKEN='...'
./scripts/github-main-protection.sh --audit
./scripts/github-main-protection.sh --apply
```

Le mode `--apply` ré-audite immédiatement la protection après écriture.

## Release V2

Le workflow **Manual controlled release** ne réécrit jamais un tag existant.

Pour la V2 :
- il cible automatiquement le HEAD courant de `origin/main` au moment du lancement ;
- le tag doit suivre `vX.Y.Z` ;
- un tag existant sur un autre SHA provoque un échec ;
- une release déjà publiée provoque un échec.

La release V2 ne doit être lancée qu'après intégration des lots #168, #169 et #170 et validation des CI.

## Release jury historique

Le même workflow verrouille ces valeurs :

- SHA : `209761290d04827f68941b990a887d61186dc234`
- tag : `jury-final-2026-11-19`
- titre : `Jury Final — 2026-11-19`

Le workflow refuse de déplacer un tag historique existant.
