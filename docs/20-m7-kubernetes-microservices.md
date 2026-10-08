# M7 — Kubernetes multi-services

## Objectif

M7 porte sur Kubernetes l'architecture microservices certifiée en M6. Le sandbox de référence reste Minikube pour la démonstration, tandis que la CI utilise kind pour vérifier automatiquement un vrai cluster.

La cible n'est plus l'ancien monolithe Kubernetes du LOT 6. Les workloads applicatifs sont désormais séparés :

- Web ;
- API Gateway ;
- Legacy API, uniquement comme fallback Strangler ;
- Catalog Service ;
- Marketplace Service ;
- Notification Service ;
- PostgreSQL ;
- RabbitMQ ;
- Keycloak ;
- MinIO.

Prometheus et Grafana restent présents et l'observabilité est désormais rattachée au Gateway.

## Topologie

```text
Browser
  |
  +-- https://app.projet-indiv26.test  -> Web
  |
  +-- https://api.projet-indiv26.test  -> API Gateway
  |                                         |
  |                                         +-> legacy-api:3099
  |                                         +-> catalog-service:3101
  |                                         +-> marketplace-service:3102
  |
  +-- https://auth.projet-indiv26.test -> Keycloak

Marketplace Service -> catalog-service:3101
Marketplace Service -> rabbitmq:5672 -> Notification Service
Catalog Service     -> postgres:5432 (schema catalog)
Marketplace Service -> postgres:5432 (schema marketplace)
Legacy API          -> postgres:5432 (schema public)
Catalog Service     -> minio:9000
```

Aucun appel inter-service applicatif ne dépend de `localhost` ou `127.0.0.1`.

## Workloads et isolation

Chaque application possède son propre `Deployment` et son propre `Service` ClusterIP.

Les trois ownerships Prisma sont migrés par des Jobs séparés :

- `legacy-migrate` ;
- `catalog-migrate` ;
- `marketplace-migrate`.

MinIO garde un Job `minio-bootstrap` dédié.

Les Secrets ne sont pas versionnés. `scripts/m7-k8s-runtime-config.sh` les crée ou les réutilise pour le cluster courant, puis génère :

- URLs PostgreSQL par schéma ;
- token inter-service Catalog/Marketplace ;
- URL RabbitMQ ;
- encodage URL des credentials PostgreSQL/RabbitMQ réutilisés avant construction des DSN ;
- token de métriques Gateway ;
- credentials Keycloak ;
- UUID des comptes de démonstration Keycloak existants (snapshot préalable au premier changement de base) ;
- credentials MinIO ;
- realm Keycloak adapté aux URLs Kubernetes ;
- certificat TLS local pour les trois hosts de démonstration.

## Persistance Keycloak et conservation des identités

Keycloak utilise désormais une base PostgreSQL dédiée `keycloak` sur le **même serveur PostgreSQL persistant**, mais **sans partager** les schémas Prisma `public`, `catalog` et `marketplace`. Le script de déploiement crée cette base de manière idempotente avant de démarrer Keycloak ; les credentials restent dans le Secret `postgres-credentials`. La recréation du pod Keycloak n'efface donc plus ses utilisateurs ni leurs identifiants JWT `sub`.

**Migration d'un Minikube M7 existant** : l'ancien Keycloak utilisait un stockage H2 embarqué éphémère. Avant de changer sa configuration, le script `scripts/m7-keycloak-identity-snapshot.sh` interroge l'API Admin du Keycloak encore actif et enregistre les UUID des trois comptes `demo-user`, `demo-moderator` et `demo-admin` dans le Secret Kubernetes `keycloak-user-ids`. Le générateur de realm réutilise ces UUID lors de l'import dans PostgreSQL. Sans ancien déploiement, le realm possède des UUID fixes pour ses comptes de démonstration. Le snapshot n'est pas régénéré après chaque déploiement.

**Protection contre une migration partielle** : si l'ancien Keycloak contient des comptes hors de ces trois démonstrations, ou si l'API Admin / la sauvegarde des UUID échoue, le déploiement s'arrête **avant** de changer de stockage. Une migration complète et contrôlée des comptes, rôles et credentials est alors nécessaire. Les personnalisations préexistantes (par exemple une modification manuelle du mot de passe d'un compte de démonstration) ne sont pas transférées par ce snapshot d'UUID : ne présentez pas cette procédure comme un export complet d'un Keycloak de production.

Le smoke CI kind redémarre réellement le déploiement Keycloak après obtention d'un premier JWT, renouvelle le token, puis exige le **même `sub`** après recréation du pod. Il exécute toutes ses commandes avec un kubeconfig temporaire, qui est supprimé après le test sans modifier le contexte Kubernetes habituel du développeur.

