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

if [[ -z "$("${compose[@]}" ps -q gateway)" ]]; then
  echo "[FAIL] M6 stack is not running. Start it with: pnpm codespaces:up"
  exit 1
fi

echo "[ProjetIndiv26] Following M6 application logs. Ctrl+C stops log streaming only."
"${compose[@]}" logs -f --tail=100 \
  gateway \
  legacy-api \
  catalog-service \
  marketplace-service \
  notification-service \
  web
