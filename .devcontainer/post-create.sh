#!/usr/bin/env bash
set -euo pipefail

echo "[ProjetIndiv26] Preparing Codespaces environment..."

if ! command -v pnpm >/dev/null 2>&1; then
  echo "[ProjetIndiv26] pnpm missing; enabling Corepack..."
  sudo corepack enable
  sudo corepack prepare pnpm@10.24.0 --activate
fi

echo "[ProjetIndiv26] Node $(node -v)"
echo "[ProjetIndiv26] pnpm $(pnpm -v)"

pnpm install --frozen-lockfile
pnpm db:generate
node .devcontainer/prepare-codespaces.mjs

echo
echo "[ProjetIndiv26] Dependencies and Codespaces URLs are ready."
echo "[ProjetIndiv26] M6 containers are NOT started automatically to save quota."
echo "[ProjetIndiv26] Start the complete stack with: pnpm codespaces:up"
