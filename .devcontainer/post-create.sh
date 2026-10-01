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

echo
echo "[ProjetIndiv26] Dependencies ready."
echo "[ProjetIndiv26] Docker/Keycloak/PostgreSQL/MinIO and Minikube are NOT started automatically."
echo "[ProjetIndiv26] Start the cloud stack with: pnpm codespaces:up"
