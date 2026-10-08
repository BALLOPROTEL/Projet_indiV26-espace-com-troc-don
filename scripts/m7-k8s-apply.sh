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
  minio-bootstrap-configmap.yaml \
  keycloak-deployment.yaml keycloak-service.yaml; do
  kubectl apply -f "${K8S_DIR}/${manifest}" >/dev/null
done

kubectl -n "${NAMESPACE}" rollout status deployment/postgres --timeout=180s
kubectl -n "${NAMESPACE}" rollout status deployment/rabbitmq --timeout=180s
kubectl -n "${NAMESPACE}" rollout status deployment/minio --timeout=180s
kubectl -n "${NAMESPACE}" rollout status deployment/keycloak --timeout=240s

echo "[INFO] Running MinIO bootstrap..."
kubectl -n "${NAMESPACE}" delete job minio-bootstrap --ignore-not-found >/dev/null 2>&1 || true
kubectl apply -f "${K8S_DIR}/minio-bootstrap-job.yaml" >/dev/null
kubectl -n "${NAMESPACE}" wait --for=condition=complete job/minio-bootstrap --timeout=180s

echo "[INFO] Running the three Prisma ownership migrations..."
for job in legacy-migrate catalog-migrate marketplace-migrate; do
  kubectl -n "${NAMESPACE}" delete job "${job}" --ignore-not-found >/dev/null 2>&1 || true
done
kubectl apply -f "${K8S_DIR}/migration-jobs.yaml" >/dev/null

for job in legacy-migrate catalog-migrate marketplace-migrate; do
  if ! kubectl -n "${NAMESPACE}" wait --for=condition=complete "job/${job}" --timeout=240s; then
    kubectl -n "${NAMESPACE}" logs "job/${job}" || true
    exit 1
  fi
done

echo "[INFO] Applying the complete M7 Kustomize stack..."
kubectl apply -k "${K8S_DIR}" >/dev/null

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
