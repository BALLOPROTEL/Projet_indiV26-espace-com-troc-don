# LOT 6 — Kubernetes, Ingress/TLS, probes et HPA

## Objectif

Le LOT 6 déploie le POC sur Kubernetes dans un environnement **Minikube de démonstration**.

Ce lot ne prétend pas représenter une production haute disponibilité. Il prouve de manière reproductible :

- le déploiement de l'API ;
- la connectivité PostgreSQL ;
- les probes Kubernetes ;
- les ressources CPU/mémoire ;
- un Ingress HTTPS ;
- un HorizontalPodAutoscaler ;
- l'observabilité opérationnelle avec `kubectl`.

## 1. Périmètre du sandbox

Namespace :

`projet-indiv26`

Composants déployés :

- API NestJS ;
- PostgreSQL 16 ;
- PersistentVolumeClaim PostgreSQL ;
- Service API ;
- Service PostgreSQL ;
- ConfigMap API ;
- Secret API ;
- Secret PostgreSQL ;
- Secret TLS ;
- Ingress NGINX ;
- HPA `autoscaling/v2`.

Keycloak n'est pas redéployé dans ce sandbox.

L'authentification OIDC/RBAC a déjà été validée expérimentalement au LOT 2. Le LOT 6 isole volontairement la preuve Kubernetes : déploiement, disponibilité, ressources, Ingress/TLS et autoscaling.

Le ConfigMap contient donc un issuer OIDC de démonstration non fonctionnel pour les routes protégées. Les endpoints publics et de santé restent exploitables. Une plateforme intégrée pourra remplacer `KEYCLOAK_ISSUER` par l'URL d'un véritable fournisseur OIDC.

## 2. Structure

```text
infra/k8s/minikube/
├── namespace.yaml
├── postgres-pvc.yaml
├── postgres-deployment.yaml
├── postgres-service.yaml
├── postgres-secret.example.yaml
├── api-configmap.yaml
├── api-secret.example.yaml
├── api-deployment.yaml
├── api-service.yaml
├── api-ingress.yaml
├── api-hpa.yaml
└── kustomization.yaml
```

Les fichiers `*.example.yaml` montrent la forme attendue des Secrets, mais ne sont **pas inclus** dans Kustomize.

Les véritables Secrets sont créés à l'exécution.

## 3. Gestion des Secrets

Le dépôt ne versionne pas le mot de passe PostgreSQL réel.

Le script `scripts/lot6-minikube-up.sh` :

1. crée un mot de passe aléatoire au premier déploiement ;
2. crée le Secret `postgres-credentials` ;
3. construit la `DATABASE_URL` ;
4. crée le Secret `api-secrets`.

Un Secret Kubernetes est un mécanisme de distribution, pas un coffre-fort : ses valeurs sont encodées et ne sont pas automatiquement chiffrées au repos dans tous les clusters.

En production, il faudrait prévoir un mécanisme adapté de gestion de secrets et le chiffrement de l'état du cluster.

## 4. Image applicative

Image Minikube :

`projet-indiv26-api:lot6-local`

Le script reconstruit l'image avec le Dockerfile durci du LOT 5 puis l'injecte dans le runtime Minikube avec :

```bash
minikube image load projet-indiv26-api:lot6-local
```

Le Deployment utilise :

```yaml
imagePullPolicy: Never
```

Cela évite de dépendre de la visibilité GHCR pendant la démonstration locale.

## 5. Probes

L'API expose déjà :

- `GET /api/health/live`
- `GET /api/health/ready`

Kubernetes les utilise comme suit :

### startupProbe

`/api/health/live`

Elle laisse jusqu'à environ 60 secondes au processus pour démarrer avant que liveness prenne le relais.

### livenessProbe

`/api/health/live`

Elle confirme que le processus applicatif répond.

### readinessProbe

`/api/health/ready`

Elle interroge PostgreSQL via Prisma. Le pod ne reçoit donc pas de trafic Service tant que la base n'est pas accessible.

## 6. Ressources

API :

```yaml
requests:
  cpu: 100m
  memory: 128Mi
limits:
  cpu: 500m
  memory: 512Mi
```

PostgreSQL utilise le même ordre de grandeur pour le sandbox.

Les requests sont indispensables pour que le HPA CPU puisse calculer un pourcentage d'utilisation cohérent.

## 7. Durcissement du pod API

Le pod API applique :

