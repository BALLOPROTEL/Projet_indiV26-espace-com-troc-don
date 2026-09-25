#!/usr/bin/env bash
set -euo pipefail

KEYCLOAK_BASE_URL="${KEYCLOAK_BASE_URL:-http://localhost:8081}"
REALM="${KEYCLOAK_REALM:-projet-indiv26}"
CLIENT_ID="${KEYCLOAK_TEST_CLIENT_ID:-cli}"
API_BASE_URL="${API_BASE_URL:-http://localhost:3000}"

TOKEN_ENDPOINT="${KEYCLOAK_BASE_URL}/realms/${REALM}/protocol/openid-connect/token"
DISCOVERY_ENDPOINT="${KEYCLOAK_BASE_URL}/realms/${REALM}/.well-known/openid-configuration"
TMP_BODY="$(mktemp)"

cleanup() {
  rm -f "${TMP_BODY}"
}
trap cleanup EXIT

echo "=== LOT 2 - Keycloak/OIDC/RBAC smoke test ==="
echo "Waiting for Keycloak discovery endpoint..."

for attempt in $(seq 1 120); do
  if curl -fsS "${DISCOVERY_ENDPOINT}" >/dev/null 2>&1; then
    echo "[OK] Keycloak realm is reachable"
    break
  fi

  if [ "${attempt}" -eq 120 ]; then
    echo "[FAIL] Keycloak was not ready after 240 seconds"
    exit 1
  fi

  sleep 2
done

get_token() {
  local username="$1"
  local password="$2"
  local token_body
  local http_status

  token_body="$(mktemp)"

  http_status="$(curl -sS     -o "${token_body}"     -w "%{http_code}"     -X POST "${TOKEN_ENDPOINT}"     -H "Content-Type: application/x-www-form-urlencoded"     -d "grant_type=password"     -d "client_id=${CLIENT_ID}"     --data-urlencode "username=${username}"     --data-urlencode "password=${password}")"

  if [ "${http_status}" != "200" ]; then
    echo "[FAIL] Token request for ${username}: HTTP ${http_status}" >&2
    cat "${token_body}" >&2
    echo >&2
    rm -f "${token_body}"
    return 1
  fi

  node -e '
    const fs = require("fs");
    const input = fs.readFileSync(process.argv[1], "utf8");
    const payload = JSON.parse(input);
    if (!payload.access_token) {
      console.error("Token endpoint did not return an access_token");
      process.exit(1);
    }
    process.stdout.write(payload.access_token);
  ' "${token_body}"

  rm -f "${token_body}"
}

status_without_token() {
  local path="$1"
  curl -sS -o "${TMP_BODY}" -w "%{http_code}"     "${API_BASE_URL}${path}"
}

status_with_token() {
  local path="$1"
  local token="$2"
  curl -sS -o "${TMP_BODY}" -w "%{http_code}"     -H "Authorization: Bearer ${token}"     "${API_BASE_URL}${path}"
}

expect_status() {
  local label="$1"
  local expected="$2"
  local actual="$3"

  if [ "${actual}" != "${expected}" ]; then
    echo "[FAIL] ${label}: expected HTTP ${expected}, got ${actual}"
    cat "${TMP_BODY}"
    echo
    exit 1
  fi

  echo "[OK] ${label}: HTTP ${actual}"
}

USER_TOKEN="$(get_token demo-user demo-user-local)"
MODERATOR_TOKEN="$(get_token demo-moderator demo-moderator-local)"
ADMIN_TOKEN="$(get_token demo-admin demo-admin-local)"

expect_status "No token -> protected" 401   "$(status_without_token /api/auth/protected)"

expect_status "USER -> protected" 200   "$(status_with_token /api/auth/protected "${USER_TOKEN}")"

expect_status "USER -> moderator" 403   "$(status_with_token /api/auth/moderator "${USER_TOKEN}")"

expect_status "MODERATOR -> moderator" 200   "$(status_with_token /api/auth/moderator "${MODERATOR_TOKEN}")"

expect_status "ADMIN -> moderator" 200   "$(status_with_token /api/auth/moderator "${ADMIN_TOKEN}")"

expect_status "ADMIN -> admin" 200   "$(status_with_token /api/auth/admin "${ADMIN_TOKEN}")"

echo "LOT 2 smoke test: PASS"
