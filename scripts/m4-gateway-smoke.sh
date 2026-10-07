#!/usr/bin/env bash
set -euo pipefail

logs=(
  /tmp/m4-gateway.log
  /tmp/m4-legacy.log
  /tmp/m4-catalog.log
  /tmp/m4-marketplace.log
)

cleanup() {
  for pid in "${gateway_pid:-}" "${legacy_pid:-}" "${catalog_pid:-}" "${marketplace_pid:-}"; do
    [[ -z "${pid}" ]] || kill "${pid}" >/dev/null 2>&1 || true
  done
}

dump_logs() {
  for log in "${logs[@]}"; do
    if [[ -f "${log}" ]]; then
      echo
      echo "=== ${log} ==="
      tail -n 120 "${log}" || true
    fi
  done
}

trap cleanup EXIT

wait_for_url() {
  local name="$1"
  local url="$2"

  for attempt in $(seq 1 45); do
    if curl -fsS "${url}" >/dev/null 2>&1; then
      echo "${name}: ready"
      return 0
    fi
    sleep 1
  done

  echo "[FAIL] ${name} did not become ready: ${url}"
  dump_logs
  return 1
}

PORT=3099 pnpm api:dev > /tmp/m4-legacy.log 2>&1 &
legacy_pid=$!

pnpm catalog:dev > /tmp/m4-catalog.log 2>&1 &
catalog_pid=$!

pnpm marketplace-service:dev > /tmp/m4-marketplace.log 2>&1 &
marketplace_pid=$!

pnpm gateway:dev > /tmp/m4-gateway.log 2>&1 &
gateway_pid=$!

wait_for_url "Legacy API" "http://127.0.0.1:3099/api/health/live"
wait_for_url "Catalog Service" "http://127.0.0.1:3101/health/live"
wait_for_url "Marketplace Service" "http://127.0.0.1:3102/health/live"
wait_for_url "API Gateway" "http://127.0.0.1:3000/api/health/live"
wait_for_url "API Gateway readiness" "http://127.0.0.1:3000/api/health/ready"

curl -fsS http://127.0.0.1:3000/api/listings > /tmp/m4-listings.json
node - <<'NODE'
const fs = require('node:fs');
const value = JSON.parse(fs.readFileSync('/tmp/m4-listings.json', 'utf8'));
if (!Array.isArray(value)) {
  throw new Error('Gateway /api/listings must return a JSON array');
}
NODE
echo "Gateway -> Catalog /api/listings: PASS"

marketplace_status="$(
  curl -sS -o /tmp/m4-marketplace-denied.json -w '%{http_code}'     http://127.0.0.1:3000/api/proposals/me
)"
test "${marketplace_status}" = "401"
echo "Gateway -> Marketplace unauthenticated protection: PASS"

legacy_status="$(
  curl -sS -o /tmp/m4-legacy-denied.json -w '%{http_code}'     http://127.0.0.1:3000/api/auth/protected
)"
test "${legacy_status}" = "401"
echo "Gateway -> legacy fallback /api/auth/protected: PASS"

unknown_status="$(
  curl -sS -o /tmp/m4-unknown.json -w '%{http_code}'     http://127.0.0.1:3000/api/m4-unknown-route
)"
test "${unknown_status}" = "404"
echo "Gateway unknown-route rejection: PASS"

echo
echo "M4 API Gateway smoke: PASS"
