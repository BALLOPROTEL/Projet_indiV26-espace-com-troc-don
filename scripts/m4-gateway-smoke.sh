#!/usr/bin/env bash
set -euo pipefail

stack_log=/tmp/m4-services-dev.log

cleanup() {
  if [[ -n "${stack_pid:-}" ]]; then
    kill "${stack_pid}" >/dev/null 2>&1 || true
    wait "${stack_pid}" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

dump_logs() {
  if [[ -f "${stack_log}" ]]; then
    echo
    echo "=== ${stack_log} ==="
    tail -n 200 "${stack_log}" || true
  fi
}

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

bash scripts/services-dev.sh > "${stack_log}" 2>&1 &
stack_pid=$!

wait_for_url "Legacy API" "http://127.0.0.1:3099/api/health/live"
wait_for_url "Catalog Service" "http://127.0.0.1:3101/health/live"
wait_for_url "Marketplace Service" "http://127.0.0.1:3102/health/live"
wait_for_url "Notification Service" "http://127.0.0.1:3103/health/live"
wait_for_url "API Gateway" "http://127.0.0.1:3000/api/health/live"
wait_for_url "API Gateway readiness" "http://127.0.0.1:3000/api/health/ready"

curl -fsS   -D /tmp/m4-gateway-headers.txt   -H 'x-request-id: m4-smoke-request'   http://127.0.0.1:3000/api/listings   > /tmp/m4-listings.json

node - <<'NODE'
const fs = require('node:fs');
const value = JSON.parse(fs.readFileSync('/tmp/m4-listings.json', 'utf8'));
if (!Array.isArray(value)) {
  throw new Error('Gateway /api/listings must return a JSON array');
}
NODE

grep -iq '^x-request-id: m4-smoke-request' /tmp/m4-gateway-headers.txt
grep -iq '^x-content-type-options: nosniff' /tmp/m4-gateway-headers.txt
grep -iq '^x-frame-options: DENY' /tmp/m4-gateway-headers.txt
if grep -iq '^x-powered-by:' /tmp/m4-gateway-headers.txt; then
  echo "[FAIL] Gateway leaked X-Powered-By"
  exit 1
fi
echo "Gateway -> Catalog /api/listings + security/request-id headers: PASS"

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

curl -fsS http://127.0.0.1:3000/api/metrics > /tmp/m4-metrics.txt
grep -q 'projet_indiv26_http_requests_total' /tmp/m4-metrics.txt
grep -q 'route="/api/listings"' /tmp/m4-metrics.txt
grep -q 'projet_indiv26_http_request_duration_seconds' /tmp/m4-metrics.txt
echo "Gateway observability metrics: PASS"

unknown_status="$(
  curl -sS -o /tmp/m4-unknown.json -w '%{http_code}'     http://127.0.0.1:3000/api/m4-unknown-route
)"
test "${unknown_status}" = "404"
echo "Gateway unknown-route rejection: PASS"

echo
echo "M4 Codex review smoke: PASS"
