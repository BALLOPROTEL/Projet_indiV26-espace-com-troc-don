#!/usr/bin/env bash
set -euo pipefail

cleanup() {
  for pid in     "${gateway_pid:-}"     "${legacy_pid:-}"     "${catalog_pid:-}"     "${marketplace_pid:-}"     "${notification_pid:-}"; do
    [[ -z "${pid}" ]] || kill "${pid}" >/dev/null 2>&1 || true
  done
}
trap cleanup EXIT INT TERM

pnpm gateway:dev &
gateway_pid=$!

PORT=3099 pnpm api:dev &
legacy_pid=$!

pnpm catalog:dev &
catalog_pid=$!

pnpm marketplace-service:dev &
marketplace_pid=$!

pnpm notification:dev &
notification_pid=$!

echo "[ProjetIndiv26] Backend service stack started."
echo "[ProjetIndiv26] Gateway: http://127.0.0.1:3000"
echo "[ProjetIndiv26] Legacy fallback: http://127.0.0.1:3099"
echo "[ProjetIndiv26] Catalog: http://127.0.0.1:3101"
echo "[ProjetIndiv26] Marketplace: http://127.0.0.1:3102"
echo "[ProjetIndiv26] Notification: http://127.0.0.1:3103"
echo "[ProjetIndiv26] Keep this terminal open. Ctrl+C stops the stack."

wait -n   "${gateway_pid}"   "${legacy_pid}"   "${catalog_pid}"   "${marketplace_pid}"   "${notification_pid}"
