#!/usr/bin/env bash
set -euo pipefail

export COMPOSE_PROJECT_NAME="projet-indiv26-m6-ci"
export POSTGRES_HOST_PORT=55433
export RABBITMQ_AMQP_HOST_PORT=55672
export RABBITMQ_MANAGEMENT_HOST_PORT=15682
export KEYCLOAK_HOST_PORT=18081
export MINIO_API_HOST_PORT=19000
export MINIO_CONSOLE_HOST_PORT=19001
export LEGACY_API_HOST_PORT=13099
export CATALOG_HOST_PORT=13101
export MARKETPLACE_HOST_PORT=13102
export NOTIFICATION_HOST_PORT=13103
export GATEWAY_HOST_PORT=13000
export WEB_HOST_PORT=13001
export KEYCLOAK_PUBLIC_URL=http://localhost:18081
export WEB_PUBLIC_URL=http://localhost:13001

cleanup() {
  docker compose -f compose.yaml down -v --remove-orphans >/dev/null 2>&1 || true
}

trap cleanup EXIT

echo "=== M6 isolated Compose smoke ==="
docker compose -f compose.yaml up -d --build

bash scripts/m6-compose-check.sh

echo "M6 isolated Compose smoke: PASS"
