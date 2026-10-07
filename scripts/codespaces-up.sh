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
"${compose[@]}" up -d --build

bash scripts/m6-compose-check.sh

echo
echo "[OK] Codespaces multi-service stack is ready."
echo "Use: pnpm codespaces:dev  # follow application logs"
