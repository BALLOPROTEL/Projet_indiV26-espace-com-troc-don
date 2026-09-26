# LOT 7 — Observabilité

## Objectif

Le LOT 7 rend le POC observable sans introduire une plateforme de logs disproportionnée.

La stack retenue est :

- logs JSON sur stdout ;
- corrélation HTTP via `x-request-id` ;
- métriques Prometheus exposées par l'API ;
- Prometheus dans Minikube ;
- Grafana dans Minikube avec dashboard provisionné.

## 1. Logs structurés

NestJS utilise `JsonLoggerService`.

Chaque log applicatif est sérialisé en JSON.

Les requêtes HTTP produisent en plus un événement du type :

```json
{
  "timestamp": "2026-09-26T08:00:00.000Z",
  "level": "info",
  "event": "http_request",
  "request_id": "4e0b...",
  "method": "GET",
  "path": "/api/listings",
  "status_code": 200,
  "duration_ms": 12.84
}
```

Si le client fournit un `x-request-id` valide, il est repris. Sinon l'API génère un UUID.

Le même identifiant est renvoyé dans le header de réponse `x-request-id`.

## 2. Métriques

Endpoint :

```text
GET /api/metrics
```

Métriques métier d'exploitation principales :

- `projet_indiv26_http_requests_total`
- `projet_indiv26_http_request_duration_seconds_bucket`

Les labels HTTP restent volontairement bornés :

- méthode ;
- route normalisée ;
- code HTTP.

Aucun identifiant d'annonce ou d'utilisateur n'est utilisé comme label Prometheus.

`prom-client` expose aussi les métriques standard du processus Node.js avec le préfixe `projet_indiv26_`, notamment CPU, mémoire et event loop.

## 3. Prometheus

Prometheus est déployé dans le namespace `projet-indiv26`.

Il utilise un ServiceAccount dédié et un Role limité à :

- get pods ;
- list pods ;
- watch pods.

La découverte Kubernetes sélectionne uniquement les pods portant :

```text
app.kubernetes.io/name=api
```

Le scraping est réalisé directement sur les pods, chemin :

```text
/api/metrics
```

Cette approche permet également de visualiser le nombre de pods API réellement observés via :

```promql
sum(up{job="api-pods"})
```

## 4. Grafana

Grafana est interne au cluster et prévu pour la démonstration locale.

Le mode anonyme Viewer est activé afin d'éviter de stocker un mot de passe administrateur de démonstration dans Git.

Aucun Ingress public n'est créé.

La datasource Prometheus et le dashboard sont provisionnés automatiquement.

Dashboard :

```text
LOT 7 — API Observabilité
```

Il contient :

- pods API observés ;
- erreurs 5xx sur une minute ;
- mémoire RSS du processus API ;
- CPU du processus API ;
- requêtes par seconde ;
- latence p95 ;
- réponses HTTP par code.

## 5. Accès local

Après déploiement :

Prometheus :

```bash
kubectl -n projet-indiv26 port-forward service/prometheus 9090:9090
```

Puis :

```text
http://localhost:9090
```

Grafana :

```bash
kubectl -n projet-indiv26 port-forward service/grafana 3003:3000
```

Puis :

```text
http://localhost:3003
```

## 6. Validation

Validation statique :

```bash
pnpm obs:validate:manifests
```

Validation live :

```bash
pnpm obs:validate
```

La validation live contrôle :

1. les rollouts API / Prometheus / Grafana ;
2. l'endpoint `/api/metrics` ;
3. les métriques HTTP et process ;
4. la présence d'un log avec le `request_id` injecté ;
5. une target Prometheus `api-pods` UP ;
6. la santé Grafana ;
7. le dashboard provisionné.

## 7. Limites assumées

Le LOT 7 n'intègre pas Loki, Elasticsearch ou OpenTelemetry Collector.

Les logs restent consultables via Kubernetes :

```bash
kubectl -n projet-indiv26 logs -l app.kubernetes.io/name=api
```

Ce choix garde le POC proportionné au besoin CESI tout en fournissant des preuves d'exploitation concrètes.
