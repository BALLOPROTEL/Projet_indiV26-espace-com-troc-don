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

echo "=== ProjetIndiv26 Codespaces M6 stack ==="
# A previous plain `docker compose up` may have created Keycloak with the
# localhost realm. Recreate it explicitly so the generated Codespaces realm,
# hostname and proxy settings are always applied.
"${compose[@]}" up -d --force-recreate --no-deps keycloak
"${compose[@]}" up -d --build

bash scripts/codespaces-keycloak-account-delete.sh
bash scripts/m6-compose-check.sh

echo
echo "[OK] Codespaces multi-service stack is ready."
echo "Use: pnpm codespaces:dev  # follow application logs"
