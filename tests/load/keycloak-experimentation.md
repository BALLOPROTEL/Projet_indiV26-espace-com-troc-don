# LOT 8 — Protocole d'expérimentation Keycloak

## But

Mesurer Keycloak séparément de l'API afin de ne pas confondre :
- latence d'authentification ;
- latence métier de l'API ;
- comportement du HPA de l'API.

Ce protocole est volontairement séparé du scénario JMeter principal.

## Préconditions

Créer uniquement pour l'expérimentation :
- un client Keycloak dédié aux tests ;
- un utilisateur de test dédié ;
- des identifiants injectés par variables d'environnement.

Aucun mot de passe, client secret ou token ne doit être versionné dans Git.

## Mesures proposées

Tester le endpoint de token du realm avec une charge progressive contrôlée :

1. 1 utilisateur virtuel pendant 30 secondes ;
2. 5 utilisateurs virtuels pendant 60 secondes ;
3. 10 utilisateurs virtuels pendant 60 secondes.

Pour chaque palier relever :
- nombre de requêtes ;
- débit ;
- taux d'erreur ;
- p50 ;
- p95 ;
- p99 ;
- CPU / mémoire du conteneur Keycloak.

## Règles d'interprétation

Ces mesures représentent uniquement l'environnement local de laboratoire.

Elles ne permettent pas de conclure :
- à la capacité d'un Keycloak de production ;
- au dimensionnement d'un cluster réel ;
- au comportement avec base Keycloak dédiée, cache distribué ou plusieurs replicas.

## Pourquoi ce test n'est pas lancé par défaut

Le LOT 8 principal cherche à démontrer le comportement de l'API et de son HPA.

Charger simultanément Keycloak introduirait une seconde variable et rendrait l'expérimentation plus difficile à interpréter.

L'expérimentation Keycloak doit donc être exécutée séparément si une preuve complémentaire est souhaitée.
