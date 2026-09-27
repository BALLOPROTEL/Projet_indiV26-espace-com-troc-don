#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
K8S_DIR="${ROOT_DIR}/infra/k8s/minikube"
NAMESPACE="projet-indiv26"
IMAGE="projet-indiv26-api:lot6-local"
MINIO_IMAGE="projet-indiv26-minio:lot9b-local"
BOOTSTRAP_IMAGE="projet-indiv26-minio-bootstrap:lot9b-local"
PG_FORWARD_PORT="${PG_FORWARD_PORT:-5434}"

for cmd in docker minikube kubectl openssl base64 pnpm curl; do
  command -v "${cmd}" >/dev/null 2>&1 || {
    echo "[FAIL] Missing command: ${cmd}"
    exit 1
  }
done

cd "${ROOT_DIR}"

echo "=== LOT 6 - Minikube deployment ==="

if ! minikube status >/dev/null 2>&1; then
  echo "[INFO] Minikube is not running; starting it..."
  minikube start --cpus=2 --memory=4096
fi

echo "[INFO] Enabling ingress and metrics-server addons..."
minikube addons enable ingress >/dev/null
minikube addons enable metrics-server >/dev/null

echo "[INFO] Building API image for Minikube..."
docker build --pull -f apps/api/Dockerfile -t "${IMAGE}" .

echo "[INFO] Building MinIO server image..."
docker build --pull \
  -f infra/minio/Dockerfile.server \
  -t "${MINIO_IMAGE}" \
  .

echo "[INFO] Building MinIO bootstrap image..."
docker build --pull \
  -f infra/minio/Dockerfile.mc-bootstrap \
  -t "${BOOTSTRAP_IMAGE}" \
  .

echo "[INFO] Loading application images into Minikube..."
minikube image load "${IMAGE}"
minikube image load "${MINIO_IMAGE}"
minikube image load "${BOOTSTRAP_IMAGE}"

echo "[INFO] Creating namespace..."
kubectl apply -f "${K8S_DIR}/namespace.yaml"

if ! kubectl -n "${NAMESPACE}" get secret postgres-credentials >/dev/null 2>&1; then
  POSTGRES_PASSWORD="$(openssl rand -hex 16)"
  kubectl -n "${NAMESPACE}" create secret generic postgres-credentials \
    --from-literal=POSTGRES_DB=projet_indiv26 \
    --from-literal=POSTGRES_USER=app \
    --from-literal=POSTGRES_PASSWORD="${POSTGRES_PASSWORD}"
  echo "[OK] PostgreSQL Secret created."
else
  POSTGRES_PASSWORD="$(kubectl -n "${NAMESPACE}" get secret postgres-credentials -o jsonpath='{.data.POSTGRES_PASSWORD}' | base64 -d)"
  echo "[OK] Existing PostgreSQL Secret reused."
fi

DATABASE_URL="postgresql://app:${POSTGRES_PASSWORD}@postgres:5432/projet_indiv26?schema=public"

METRICS_TOKEN=""
if kubectl -n "${NAMESPACE}" get secret api-secrets >/dev/null 2>&1; then
  METRICS_TOKEN="$(kubectl -n "${NAMESPACE}" get secret api-secrets \
    -o jsonpath='{.data.METRICS_TOKEN}' 2>/dev/null | base64 -d || true)"
fi

if [ -z "${METRICS_TOKEN}" ]; then
  METRICS_TOKEN="$(openssl rand -hex 32)"
  echo "[OK] New internal metrics token generated."
else
  echo "[OK] Existing internal metrics token reused."
fi

kubectl -n "${NAMESPACE}" create secret generic api-secrets \
  --from-literal=DATABASE_URL="${DATABASE_URL}" \
  --from-literal=METRICS_TOKEN="${METRICS_TOKEN}" \
  --dry-run=client -o yaml | kubectl apply -f -

echo "[OK] API Secret applied without storing credentials in Git."

if kubectl -n "${NAMESPACE}" get secret object-storage-credentials >/dev/null 2>&1; then
  MINIO_ROOT_USER="$(kubectl -n "${NAMESPACE}" get secret object-storage-credentials -o jsonpath='{.data.MINIO_ROOT_USER}' | base64 -d)"
  MINIO_ROOT_PASSWORD="$(kubectl -n "${NAMESPACE}" get secret object-storage-credentials -o jsonpath='{.data.MINIO_ROOT_PASSWORD}' | base64 -d)"
  S3_ACCESS_KEY="$(kubectl -n "${NAMESPACE}" get secret object-storage-credentials -o jsonpath='{.data.S3_ACCESS_KEY}' | base64 -d)"
  S3_SECRET_KEY="$(kubectl -n "${NAMESPACE}" get secret object-storage-credentials -o jsonpath='{.data.S3_SECRET_KEY}' | base64 -d)"
  echo "[OK] Existing object-storage credentials reused."
