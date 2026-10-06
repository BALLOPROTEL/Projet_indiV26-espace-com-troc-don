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

catalog_table="$(${compose[@]} exec -T postgres psql -U app -d projet_indiv26 -Atqc 'SELECT to_regclass('"'"'catalog."Listing"'"'"') IS NOT NULL;')"
if [[ "${catalog_table}" != "t" ]]; then
  echo "[FAIL] Catalog schema/table is missing. Run pnpm codespaces:up."
  exit 1
fi
echo "Catalog schema PASS"

marketplace_table="$(${compose[@]} exec -T postgres psql -U app -d projet_indiv26 -Atqc 'SELECT to_regclass('"'"'marketplace."Proposal"'"'"') IS NOT NULL;')"
if [[ "${marketplace_table}" != "t" ]]; then
  echo "[FAIL] Marketplace schema/table is missing. Run pnpm codespaces:up."
  exit 1
fi
echo "Marketplace schema PASS"

pnpm api:typecheck
pnpm web:typecheck
pnpm catalog:prisma:validate
pnpm --filter catalog-service typecheck
pnpm --filter marketplace-service prisma:validate
pnpm --filter marketplace-service typecheck

echo
echo "Codespaces infrastructure/typecheck: PASS"