## Probes et ressources

Les six workloads applicatifs possèdent des probes Kubernetes et des requests/limits.

Le Gateway utilise :

- startup : `/api/health/live` ;
- liveness : `/api/health/live` ;
- readiness Kubernetes : `/api/health/live`, afin qu'une panne d'un upstream indépendant ne retire pas le Gateway du Service ; l'endpoint agrégé `/api/health/ready` reste disponible pour le diagnostic global.

Legacy utilise les mêmes chemins avec le préfixe `/api`. Catalog, Marketplace et Notification utilisent `/health/live` et `/health/ready`. Le Web est sondé sur `/`.

PostgreSQL, RabbitMQ, Keycloak et MinIO ont également leurs contrôles de disponibilité.

## HPA

Le HPA est maintenant appliqué au Gateway, le véritable point d'entrée backend :

- minReplicas : 1 ;
- maxReplicas : 4 ;
- cible CPU : 60 % ;
- scale-down stabilization : 60 s.

## Ingress et TLS

Un seul Ingress `platform` expose :

- `app.projet-indiv26.test/` -> Web ;
- `app.projet-indiv26.test/api/*` -> **Gateway directement**, y compris pour les uploads multipart ;
- `api.projet-indiv26.test` -> Gateway ;
- `auth.projet-indiv26.test` -> Keycloak.

Le certificat local contient les trois SAN DNS. L'Ingress autorise jusqu'à 50 MiB par requête afin de couvrir les uploads multipart valides. En dirigeant `/api` depuis le host de l'application **directement vers Gateway**, il contourne la limite de mise en tampon du proxy Next.js autonome (10 MB par défaut), sans nécessiter de reconstruire l'image Web. Le rewrite Next.js reste disponible hors Ingress pour le développement local. L'application du manifest `kubectl apply -f infra/k8s/minikube/platform-ingress.yaml` suffit pour mettre à jour le routage du cluster existant.

Les hosts M7 sont volontairement fixes dans ce sandbox (`app.projet-indiv26.test`, `api.projet-indiv26.test`, `auth.projet-indiv26.test`) afin que realm Keycloak, issuer JWT, CORS, TLS et Ingress restent cohérents. Le suffixe réservé `.test` est utilisé à la place de `.local` pour éviter le conflit mDNS.

RabbitMQ conserve un hostname et un `RABBITMQ_NODENAME` stables afin que son PVC réutilise le même répertoire Mnesia après recréation du pod.

Le frontend conserve son contrat public `/api`; son image est compilée avec `API_INTERNAL_URL=http://gateway:3000`.

## Déploiement Minikube

```bash
pnpm m7:k8s:up
```

Cette commande :

1. démarre Minikube si nécessaire avec le profil explicite `-p minikube` et force le contexte `kubectl` sur `minikube` (toutes les actions Minikube utilisent ce même profil) ;
2. inscrit les trois hosts `.test` dans `/etc/hosts` avec l'IP Minikube et vérifie leur résolution ;
3. active Ingress et metrics-server ;
4. build les images runtime et migration ;
5. charge les images locales dans Minikube ;
6. crée/réutilise les Secrets runtime ;
7. adapte le realm Keycloak ;
8. déploie PostgreSQL, RabbitMQ, MinIO et Keycloak ;
9. exécute les Jobs MinIO et Prisma ;
10. applique le Kustomize complet et force le redémarrage des Deployments utilisant les tags locaux fixes ;
11. attend les rollouts ;
12. exécute la validation M7.

## Validation statique

```bash
pnpm m7:k8s:validate:manifests
```

La gate vérifie notamment :

- Deployments/Services séparés ;
- images M7 ;
- Jobs de migration ;
- DNS Kubernetes ;
- absence de localhost inter-service ;
- probes ;
- requests/limits ;
- HPA Gateway ;
- Ingress TLS ;
- discovery Prometheus du Gateway.

## Validation live Minikube

```bash
pnpm m7:k8s:validate
```

Elle vérifie en plus :

- rollouts des workloads ;
- Jobs terminés ;
- RabbitMQ opérationnel ;
- Gateway -> Legacy/Catalog/Marketplace via DNS Kubernetes ;
- Marketplace -> Catalog via DNS Kubernetes ;
- HTTPS Ingress Web/Gateway/Keycloak ;
- JWT Keycloak réel, issuer/audience inclus, accepté jusqu'au Marketplace Service ;
- métriques HPA disponibles.

## Smoke CI kind

```bash
pnpm m7:k8s:smoke
```

