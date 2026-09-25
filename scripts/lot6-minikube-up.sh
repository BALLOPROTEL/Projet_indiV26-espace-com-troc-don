#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
K8S_DIR="${ROOT_DIR}/infra/k8s/minikube"
NAMESPACE="projet-indiv26"
IMAGE="projet-indiv26-api:lot6-local"
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

echo "[INFO] Loading API image into Minikube..."
minikube image load "${IMAGE}"

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

kubectl -n "${NAMESPACE}" create secret generic api-secrets \
  --from-literal=DATABASE_URL="${DATABASE_URL}" \
  --dry-run=client -o yaml | kubectl apply -f -

echo "[OK] API Secret applied without storing credentials in Git."

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
