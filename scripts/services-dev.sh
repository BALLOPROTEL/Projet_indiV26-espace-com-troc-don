#!/usr/bin/env bash
set -euo pipefail

cleaned_up=0

cleanup() {
  if [[ "${cleaned_up}" -eq 1 ]]; then
    return
  fi
  cleaned_up=1

  local pids=(
    "${gateway_pid:-}"
    "${legacy_pid:-}"
    "${catalog_pid:-}"
    "${marketplace_pid:-}"
    "${notification_pid:-}"
  )

  for pid in "${pids[@]}"; do
    if [[ -n "${pid}" ]]; then
      kill -TERM -- "-${pid}" >/dev/null 2>&1 || true
    fi
  done

  for pid in "${pids[@]}"; do
    if [[ -n "${pid}" ]]; then
      wait "${pid}" >/dev/null 2>&1 || true
    fi
  done
}

trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

# Keep pnpm services:dev usable outside Docker Compose. Fail fast rather
# than booting Marketplace or Notification against a missing database/schema.
export MARKETPLACE_DATABASE_URL="${MARKETPLACE_DATABASE_URL:-postgresql://app:app_local_change_me@127.0.0.1:5433/projet_indiv26?schema=marketplace}"
if ! pnpm marketplace-service:migrate:deploy; then
  echo "[FAIL] Marketplace PostgreSQL schema not ready. Start the local PostgreSQL service (docker compose up -d --wait postgres) and retry." >&2
  exit 1
fi

export NOTIFICATION_DATABASE_URL="${NOTIFICATION_DATABASE_URL:-postgresql://app:app_local_change_me@127.0.0.1:5433/projet_indiv26?schema=notification}"
if ! pnpm --filter notification-service prisma:migrate:deploy; then
  echo "[FAIL] Notification PostgreSQL schema not ready. Start the local PostgreSQL service (docker compose up -d --wait postgres) and retry." >&2
  exit 1
fi

setsid bash -lc 'exec pnpm gateway:dev' &
gateway_pid=$!

setsid bash -lc 'PORT=3099 exec pnpm api:dev' &
legacy_pid=$!

setsid bash -lc 'exec pnpm catalog:dev' &
catalog_pid=$!

setsid bash -lc 'exec pnpm marketplace-service:dev' &
marketplace_pid=$!

setsid bash -lc 'exec pnpm notification:dev' &
notification_pid=$!

echo "[ProjetIndiv26] Backend service stack started."
echo "[ProjetIndiv26] Gateway: http://127.0.0.1:3000"
echo "[ProjetIndiv26] Legacy fallback: http://127.0.0.1:3099"
echo "[ProjetIndiv26] Catalog: http://127.0.0.1:3101"
echo "[ProjetIndiv26] Marketplace: http://127.0.0.1:3102"
echo "[ProjetIndiv26] Notification: http://127.0.0.1:3103"
echo "[ProjetIndiv26] Keep this terminal open. Ctrl+C stops the stack."

wait -n   "${gateway_pid}"   "${legacy_pid}"   "${catalog_pid}"   "${marketplace_pid}"   "${notification_pid}"