Le smoke crée un cluster kind éphémère, charge les images locales, applique la même stack Kustomize et vérifie le réseau inter-services ainsi qu'un JWT réel via le Gateway.

L'Ingress et metrics-server sont certifiés statiquement dans cette gate CI ; leur preuve dynamique complète reste exécutée par le scénario Minikube.

## Limites assumées

M7 reste un sandbox de soutenance :

- un seul nœud Minikube/kind ;
- PostgreSQL, RabbitMQ et MinIO non HA ;
- certificat autosigné ;
- pas de secret manager externe ;
- pas encore de NetworkPolicy complète ;
- pas de GitOps ni de Helm.

Ces sujets ne sont pas présentés comme des garanties de production.


### Accès navigateur : Codespaces et WSL2 / Windows

**Codespaces (sandbox distant)** : `pnpm m7:k8s:validate` est la preuve fonctionnelle du TLS Ingress, du JWT Keycloak et du routage depuis le cluster. Le nom `*.projet-indiv26.test` pointe vers le réseau privé du Minikube **distant** : ajouter une entrée dans le fichier `hosts` de Windows ne suffit pas pour y accéder depuis le navigateur du PC. Ne présentez donc pas ces URL comme des liens publics. Pour une démonstration navigateur avec ces domaines, utilisez un Minikube **local** sous Linux/WSL2 et la procédure ci-dessous, ou préparez séparément un déploiement avec des domaines accessibles.

**WSL2 local + navigateur Windows (pilote Docker)** : l'adresse IP du nœud Minikube n'est **pas directement accessible** depuis Windows. Le fichier `/etc/hosts` sous WSL est configuré par `pnpm m7:k8s:up` pour la validation Linux ; il est **incorrect de recopier cette IP dans le fichier hosts de Windows**. Il faut un point d'entrée TCP sur `127.0.0.1:443` transmis vers le Service Kubernetes Ingress, avec les trois noms d'origine inchangés (TLS, issuer Keycloak, CORS et cookies attendent le port HTTPS standard).

1. Sur la machine WSL2 **locale**, démarrez et validez la stack : `pnpm m7:k8s:up`.
2. Dans **un autre terminal WSL2** (à laisser ouvert), lancez :

   ```bash
   bash scripts/m7-wsl-browser-access.sh
   ```

   La commande vérifie le contexte Minikube et attend Ingress puis exécute `kubectl port-forward` sur `127.0.0.1:443`. Si votre Linux refuse les ports privilégiés, utilisez plutôt `sudo env KUBECONFIG="$HOME/.kube/config" bash scripts/m7-wsl-browser-access.sh`. Ne redirigez pas le port vers `8443` : le frontend et les tokens Keycloak sont configurés pour `https://...test` sur **443**.

3. Dans **Windows**, éditez `C:\\Windows\\System32\\drivers\\etc\\hosts` avec des droits administrateur et ajoutez :

   ```text
   127.0.0.1 app.projet-indiv26.test api.projet-indiv26.test auth.projet-indiv26.test
   ```

4. Depuis **PowerShell Windows**, vérifiez le réseau Windows (pas seulement le shell Linux) :

   ```powershell
   curl.exe -k -I https://app.projet-indiv26.test/
   curl.exe -k -I https://api.projet-indiv26.test/api/health/live
   curl.exe -k -I https://auth.projet-indiv26.test/realms/projet-indiv26/.well-known/openid-configuration
   ```

   Le certificat de démonstration est autosigné : `-k` ne sert **qu'au contrôle local**, pas à une recommandation de sécurité en production. Un navigateur peut demander d'accepter le certificat de test. Validez ensuite le parcours Web/Keycloak.

**Si le transfert Windows → WSL localhost est désactivé** : vérifiez les paramètres réseau WSL (ou le mode *mirrored* sur Windows 11). En dernier recours, relancez l'outil avec `M7_WSL_BIND_ADDRESS=0.0.0.0` (écoute sur toutes les interfaces WSL, uniquement dans un environnement de confiance), puis créez un `netsh interface portproxy` Windows reliant `127.0.0.1:443` à l'adresse IP de la **distribution WSL** (obtenue par `wsl.exe hostname -I`), **pas** à celle du nœud Minikube. Vérifiez les règles du pare-feu, puis supprimez cette redirection après la démonstration. Si le port 443 est déjà occupé sur Windows, libérez-le avant la démo plutôt que de changer les origines de l'application.

Références officielles : [Minikube Docker driver](https://minikube.sigs.k8s.io/docs/drivers/docker/) (IP du nœud non accessible directement depuis Windows/WSL2) et [Microsoft WSL networking](https://learn.microsoft.com/windows/wsl/networking) (transfert localhost et mode mirrored).
