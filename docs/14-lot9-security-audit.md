# LOT 9 — Audit sécurité final et plan de remédiation

## 1. Objectif

Ce document clôt l'audit sécurité de la V1 réelle du projet.

Règle appliquée :

> Aucun risque n'est inventé. Chaque constat provient du code, des manifests, des tests, des scans ou de la configuration effectivement versionnée.

Les résultats de ce LOT doivent être lus dans le contexte d'un **POC pédagogique exécuté localement avec Docker Desktop / WSL / Minikube**.

Ils ne constituent pas une certification de sécurité d'un environnement de production.

---

## 2. Périmètre audité

Le périmètre comprend :

- API NestJS ;
- frontend Next.js ;
- authentification Keycloak / OIDC ;
- RBAC USER / MODERATOR / ADMIN ;
- PostgreSQL / Prisma ;
- dépendances npm ;
- image Docker API ;
- GitHub Actions / GHCR ;
- Kubernetes / Minikube ;
- Ingress TLS ;
- Prometheus / Grafana ;
- secrets et fichiers d'environnement ;
- logs ;
- tests d'autorisation ;
- résultats des LOT 4 à LOT 8.

---

## 3. Contrôles positifs observés

Les contrôles suivants étaient déjà présents avant les remédiations LOT 9 :

- JWT vérifié côté API avec issuer, audience et algorithme RS256 ;
- Bearer token obligatoire sur les routes protégées ;
- RBAC serveur explicite ;
- contrôles d'appartenance sur les annonces utilisateur ;
- validation globale NestJS avec whitelist et rejet des champs inattendus ;
- annonces PENDING / REJECTED non accessibles publiquement ;
- Keycloak web en Authorization Code + PKCE S256 ;
- API Keycloak configurée bearer-only ;
- inscription publique Keycloak désactivée ;
- secrets Kubernetes générés hors Git ;
- Ingress TLS avec redirection HTTPS ;
- API, PostgreSQL, Prometheus et Grafana exposés via ClusterIP dans le cluster ;
- conteneur API exécuté sans root ;
- filesystem API read-only ;
- seccomp RuntimeDefault ;
- privilege escalation désactivée ;
- capabilities Linux supprimées sur API / Prometheus / Grafana ;
- ServiceAccount token désactivé lorsque non nécessaire ;
- RBAC Prometheus limité à get/list/watch sur les pods du namespace ;
- logs HTTP sans Authorization, mot de passe ni query string ;
- audit de dépendances de production dans la CI ;
- scan Trivy HIGH / CRITICAL bloquant ;
- image API testée avant publication ;
- image GHCR publiée avec tag immuable basé sur le SHA ;
- main protégée et workflow de merge par PR.

---

## 4. Registre des constats

