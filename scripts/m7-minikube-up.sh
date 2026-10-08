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

# Restarted Codespaces may report addon pods as 0/1 while Kubernetes recovers.
kubectl wait --for=condition=Ready node/minikube --timeout=240s
kubectl -n ingress-nginx rollout status deployment/ingress-nginx-controller --timeout=300s
kubectl -n kube-system rollout status deployment/metrics-server --timeout=240s

bash scripts/m7-build-images.sh

# Only prune build cache when explicitly requested; tagged images are retained.
if [ "${M7_PRUNE_BUILD_CACHE:-false}" = "true" ]; then
  echo "[INFO] Pruning Docker build cache (preserving tagged images)..."
  docker builder prune -af
fi

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

# A long Docker build can be interrupted by a Codespaces/Minikube restart.
# Recover the existing profile once before importing images; never delete it.
if ! minikube status >/dev/null 2>&1; then
  echo "[WARN] Minikube stopped during image builds; restarting existing profile..."
  minikube start --cpus=4 --memory=6144
  minikube update-context >/dev/null
  kubectl config use-context minikube >/dev/null
  kubectl wait --for=condition=Ready node/minikube --timeout=240s
  kubectl -n ingress-nginx rollout status deployment/ingress-nginx-controller --timeout=300s
  kubectl -n kube-system rollout status deployment/metrics-server --timeout=240s
fi

echo "[INFO] Loading local images into Minikube..."
for image in "${images[@]}"; do
  if ! docker image inspect "${image}" >/dev/null 2>&1; then
    echo "[FAIL] Missing local image: ${image}"
    exit 1
  fi

  # Leave at least 3 GiB after the image's declared size before each load.
  available_kib="$(df -Pk "${ROOT_DIR}" | awk 'NR == 2 { print $4 }')"
  image_bytes="$(docker image inspect "${image}" --format '{{.Size}}')"
  required_kib=$(( (image_bytes + 1023) / 1024 + 3145728 ))
  if [ "${available_kib}" -lt "${required_kib}" ]; then
    echo "[FAIL] Not enough disk space to load ${image} safely."
    echo "[INFO] Available: $((available_kib / 1024)) MiB; required: $((required_kib / 1024)) MiB."
    echo "[INFO] Already loaded images remain in Minikube. Re-run after freeing space."
    exit 1
  fi

  echo "[INFO] Loading ${image}..."
  minikube image load "${image}"
done

M7_FORCE_ROLLOUT=true bash scripts/m7-k8s-apply.sh
bash scripts/m7-k8s-validate.sh

echo
echo "[OK] M7 Minikube stack is ready."
echo "[INFO] Jury hosts: app.projet-indiv26.test, api.projet-indiv26.test, auth.projet-indiv26.test"
