#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

APP_PUBLIC_URL="${APP_PUBLIC_URL:-https://app.projet-indiv26.local}"
AUTH_PUBLIC_URL="${AUTH_PUBLIC_URL:-https://auth.projet-indiv26.local}"

echo "=== M7 - Building Kubernetes images ==="

docker build -f apps/api/Dockerfile -t projet-indiv26-legacy-api:m7-local .
docker build --target migration -f apps/api/Dockerfile -t projet-indiv26-legacy-migrate:m7-local .

docker build -f apps/gateway/Dockerfile -t projet-indiv26-gateway:m7-local .

docker build -f apps/catalog-service/Dockerfile -t projet-indiv26-catalog-service:m7-local .
docker build --target migration -f apps/catalog-service/Dockerfile -t projet-indiv26-catalog-migrate:m7-local .

docker build -f apps/marketplace-service/Dockerfile -t projet-indiv26-marketplace-service:m7-local .
docker build --target migration -f apps/marketplace-service/Dockerfile -t projet-indiv26-marketplace-migrate:m7-local .

docker build -f apps/notification-service/Dockerfile -t projet-indiv26-notification-service:m7-local .

docker build \
  --build-arg NEXT_PUBLIC_API_URL=/api \
  --build-arg NEXT_PUBLIC_KEYCLOAK_URL="${AUTH_PUBLIC_URL}" \
  --build-arg NEXT_PUBLIC_KEYCLOAK_REALM=projet-indiv26 \
  --build-arg NEXT_PUBLIC_KEYCLOAK_CLIENT_ID=web \
  --build-arg API_INTERNAL_URL=http://gateway:3000 \
  -f apps/web/Dockerfile \
  -t projet-indiv26-web:m7-local \
  .

docker build -f infra/keycloak/Dockerfile.k8s -t projet-indiv26-keycloak:m7-local .
docker build -f infra/minio/Dockerfile.server -t projet-indiv26-minio:lot9b-local .
docker build -f infra/minio/Dockerfile.mc-bootstrap -t projet-indiv26-minio-bootstrap:lot9b-local .

echo "M7 Kubernetes images: PASS"
