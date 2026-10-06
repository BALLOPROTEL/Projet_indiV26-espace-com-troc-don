#!/usr/bin/env bash
set -euo pipefail

if [[ "${CODESPACES:-}" != "true" ]]; then
  echo "[FAIL] This command is reserved for GitHub Codespaces."
  exit 1
fi

node .devcontainer/prepare-codespaces.mjs

compose=(
  docker compose
  --env-file .codespaces/codespace.env
  -f compose.yaml
  -f .devcontainer/compose.codespaces.yml
)

echo "=== ProjetIndiv26 Codespaces infrastructure ==="
"${compose[@]}" up -d --wait postgres keycloak minio
"${compose[@]}" run --rm minio-init

echo "[INFO] Waiting for Keycloak realm..."
for attempt in $(seq 1 120); do
  if curl -fsS http://127.0.0.1:8081/realms/projet-indiv26/.well-known/openid-configuration >/dev/null 2>&1; then
    echo "[OK] Keycloak realm ready."
    break
  fi
  if [[ "${attempt}" -eq 120 ]]; then
    echo "[FAIL] Keycloak did not become ready."
    "${compose[@]}" logs --tail=120 keycloak
    exit 1
  fi
  sleep 2
done

pnpm db:deploy
pnpm catalog:migrate:deploy
pnpm --filter marketplace-service prisma:migrate:deploy

echo
echo "[OK] PostgreSQL public/catalog/marketplace, Keycloak and MinIO are ready."
echo "Next:"
echo "  pnpm codespaces:check"
echo "  pnpm codespaces:dev"