else
  MINIO_ROOT_USER="minio-root"
  MINIO_ROOT_PASSWORD="$(openssl rand -hex 24)"
  S3_ACCESS_KEY="marketplace-api"
  S3_SECRET_KEY="$(openssl rand -hex 24)"

  kubectl -n "${NAMESPACE}" create secret generic object-storage-credentials \
    --from-literal=MINIO_ROOT_USER="${MINIO_ROOT_USER}" \
    --from-literal=MINIO_ROOT_PASSWORD="${MINIO_ROOT_PASSWORD}" \
    --from-literal=S3_ACCESS_KEY="${S3_ACCESS_KEY}" \
    --from-literal=S3_SECRET_KEY="${S3_SECRET_KEY}"

  echo "[OK] Object-storage credentials created outside Git."
fi

if ! kubectl -n "${NAMESPACE}" get secret api-tls >/dev/null 2>&1; then
  TLS_DIR="$(mktemp -d)"

  openssl req -x509 -nodes -newkey rsa:2048 -days 7 \
    -keyout "${TLS_DIR}/tls.key" \
    -out "${TLS_DIR}/tls.crt" \
    -subj "/CN=api.projet-indiv26.local" \
    -addext "subjectAltName=DNS:api.projet-indiv26.local" >/dev/null 2>&1

  kubectl -n "${NAMESPACE}" create secret tls api-tls \
    --cert="${TLS_DIR}/tls.crt" \
    --key="${TLS_DIR}/tls.key"

  rm -rf "${TLS_DIR}"
  echo "[OK] Self-signed TLS Secret created for the Minikube demo."
else
  echo "[OK] Existing TLS Secret reused."
fi

echo "[INFO] Deploying PostgreSQL..."
kubectl apply -f "${K8S_DIR}/postgres-pvc.yaml"
kubectl apply -f "${K8S_DIR}/postgres-deployment.yaml"
kubectl apply -f "${K8S_DIR}/postgres-service.yaml"

kubectl -n "${NAMESPACE}" rollout status deployment/postgres --timeout=180s

echo "[INFO] Deploying private MinIO object storage..."
kubectl apply -f "${K8S_DIR}/minio-pvc.yaml"
kubectl apply -f "${K8S_DIR}/minio-deployment.yaml"
kubectl apply -f "${K8S_DIR}/minio-service.yaml"
kubectl apply -f "${K8S_DIR}/minio-bootstrap-configmap.yaml"

kubectl -n "${NAMESPACE}" rollout status deployment/minio --timeout=180s

echo "[INFO] Bootstrapping private listing-images bucket and application user..."
kubectl -n "${NAMESPACE}" delete job minio-bootstrap --ignore-not-found=true >/dev/null
kubectl apply -f "${K8S_DIR}/minio-bootstrap-job.yaml"

if ! kubectl -n "${NAMESPACE}" wait \
  --for=condition=complete job/minio-bootstrap \
  --timeout=180s; then
  kubectl -n "${NAMESPACE}" logs job/minio-bootstrap --tail=200 || true
  echo "[FAIL] MinIO bootstrap job did not complete."
  exit 1
fi

kubectl -n "${NAMESPACE}" logs job/minio-bootstrap --tail=50

echo "[INFO] Applying Prisma migrations through a temporary PostgreSQL port-forward..."
PF_LOG="$(mktemp)"
kubectl -n "${NAMESPACE}" port-forward service/postgres "${PG_FORWARD_PORT}:5432" >"${PF_LOG}" 2>&1 &
PF_PID=$!

cleanup_pf() {
  if kill -0 "${PF_PID}" >/dev/null 2>&1; then
    kill "${PF_PID}" >/dev/null 2>&1 || true
    wait "${PF_PID}" 2>/dev/null || true
  fi
}
trap cleanup_pf EXIT

for _ in $(seq 1 30); do
  if grep -q "Forwarding from" "${PF_LOG}" 2>/dev/null; then
    break
  fi
  if ! kill -0 "${PF_PID}" >/dev/null 2>&1; then
    cat "${PF_LOG}"
    echo "[FAIL] PostgreSQL port-forward stopped."
    exit 1
  fi
  sleep 1
done

if ! grep -q "Forwarding from" "${PF_LOG}" 2>/dev/null; then
  cat "${PF_LOG}"
  echo "[FAIL] PostgreSQL port-forward did not become ready."
  exit 1
fi

DATABASE_URL="postgresql://app:${POSTGRES_PASSWORD}@127.0.0.1:${PG_FORWARD_PORT}/projet_indiv26?schema=public" pnpm db:deploy
cleanup_pf
trap - EXIT
rm -f "${PF_LOG}"

echo "[INFO] Deploying API, Service, Ingress and HPA..."
kubectl apply -f "${K8S_DIR}/api-configmap.yaml"
kubectl apply -f "${K8S_DIR}/api-deployment.yaml"
kubectl apply -f "${K8S_DIR}/api-service.yaml"
kubectl apply -f "${K8S_DIR}/api-ingress.yaml"
kubectl apply -f "${K8S_DIR}/api-hpa.yaml"

kubectl -n "${NAMESPACE}" rollout status deployment/api --timeout=180s

echo
kubectl -n "${NAMESPACE}" get pods,svc,ingress,hpa,pvc

echo
echo "LOT 6 Minikube deployment: PASS"
echo "Next: bash scripts/lot6-k8s-validate.sh"
