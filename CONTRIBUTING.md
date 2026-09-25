# Contribution guide

## Principes

Le dépôt doit rester démontrable, reproductible et traçable. Toute modification significative doit être liée à une issue GitHub.

## Branches

La branche `main` est la référence du projet.

Conventions recommandées :

- `feat/<issue>-<description>`
- `fix/<issue>-<description>`
- `chore/<issue>-<description>`
- `docs/<issue>-<description>`
- `test/<issue>-<description>`

Exemple : `feat/12-listing-create`.

## Commits

Utiliser des messages courts et explicites, idéalement compatibles Conventional Commits :

- `feat: ...`
- `fix: ...`
- `test: ...`
- `docs: ...`
- `chore: ...`
- `refactor: ...`
- `ci: ...`
- `security: ...`

## Pull Requests

Une Pull Request doit :

1. référencer l'issue concernée ;
2. décrire le changement et son impact ;
3. indiquer comment le changement a été testé ;
4. signaler les conséquences sécurité éventuelles ;
5. joindre les preuves utiles lorsque la PR contribue à une compétence évaluée ;
6. passer les contrôles CI applicables avant fusion.

## Definition of Done

Une fonctionnalité n'est terminée que si :

- les critères d'acceptation sont satisfaits ;
- le code compile et passe lint/typecheck ;
- les tests pertinents sont verts ;
- les contrôles d'authentification/autorisation sont testés lorsqu'ils s'appliquent ;
- aucun Critical/High non accepté n'est introduit ;
- la documentation impactée est mise à jour ;
- les preuves nécessaires à la soutenance sont conservées.

## Secrets

Aucun mot de passe, token, certificat privé, fichier `.env` réel ou secret Kubernetes ne doit être commité dans Git.
