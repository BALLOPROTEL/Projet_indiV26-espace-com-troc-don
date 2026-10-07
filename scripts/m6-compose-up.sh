#!/usr/bin/env bash
set -euo pipefail

if [[ "${CODESPACES:-}" == "true" ]]; then
  node .devcontainer/prepare-codespaces.mjs
  compose=(
    docker compose
    --env-file .codespaces/codespace.env
    -f compose.yaml
    -f .devcontainer/compose.codespaces.yml
  )
else
  compose=(docker compose -f compose.yaml)
fi

echo "=== ProjetIndiv26 M6 multi-service stack ==="
"${compose[@]}" up -d --build

bash scripts/m6-compose-check.sh

echo
echo "[OK] Full M6 stack is ready."
echo "Web: http://127.0.0.1:${WEB_HOST_PORT:-3001}"
echo "Gateway: http://127.0.0.1:${GATEWAY_HOST_PORT:-3000}"
