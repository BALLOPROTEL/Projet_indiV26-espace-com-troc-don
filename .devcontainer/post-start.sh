#!/usr/bin/env bash
set -euo pipefail

if [[ "${CODESPACES:-}" != "true" ]]; then
  exit 0
fi

if ! command -v pnpm >/dev/null 2>&1; then
  sudo corepack enable
  sudo corepack prepare pnpm@10.24.0 --activate
fi

if [[ ! -d node_modules ]]; then
  echo "[ProjetIndiv26] node_modules missing; restoring workspace dependencies..."
  pnpm install --frozen-lockfile
  pnpm db:generate
fi

node .devcontainer/prepare-codespaces.mjs

echo "[ProjetIndiv26] Codespaces configuration refreshed."
echo "[ProjetIndiv26] Start the full M6 stack with: pnpm codespaces:up"
