#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NAMESPACE="projet-indiv26"

for cmd in docker minikube kubectl openssl base64 node curl getent; do
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

MINIKUBE_IP="$(minikube ip)"
HOSTS_MARKER="# projet-indiv26-m7"
HOSTS_LINE="${MINIKUBE_IP} app.projet-indiv26.test api.projet-indiv26.test auth.projet-indiv26.test ${HOSTS_MARKER}"
HOSTS_TMP="$(mktemp)"
grep -vF "${HOSTS_MARKER}" /etc/hosts > "${HOSTS_TMP}" || true
printf '%s\n' "${HOSTS_LINE}" >> "${HOSTS_TMP}"

if [ -w /etc/hosts ]; then
  cat "${HOSTS_TMP}" > /etc/hosts
elif command -v sudo >/dev/null 2>&1; then
  sudo sh -c "cat '${HOSTS_TMP}' > /etc/hosts"
else
  rm -f "${HOSTS_TMP}"
  echo "[FAIL] Cannot update /etc/hosts and sudo is unavailable."
  echo "[INFO] Add: ${HOSTS_LINE}"
  exit 1
fi
rm -f "${HOSTS_TMP}"

for host in app.projet-indiv26.test api.projet-indiv26.test auth.projet-indiv26.test; do
  resolved_ip="$(getent ahostsv4 "${host}" | awk 'NR == 1 { print $1 }')"
  if [ "${resolved_ip}" != "${MINIKUBE_IP}" ]; then
    echo "[FAIL] ${host} resolves to ${resolved_ip:-nothing}, expected ${MINIKUBE_IP}."
    exit 1
  fi
done

echo "[OK] M7 browser hosts resolve to Minikube IP ${MINIKUBE_IP}."
if grep -qi microsoft /proc/version 2>/dev/null; then
  echo "[WARN] WSL detected: a browser running on Windows may also require the same entries in the Windows hosts file."
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
echo "[INFO] Jury hosts: app.projet-indiv26.test, api.projet-indiv26.test, auth.projet-indiv26.test"