| ID | Constat observé | Probabilité | Impact | Criticité | Décision / remédiation | Risque résiduel |
|---|---|---:|---:|---:|---|---|
| SEC-01 | `/api/metrics` était exposé par le même Ingress que l'API et ne demandait aucune authentification. | Moyenne | Moyen | **Moyenne** | **Corrigé** : Bearer token interne `METRICS_TOKEN`; Prometheus lit le token depuis un Secret Kubernetes monté en fichier. | Faible |
| SEC-02 | Swagger était toujours initialisé, y compris avec `NODE_ENV=production`. | Faible | Faible | **Faible** | **Corrigé** : Swagger est désactivé par défaut en production et explicitement désactivé dans le ConfigMap Minikube. | Très faible |
| SEC-03 | L'API et le frontend n'avaient pas de baseline explicite de headers de durcissement ; Express pouvait divulguer `X-Powered-By`. | Moyenne | Faible | **Faible** | **Corrigé** : suppression `X-Powered-By`, `nosniff`, anti-frame, Referrer-Policy, Permissions-Policy et CSP minimale côté Web. | Faible |
| SEC-04 | La protection brute-force n'était pas explicitement activée dans le realm Keycloak versionné. | Moyenne | Moyen | **Moyenne** | **Corrigé** : brute-force protection activée, seuil de 5 échecs et temporisation progressive. | Faible |
| SEC-05 | Les GitHub Actions étaient référencées par tags mutables (`@v4`, `@v3`, etc.). | Faible | Élevé | **Moyenne** | **Corrigé** : actions tierces pinnées par SHA de commit immuable. | Faible |
| SEC-06 | Des mots de passe de **démonstration locale** sont versionnés dans le realm Keycloak et `compose.yaml`. | Faible | Faible | **Faible** | **Accepté pour le POC local** : services liés à `127.0.0.1`, utilisateurs `.invalid`, valeurs explicitement marquées local/demo. Interdiction de réutilisation hors labo. | Faible |
| SEC-07 | Le client Keycloak `cli` autorise le Resource Owner Password / Direct Access Grant. | Faible | Moyen | **Faible** | **Accepté uniquement pour le smoke test local**. Les clients applicatifs `web` et `api` ont Direct Grant désactivé. | Faible |
| SEC-08 | Aucune NetworkPolicy Kubernetes n'est appliquée au namespace. | Moyenne | Moyen | **Moyenne** | **Risque résiduel documenté** : services sensibles restent ClusterIP et Prometheus/Grafana n'ont pas d'Ingress. En production, déployer un CNI enforceant les NetworkPolicies et une politique default-deny + allowlist. | Moyenne |
| SEC-09 | Aucun rate limiting distribué n'est appliqué à l'API publique. | Moyenne | Moyen | **Moyenne** | **Risque résiduel documenté** : HPA + resource limits protègent partiellement la disponibilité ; Keycloak protège les échecs d'auth. En production, ajouter rate limiting Ingress/API partagé. | Moyenne |
| SEC-10 | Le pod PostgreSQL n'applique pas le même niveau de filesystem read-only / non-root forcé que l'API. | Faible | Moyen | **Faible** | **Accepté dans Minikube** : l'image officielle gère son initialisation et le volume persistant. En cible réelle, préférer PostgreSQL managé ou StatefulSet durci et validé. | Faible |
| SEC-11 | Le workflow principal conserve `packages: write` car il publie GHCR après un push sur `main`. | Faible | Moyen | **Faible** | **Risque résiduel documenté** : publication conditionnée au push `main`, main protégée, actions pinnées par SHA. En cible entreprise, séparer validation et publication en jobs/workflows distincts. | Faible |

---

## 5. Remédiations LOT 9

### 5.1 Protection des métriques

Avant :

```text
GET /api/metrics
→ accessible sans authentification
```

Après :

```text
GET /api/metrics
Authorization: Bearer <METRICS_TOKEN>
```

Dans Minikube :

- le token est généré aléatoirement par le script de déploiement ;
- il est stocké dans `api-secrets` ;
- l'API le reçoit par `envFrom` ;
- Prometheus monte uniquement la clé `METRICS_TOKEN` sous forme de fichier ;
- le token n'est jamais versionné.

La validation live du LOT 7 vérifie désormais :

- sans token → HTTP 401 ;
- avec token → métriques disponibles ;
- Prometheus target `api-pods` → UP.

### 5.2 Swagger

Comportement :

```text
NODE_ENV=production + SWAGGER_ENABLED absent
→ Swagger désactivé
```

Le déploiement Minikube définit explicitement :

```text
SWAGGER_ENABLED=false
```

Le Swagger reste disponible en développement local lorsque nécessaire.

### 5.3 Headers de sécurité

API :

- suppression de `X-Powered-By` ;
- `X-Content-Type-Options: nosniff` ;
- `X-Frame-Options: DENY` ;
- `Referrer-Policy: strict-origin-when-cross-origin` ;
- `Permissions-Policy` restrictive.

Frontend :

- mêmes protections essentielles ;
- CSP minimale :
  - `frame-ancestors 'none'` ;
  - `object-src 'none'` ;
  - `base-uri 'self'`.

