#!/usr/bin/env bash
set -euo pipefail

compose=(
  docker compose
  --env-file .codespaces/codespace.env
  -f compose.yaml
  -f .devcontainer/compose.codespaces.yml
)

echo "=== Containers ==="
"${compose[@]}" ps

echo
curl -fsS http://127.0.0.1:8081/realms/projet-indiv26/.well-known/openid-configuration >/dev/null
echo "Keycloak PASS"

curl -fsS http://127.0.0.1:9000/minio/health/live >/dev/null
echo "MinIO PASS"

"${compose[@]}" exec -T postgres pg_isready -U app -d projet_indiv26 >/dev/null
echo "PostgreSQL PASS"

pnpm api:typecheck
pnpm web:typecheck

echo
echo "Codespaces infrastructure/typecheck: PASS"
