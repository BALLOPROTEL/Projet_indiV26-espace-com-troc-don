# LOT 8 — Charge, performance et HPA

## Objectif

Le LOT 8 mesure le comportement du POC sous charge dans un environnement local Minikube.

Les résultats sont des **mesures de laboratoire**. Ils ne doivent pas être présentés comme un benchmark de production.

Le protocole mesure :

- p50 ;
- p95 ;
- p99 ;
- débit en requêtes par seconde ;
- taux d'erreur ;
- réaction du HPA Kubernetes ;
- nombre de replicas observés.

## 1. Scénario testé

Endpoint :

```text
GET /api/listings
```

Cet endpoint est public, ne nécessite pas de token et traverse la couche métier + Prisma + PostgreSQL.

Le test ne mélange donc pas la performance de Keycloak avec celle de l'API.

Plan versionné :

```text
tests/load/lot8-api-hpa.jmx
```

## 2. Pourquoi JMeter tourne dans Kubernetes

Le générateur de charge est exécuté dans un Job Kubernetes temporaire.

Avantages :

- pas de dépendance à une installation JMeter locale ;
- trafic direct vers le Service API ;
- pas de port-forward dans le chemin de mesure ;
- protocole reproductible ;
- le générateur est isolé de l'API.

L'image est construite depuis :

```text
tests/load/Dockerfile.jmeter
```

JMeter utilisé :

```text
Apache JMeter 5.6.3
```

## 3. Baseline

Valeurs par défaut :

```text
threads     = 5
ramp-up     = 5 s
duration    = 30 s
```

But :

- obtenir une référence locale faible charge ;
- vérifier le taux d'erreur ;
- mesurer p50 / p95 / p99 avant stress.

## 4. Stress HPA

Valeurs par défaut :

```text
threads     = 80
ramp-up     = 10 s
duration    = 120 s
```

Le HPA existant cible :

```text
CPU moyen : 60 %
min replicas : 1
max replicas : 4
```

Le runner échantillonne le HPA toutes les 5 secondes et écrit :

```text
hpa-history.csv
```

Le test n'est considéré comme concluant que si un nombre de replicas supérieur à 1 est observé.

## 5. Exécution

Précondition : le LOT 7 doit être déployé.

Si nécessaire :

```bash
pnpm obs:up
pnpm obs:validate
```

Puis valider statiquement le plan :

```bash
pnpm load:validate
```

Lancer l'expérimentation :

```bash
pnpm load:run
```

Le runner :

1. vérifie API / Prometheus / Grafana / HPA ;
2. construit l'image JMeter ;
3. charge l'image dans Minikube ;
4. exécute la baseline ;
5. attend le retour HPA à 1 replica si nécessaire ;
6. exécute le stress ;
7. observe le HPA toutes les 5 secondes ;
8. récupère les résultats JMeter ;
9. calcule p50 / p95 / p99 / débit / erreurs ;
10. vérifie qu'un scale-up a réellement été observé.

## 6. Paramètres surchargeables

Exemple de stress plus fort :

```bash
LOT8_STRESS_THREADS=120 \
LOT8_STRESS_DURATION_SECONDS=150 \
pnpm load:run
```

Variables disponibles :

```text
LOT8_BASELINE_THREADS
LOT8_BASELINE_RAMP_SECONDS
LOT8_BASELINE_DURATION_SECONDS
LOT8_STRESS_THREADS
LOT8_STRESS_RAMP_SECONDS
LOT8_STRESS_DURATION_SECONDS
LOT8_REPORT_ROOT
LOT8_RUN_ID
```

## 7. Résultats

Les fichiers sont générés sous :

```text
reports/load/<timestamp>/
```

Ils ne sont pas versionnés.

Artefacts principaux :

```text
baseline-results.jtl
stress-results.jtl
baseline-summary.json
stress-summary.json
hpa-history.csv
hpa-before.txt
hpa-after.txt
report.md
```

Le rapport Markdown contient une comparaison baseline / stress avec :

- nombre de samples ;
- débit ;
- taux d'erreur ;
- p50 ;
- p95 ;
- p99 ;
- latence max ;
- maximum de replicas HPA observé.

## 8. Lecture avec Prometheus / Grafana

Pendant le stress, le dashboard LOT 7 permet de corréler :

- requêtes/seconde ;
- p95 API ;
- CPU process ;
- mémoire ;
- erreurs HTTP ;
- nombre de pods API observés.

Le CSV HPA reste la preuve Kubernetes directe du scaling.

## 9. Keycloak

La charge Keycloak n'est pas mélangée au scénario API.

Le protocole séparé est documenté dans :

```text
tests/load/keycloak-experimentation.md
```

Cette séparation évite d'attribuer à l'API une latence provenant de l'Identity Provider.

## 10. Limites de l'expérimentation

Les résultats dépendent directement :

- des ressources allouées à Docker Desktop / WSL ;
- des ressources du profil Minikube ;
- du CPU de la machine hôte ;
- de PostgreSQL exécuté dans le même cluster ;
- du générateur JMeter exécuté dans ce même Minikube ;
- du faible volume de données du POC ;
- de la topologie mono-nœud Minikube.

Ils ne permettent donc pas de déterminer :

- une capacité de production ;
- un nombre réel d'utilisateurs simultanés supportés ;
- un SLA ;
- un dimensionnement cloud.

Le résultat attendu du LOT 8 est une **expérimentation reproductible et interprétable**, pas un chiffre marketing.
