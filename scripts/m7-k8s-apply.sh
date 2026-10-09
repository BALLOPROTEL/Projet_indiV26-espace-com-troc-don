#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
K8S_DIR="${ROOT_DIR}/infra/k8s/minikube"
NAMESPACE="projet-indiv26"

for cmd in kubectl; do
  command -v "${cmd}" >/dev/null 2>&1 || {
    echo "[FAIL] Missing command: ${cmd}"
    exit 1
  }
done

bash "${ROOT_DIR}/scripts/m7-k8s-runtime-config.sh"

echo "[INFO] Removing obsolete monolith Kubernetes objects from pre-M7 demos..."
kubectl -n "${NAMESPACE}" delete deployment/api service/api hpa/api ingress/api \
  --ignore-not-found >/dev/null 2>&1 || true
kubectl -n "${NAMESPACE}" delete secret api-secrets api-tls \
  --ignore-not-found >/dev/null 2>&1 || true

echo "[INFO] Deploying stateful/platform dependencies..."
for manifest in \
  postgres-pvc.yaml postgres-deployment.yaml postgres-service.yaml \
  rabbitmq-pvc.yaml rabbitmq-deployment.yaml rabbitmq-service.yaml \
  minio-pvc.yaml minio-deployment.yaml minio-service.yaml \
  minio-bootstrap-configmap.yaml; do
  kubectl apply -f "${K8S_DIR}/${manifest}" >/dev/null
done

# Keycloak must not start until its persistent, isolated PostgreSQL database
# exists. The same PostgreSQL PVC survives Kubernetes pod replacements.
kubectl -n "${NAMESPACE}" rollout status deployment/postgres --timeout=180s
echo "[INFO] Provisioning persistent Keycloak PostgreSQL database if absent..."
kubectl -n "${NAMESPACE}" exec deployment/postgres -- sh -eu -c '
  existing="$(PGPASSWORD="${POSTGRES_PASSWORD}" psql -X -A -t \
    -U "${POSTGRES_USER}" -d postgres \
    -c "SELECT 1 FROM pg_database WHERE datname = '\''keycloak'\''")"
  if [ "${existing}" != "1" ]; then
    PGPASSWORD="${POSTGRES_PASSWORD}" createdb -U "${POSTGRES_USER}" \
      -O "${POSTGRES_USER}" keycloak
  fi
  PGPASSWORD="${POSTGRES_PASSWORD}" psql -X -A -t \
    -U "${POSTGRES_USER}" -d keycloak -c "SELECT current_database()" \
    | grep -qx keycloak
'
echo "[OK] Dedicated Keycloak PostgreSQL database is available."

kubectl apply -f "${K8S_DIR}/keycloak-deployment.yaml" >/dev/null
kubectl apply -f "${K8S_DIR}/keycloak-service.yaml" >/dev/null

if [ "${M7_FORCE_ROLLOUT:-false}" = "true" ]; then
  for deployment in minio keycloak; do
    if kubectl -n "${NAMESPACE}" get "deployment/${deployment}" >/dev/null 2>&1; then
      kubectl -n "${NAMESPACE}" rollout restart "deployment/${deployment}" >/dev/null
    fi
  done
fi

kubectl -n "${NAMESPACE}" rollout status deployment/postgres --timeout=180s
kubectl -n "${NAMESPACE}" rollout status deployment/rabbitmq --timeout=180s
kubectl -n "${NAMESPACE}" rollout status deployment/minio --timeout=180s
kubectl -n "${NAMESPACE}" rollout status deployment/keycloak --timeout=240s

echo "[INFO] Running MinIO bootstrap..."
kubectl -n "${NAMESPACE}" delete job minio-bootstrap --ignore-not-found >/dev/null 2>&1 || true
kubectl apply -f "${K8S_DIR}/minio-bootstrap-job.yaml" >/dev/null
kubectl -n "${NAMESPACE}" wait --for=condition=complete job/minio-bootstrap --timeout=180s

echo "[INFO] Running the three Prisma ownership migrations..."
for job in legacy-migrate catalog-migrate marketplace-migrate notification-migrate; do
  kubectl -n "${NAMESPACE}" delete job "${job}" --ignore-not-found >/dev/null 2>&1 || true
done
kubectl apply -f "${K8S_DIR}/migration-jobs.yaml" >/dev/null

for job in legacy-migrate catalog-migrate marketplace-migrate notification-migrate; do
  if ! kubectl -n "${NAMESPACE}" wait --for=condition=complete "job/${job}" --timeout=240s; then
    kubectl -n "${NAMESPACE}" logs "job/${job}" || true
    exit 1
  fi
done

echo "[INFO] Applying the complete M7 Kustomize stack..."
kubectl apply -k "${K8S_DIR}" >/dev/null

# Disable observability workloads in resource-limited kind smoke runs.
if [ "${M7_SKIP_OBSERVABILITY:-false}" = "true" ]; then
  echo "[INFO] Disabling Prometheus/Grafana for kind smoke..."
  kubectl -n "${NAMESPACE}" delete deployment prometheus grafana \
    --ignore-not-found=true --wait=true --timeout=120s
fi

if [ "${M7_FORCE_ROLLOUT:-false}" = "true" ]; then
  for deployment in legacy-api catalog-service marketplace-service notification-service gateway web; do
    kubectl -n "${NAMESPACE}" rollout restart "deployment/${deployment}" >/dev/null
  done

  # ConfigMaps mounted with subPath require a pod restart.
  if [ "${M7_SKIP_OBSERVABILITY:-false}" != "true" ]; then
    for deployment in prometheus grafana; do
      kubectl -n "${NAMESPACE}" rollout restart "deployment/${deployment}" >/dev/null
    done
  fi
fi

deployments=(
  legacy-api catalog-service marketplace-service notification-service
  gateway web
)

if [ "${M7_SKIP_OBSERVABILITY:-false}" != "true" ]; then
  deployments+=(prometheus grafana)
fi

for deployment in "${deployments[@]}"; do
  kubectl -n "${NAMESPACE}" rollout status "deployment/${deployment}" --timeout=240s
done

echo "M7 Kubernetes apply: PASS"
