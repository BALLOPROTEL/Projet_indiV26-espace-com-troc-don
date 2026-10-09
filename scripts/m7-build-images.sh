#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

APP_PUBLIC_URL="https://app.projet-indiv26.test"
AUTH_PUBLIC_URL="https://auth.projet-indiv26.test"

echo "=== M7 - Building Kubernetes images ==="

# Explicit opt-in for Codespaces resumptions: keep existing tagged images,
# but build every missing one. Normal M7 runs continue to rebuild all images.
build_image() {
  local image="$1"
  shift

  if [ "${M7_REUSE_LOCAL_IMAGES:-false}" = "true" ] &&
    docker image inspect "${image}" >/dev/null 2>&1; then
    echo "[SKIP] Existing local image: ${image}"
    return 0
  fi

  local available_kib
  available_kib="$(df -Pk "${ROOT_DIR}" | awk 'NR == 2 { print $4 }')"
  if [ "${available_kib}" -lt 4194304 ]; then
    echo "[FAIL] Less than 4 GiB free before building ${image}."
    exit 1
  fi

  echo "[INFO] Building ${image}..."
  docker build -t "${image}" "$@" .
}

build_image projet-indiv26-legacy-api:m7-local -f apps/api/Dockerfile
build_image projet-indiv26-legacy-migrate:m7-local --target migration -f apps/api/Dockerfile

build_image projet-indiv26-gateway:m7-local -f apps/gateway/Dockerfile

build_image projet-indiv26-catalog-service:m7-local -f apps/catalog-service/Dockerfile
build_image projet-indiv26-catalog-migrate:m7-local --target migration -f apps/catalog-service/Dockerfile

build_image projet-indiv26-marketplace-service:m7-local -f apps/marketplace-service/Dockerfile
build_image projet-indiv26-marketplace-migrate:m7-local --target migration -f apps/marketplace-service/Dockerfile

build_image projet-indiv26-notification-service:m8-local -f apps/notification-service/Dockerfile
build_image projet-indiv26-notification-migrate:m8-local --target migration -f apps/notification-service/Dockerfile

build_image projet-indiv26-web:m7-local \
  --build-arg NEXT_PUBLIC_API_URL=/api \
  --build-arg NEXT_PUBLIC_KEYCLOAK_URL="${AUTH_PUBLIC_URL}" \
  --build-arg NEXT_PUBLIC_KEYCLOAK_REALM=projet-indiv26 \
  --build-arg NEXT_PUBLIC_KEYCLOAK_CLIENT_ID=web \
  --build-arg API_INTERNAL_URL=http://gateway:3000 \
  -f apps/web/Dockerfile

build_image projet-indiv26-keycloak:m7-local -f infra/keycloak/Dockerfile.k8s
build_image projet-indiv26-minio:lot9b-local -f infra/minio/Dockerfile.server
build_image projet-indiv26-minio-bootstrap:lot9b-local -f infra/minio/Dockerfile.mc-bootstrap

echo "M7 Kubernetes images: PASS"