- `runAsNonRoot: true` ;
- UID/GID 1000 ;
- `seccompProfile: RuntimeDefault` ;
- `allowPrivilegeEscalation: false` ;
- `readOnlyRootFilesystem: true` ;
- suppression de toutes les Linux capabilities ;
- `automountServiceAccountToken: false`.

Un volume `emptyDir` est monté sur `/tmp` afin de conserver un répertoire temporaire writable sans rendre le filesystem racine modifiable.

## 8. PostgreSQL et migrations

PostgreSQL dispose :

- d'un Service ClusterIP ;
- d'un PVC de 1 Gi ;
- de probes `pg_isready`.

Le script effectue ensuite un port-forward temporaire vers PostgreSQL et exécute :

```bash
pnpm db:deploy
```

Les migrations Prisma sont donc appliquées avant la validation fonctionnelle de l'API.

## 9. Ingress et TLS

Hostname :

`api.projet-indiv26.local`

IngressClass :

`nginx`

Le script active l'addon Minikube :

```bash
minikube addons enable ingress
```

Le certificat TLS est généré localement avec OpenSSL et stocké dans un Secret Kubernetes de type :

`kubernetes.io/tls`

Le certificat est autosigné et valable quelques jours. Il sert uniquement à démontrer la terminaison TLS.

Une production réelle utiliserait une PKI ou un mécanisme tel que cert-manager avec un émetteur approuvé.

## 10. HPA

Le HPA utilise `autoscaling/v2`.

Paramètres :

- minReplicas : 1 ;
- maxReplicas : 4 ;
- métrique : CPU ;
- cible : 60 % de la request CPU ;
- stabilisation scale-down : 60 s.

Le script active :

```bash
minikube addons enable metrics-server
```

La preuve dynamique de montée puis descente en charge sera approfondie au LOT 8 avec JMeter.

Le LOT 6 doit au minimum prouver que le HPA reçoit des métriques exploitables.

## 11. Déploiement

```bash
bash scripts/lot6-minikube-up.sh
```

Le script :

1. démarre Minikube si nécessaire ;
2. active Ingress et metrics-server ;
3. construit l'image ;
4. charge l'image dans Minikube ;
5. crée le namespace ;
6. crée les Secrets runtime ;
7. génère le certificat TLS ;
8. déploie PostgreSQL ;
9. applique les migrations ;
10. déploie API, Service, Ingress et HPA ;
11. attend les rollouts.

## 12. Validation

Validation statique uniquement :

```bash
bash scripts/lot6-k8s-validate.sh --manifest-only
```

Validation complète du cluster :

```bash
bash scripts/lot6-k8s-validate.sh
```

Le script vérifie :

- rendu Kustomize ;
- absence des Secrets examples dans le rendu ;
- probes ;
- requests/limits ;
- Pod SecurityContext ;
- paramètres HPA ;
- existence des Secrets runtime ;
- liveness HTTP 200 ;
- readiness HTTP 200 ;
- Ingress HTTPS ;
- disponibilité des métriques HPA.

## 13. Commandes d'observation jury

```bash
kubectl -n projet-indiv26 get pods
kubectl -n projet-indiv26 get svc
kubectl -n projet-indiv26 get ingress
kubectl -n projet-indiv26 get hpa
kubectl -n projet-indiv26 get pvc
kubectl -n projet-indiv26 describe deployment api
kubectl -n projet-indiv26 describe hpa api
```

Pour observer les métriques :

```bash
kubectl top pods -n projet-indiv26
```

## 14. Limites assumées

Ce déploiement est un **sandbox Minikube**.

Il ne démontre pas :

- une production multi-nœuds ;
- un PostgreSQL haute disponibilité ;
- une PKI de production ;
- une sauvegarde/restauration ;
- un secret manager ;
- une politique réseau complète ;
- un load balancer cloud ;
- un fournisseur OIDC déployé dans le cluster.

Ces éléments relèvent de la cible de production et ne doivent pas être confondus avec la preuve technique locale.

## Gate de sortie LOT 6

Le lot est validé lorsque :

- Kustomize rend les manifests sans erreur ;
- PostgreSQL est Ready ;
- API est Ready ;
- liveness HTTP 200 ;
- readiness HTTP 200 ;
- Ingress HTTPS répond ;
- Secret TLS présent ;
- requests/limits présents ;
- runtime API non-root ;
- HPA min 1 / max 4 / CPU 60 % ;
- metrics-server fournit une métrique au HPA ;
- CI PR verte ;
- merge `main` et CI post-merge verte.
