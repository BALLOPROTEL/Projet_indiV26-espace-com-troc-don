#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NAMESPACE="projet-indiv26"

for cmd in docker minikube kubectl openssl base64 node curl; do
  command -v "${cmd}" >/dev/null 2>&1 || {
    echo "[FAIL] Missing command: ${cmd}"
    exit 1
  }
done

cd "${ROOT_DIR}"

echo "=== M7 - Kubernetes multi-services on Minikube ==="

if ! minikube status >/dev/null 2>&1; then
  echo "[INFO] Starting Minikube for the full M7 stack..."
  minikube start --cpus=4 --memory=6144
fi

minikube update-context >/dev/null
kubectl config use-context minikube >/dev/null
if [ "$(kubectl config current-context)" != "minikube" ]; then
  echo "[FAIL] kubectl context is not pinned to Minikube."
  exit 1
fi

echo "[INFO] Enabling ingress and metrics-server..."
minikube addons enable ingress >/dev/null
minikube addons enable metrics-server >/dev/null

bash scripts/m7-build-images.sh

images=(
  projet-indiv26-legacy-api:m7-local
  projet-indiv26-legacy-migrate:m7-local
  projet-indiv26-gateway:m7-local
  projet-indiv26-catalog-service:m7-local
  projet-indiv26-catalog-migrate:m7-local
  projet-indiv26-marketplace-service:m7-local
  projet-indiv26-marketplace-migrate:m7-local
  projet-indiv26-notification-service:m7-local
  projet-indiv26-web:m7-local
  projet-indiv26-keycloak:m7-local
  projet-indiv26-minio:lot9b-local
  projet-indiv26-minio-bootstrap:lot9b-local
)

echo "[INFO] Loading local images into Minikube..."
for image in "${images[@]}"; do
  minikube image load "${image}"
done

M7_FORCE_ROLLOUT=true bash scripts/m7-k8s-apply.sh
bash scripts/m7-k8s-validate.sh

echo
echo "[OK] M7 Minikube stack is ready."
echo "[INFO] Jury hosts: app.projet-indiv26.local, api.projet-indiv26.local, auth.projet-indiv26.local"