La CSP reste volontairement minimale pour ne pas casser le flux OIDC Keycloak du POC.

### 5.4 Keycloak

Le realm active désormais la protection brute-force :

- protection activée ;
- 5 échecs avant temporisation ;
- incrément de temporisation : 60 s ;
- attente maximale : 900 s.

Le client Web reste :

- public ;
- Authorization Code ;
- PKCE S256 ;
- Direct Access Grant désactivé.

L'API reste bearer-only.

### 5.5 Supply chain CI

Les actions tierces du workflow sont pinnées sur des SHA immuables.

La CI conserve :

- `pnpm audit --prod --audit-level=high` ;
- build image ;
- smoke test image ;
- Trivy HIGH / CRITICAL ;
- publication GHCR uniquement sur push de `main`.

---

## 6. Secrets

### Ce qui n'est pas versionné

- fichiers `.env` réels ;
- clés privées ;
- certificats TLS générés ;
- mot de passe PostgreSQL Minikube ;
- `DATABASE_URL` Minikube ;
- `METRICS_TOKEN` ;
- secret TLS Kubernetes.

### Ce qui est versionné volontairement

- `.env.example` ;
- manifests `*.example.yaml` avec `REPLACE_ME` ;
- identifiants de démonstration locale Keycloak ;
- mots de passe de démonstration locale du compose.

Les credentials de démonstration sont des **fixtures de laboratoire**, pas des secrets de production.

---

## 7. Réseau

### État actuel

- API : ClusterIP + Ingress TLS ;
- PostgreSQL : ClusterIP uniquement ;
- Prometheus : ClusterIP uniquement ;
- Grafana : ClusterIP uniquement ;
- Keycloak Docker local : bind `127.0.0.1:8081` ;
- PostgreSQL Docker local : bind `127.0.0.1:5433`.

### Limite

Aucune NetworkPolicy n'est versionnée.

Le POC Minikube n'est donc pas utilisé comme preuve d'une micro-segmentation réseau de production.

### Cible production

Prévoir :

- CNI supportant et enforceant NetworkPolicy ;
- default-deny ingress/egress ;
- allow Ingress → API ;
- allow Prometheus → API metrics ;
- allow API → PostgreSQL / Keycloak ;
- allow Grafana → Prometheus ;
- DNS explicitement autorisé.

---

## 8. Rate limiting

Aucun limiteur distribué n'est ajouté dans ce LOT.

Raison :

- un limiteur mémoire serait incohérent avec le HPA multi-pods ;
- les annotations NGINX locales modifieraient les résultats LOT 8 ;
- la solution cible doit être partagée ou appliquée au niveau gateway/Ingress.

Pour une cible production :

- rate limiting par IP / identité ;
- quotas distincts lecture / mutation ;
- protection spécifique login côté Identity Provider ;
- métriques et alertes associées.

---

## 9. Gate automatisée

Validation statique :

```bash
pnpm security:audit:static
```

Audit complet local :

```bash
pnpm security:audit
```

L'audit complet relance :

- API quality ;
- Web quality ;
- audit dépendances production ;
- validation manifests observabilité ;
- validation LOT 8.

La CI exécute en plus :

- scan Trivy image HIGH / CRITICAL ;
- smoke test image ;
- publication immutable GHCR sur `main`.

---

## 10. Conclusion

Après remédiation, aucun constat HIGH ou CRITICAL observé n'est laissé ouvert dans le périmètre du POC.

Les risques résiduels sont explicitement limités au contexte de laboratoire :

- NetworkPolicy non démontrée ;
- rate limiting distribué non implémenté ;
- fixtures de credentials locales ;
- Direct Grant uniquement pour le smoke client ;
- durcissement PostgreSQL dépendant d'une cible de déploiement réelle.

Ces points ne doivent pas être présentés comme satisfaits en production : ils constituent la liste de durcissement à appliquer lors d'une industrialisation.
