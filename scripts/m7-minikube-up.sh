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

if ! minikube -p minikube status >/dev/null 2>&1; then
  echo "[INFO] Starting Minikube for the full M7 stack..."
  minikube -p minikube start --cpus=4 --memory=6144
fi

minikube -p minikube update-context >/dev/null
kubectl config use-context minikube >/dev/null
if [ "$(kubectl config current-context)" != "minikube" ]; then
  echo "[FAIL] kubectl context is not pinned to Minikube."
  exit 1
fi

HOSTS_MARKER="# projet-indiv26-m7"

refresh_m7_browser_hosts() {
  # Refresh host mappings even if Minikube received another node IP
  # during a long build or Codespaces restart.
  local minikube_ip hosts_line hosts_tmp host resolved_ip
  minikube_ip="$(minikube -p minikube ip)"
  hosts_line="${minikube_ip} app.projet-indiv26.test api.projet-indiv26.test auth.projet-indiv26.test ${HOSTS_MARKER}"
  hosts_tmp="$(mktemp)"
  grep -vF "${HOSTS_MARKER}" /etc/hosts > "${hosts_tmp}" || true
  printf '%s\n' "${hosts_line}" >> "${hosts_tmp}"

  if [ -w /etc/hosts ]; then
    cat "${hosts_tmp}" > /etc/hosts
  elif command -v sudo >/dev/null 2>&1; then
    sudo sh -c "cat '${hosts_tmp}' > /etc/hosts"
  else
    rm -f "${hosts_tmp}"
    echo "[FAIL] Cannot update /etc/hosts and sudo is unavailable."
    echo "[INFO] Add: ${hosts_line}"
    exit 1
  fi
  rm -f "${hosts_tmp}"

  for host in app.projet-indiv26.test api.projet-indiv26.test auth.projet-indiv26.test; do
    resolved_ip="$(getent ahostsv4 "${host}" | awk 'NR == 1 { print $1 }')"
    if [ "${resolved_ip}" != "${minikube_ip}" ]; then
      echo "[FAIL] ${host} resolves to ${resolved_ip:-nothing}, expected ${minikube_ip}."
      exit 1
    fi
  done

  echo "[OK] M7 Linux hosts resolve to current Minikube IP ${minikube_ip}."
}

refresh_m7_browser_hosts
if grep -Eqi '(microsoft|wsl)' /proc/version /proc/sys/kernel/osrelease 2>/dev/null; then
  echo "[WARN] WSL2 Docker driver: the Minikube IP is NOT a Windows browser endpoint."
  echo "[INFO] For Windows browser access, see scripts/m7-wsl-browser-access.sh and docs/20-m7-kubernetes-microservices.md."
fi

echo "[INFO] Enabling ingress and metrics-server..."
minikube -p minikube addons enable ingress >/dev/null
minikube -p minikube addons enable metrics-server >/dev/null

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
  projet-indiv26-notification-migrate:m8-local
  projet-indiv26-web:m7-local
  projet-indiv26-keycloak:m7-local
  projet-indiv26-minio:lot9b-local
  projet-indiv26-minio-bootstrap:lot9b-local
)

# A long Docker build can be interrupted by a Codespaces/Minikube restart.
# Recover the existing profile once before importing images; never delete it.
if ! minikube -p minikube status >/dev/null 2>&1; then
  echo "[WARN] Minikube stopped during image builds; restarting existing profile..."
  minikube -p minikube start --cpus=4 --memory=6144
  minikube -p minikube update-context >/dev/null
  kubectl config use-context minikube >/dev/null
  kubectl wait --for=condition=Ready node/minikube --timeout=240s
  kubectl -n ingress-nginx rollout status deployment/ingress-nginx-controller --timeout=300s
  kubectl -n kube-system rollout status deployment/metrics-server --timeout=240s
fi

# A restart can change the node IP. Rebuild and verify Linux host mappings
# after recovery, before loading images or advertising browser endpoints.
refresh_m7_browser_hosts

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
  minikube -p minikube image load "${image}"
done

M7_FORCE_ROLLOUT=true bash scripts/m7-k8s-apply.sh
bash scripts/m7-k8s-validate.sh

echo
echo "[OK] M7 Minikube stack is ready."
echo "[INFO] Jury hosts: app.projet-indiv26.test, api.projet-indiv26.test, auth.projet-indiv26.test"
