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

echo "=== LOT 3 - Listings/moderation E2E smoke test ==="

wait_for_url() {
  local label="$1"
  local url="$2"

  for attempt in $(seq 1 120); do
    if curl -fsS "${url}" >/dev/null 2>&1; then
      echo "[OK] ${label}"
      return 0
    fi
    sleep 2
  done

  echo "[FAIL] ${label} was not ready after 240 seconds"
  exit 1
}

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
    const payload = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    if (!payload.access_token) process.exit(1);
    process.stdout.write(payload.access_token);
  ' "${token_body}"

  rm -f "${token_body}"
}

api_call() {
  local method="$1"
  local path="$2"
  local token="${3:-}"
  local body="${4:-}"
  local args=(-sS -o "${TMP_BODY}" -w "%{http_code}" -X "${method}")

  if [ -n "${token}" ]; then
    args+=(-H "Authorization: Bearer ${token}")
  fi

  if [ -n "${body}" ]; then
    args+=(-H "Content-Type: application/json" --data "${body}")
  fi

  curl "${args[@]}" "${API_BASE_URL}${path}"
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

json_field() {
  local field="$1"
  node -e '
    const fs = require("fs");
    const payload = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    const value = payload[process.argv[2]];
    if (value === undefined || value === null) process.exit(1);
    process.stdout.write(String(value));
  ' "${TMP_BODY}" "${field}"
}

assert_field() {
  local label="$1"
  local field="$2"
  local expected="$3"
  local actual
  actual="$(json_field "${field}")"

  if [ "${actual}" != "${expected}" ]; then
    echo "[FAIL] ${label}: expected ${field}=${expected}, got ${actual}"
    cat "${TMP_BODY}"
    echo
    exit 1
  fi

  echo "[OK] ${label}: ${field}=${actual}"
}

assert_array_contains_id() {
  local label="$1"
  local id="$2"
  node -e '
    const fs = require("fs");
    const payload = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    if (!Array.isArray(payload) || !payload.some((item) => item.id === process.argv[2])) {
      process.exit(1);
    }
  ' "${TMP_BODY}" "${id}" || {
    echo "[FAIL] ${label}: listing ${id} not found"
    cat "${TMP_BODY}"
    echo
    exit 1
  }
  echo "[OK] ${label}"
}

assert_array_missing_id() {
  local label="$1"
  local id="$2"
  node -e '
    const fs = require("fs");
    const payload = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    if (!Array.isArray(payload) || payload.some((item) => item.id === process.argv[2])) {
      process.exit(1);
    }
  ' "${TMP_BODY}" "${id}" || {
    echo "[FAIL] ${label}: listing ${id} should not be present"
    cat "${TMP_BODY}"
    echo
    exit 1
  }
  echo "[OK] ${label}"
}

wait_for_url "Keycloak realm is reachable" "${DISCOVERY_ENDPOINT}"
wait_for_url "API liveness is reachable" "${API_BASE_URL}/api/health/live"

USER_TOKEN="$(get_token demo-user demo-user-local)"
MODERATOR_TOKEN="$(get_token demo-moderator demo-moderator-local)"
STAMP="$(date +%s)"

expect_status "Swagger/OpenAPI document" 200   "$(api_call GET /docs-json)"

APPROVE_BODY="{\"title\":\"LOT3 approval ${STAMP}\",\"description\":\"Annonce de test LOT 3 destinée à être approuvée par un modérateur.\",\"operationType\":\"TRADE\"}"
expect_status "USER creates listing" 201   "$(api_call POST /api/listings "${USER_TOKEN}" "${APPROVE_BODY}")"
APPROVE_ID="$(json_field id)"
assert_field "New listing starts pending" status PENDING

expect_status "Public listing collection before approval" 200   "$(api_call GET /api/listings)"
assert_array_missing_id "PENDING listing is not public" "${APPROVE_ID}"

expect_status "USER reads own listings" 200   "$(api_call GET /api/listings/me "${USER_TOKEN}")"
assert_array_contains_id "Owner sees PENDING listing" "${APPROVE_ID}"

expect_status "USER cannot access moderation" 403   "$(api_call GET "/api/moderation/listings?status=PENDING" "${USER_TOKEN}")"

expect_status "MODERATOR reads moderation queue" 200   "$(api_call GET "/api/moderation/listings?status=PENDING" "${MODERATOR_TOKEN}")"
assert_array_contains_id "PENDING listing is in moderation queue" "${APPROVE_ID}"

expect_status "MODERATOR approves listing" 200   "$(api_call POST "/api/moderation/listings/${APPROVE_ID}/approve" "${MODERATOR_TOKEN}")"
assert_field "Approved listing status" status APPROVED

expect_status "Public listing collection after approval" 200   "$(api_call GET /api/listings)"
assert_array_contains_id "APPROVED listing becomes public" "${APPROVE_ID}"

REJECT_BODY="{\"title\":\"LOT3 rejection ${STAMP}\",\"description\":\"Annonce de test LOT 3 destinée à être rejetée par un modérateur.\",\"operationType\":\"DONATION\"}"
expect_status "USER creates listing for rejection" 201   "$(api_call POST /api/listings "${USER_TOKEN}" "${REJECT_BODY}")"
REJECT_ID="$(json_field id)"

expect_status "MODERATOR rejects listing" 200   "$(api_call POST "/api/moderation/listings/${REJECT_ID}/reject" "${MODERATOR_TOKEN}" '{"reason":"Description à corriger avant publication."}')"
assert_field "Rejected listing status" status REJECTED

expect_status "Public collection excludes rejected listing" 200   "$(api_call GET /api/listings)"
assert_array_missing_id "REJECTED listing stays private" "${REJECT_ID}"

OWNERSHIP_BODY="{\"title\":\"LOT3 ownership ${STAMP}\",\"description\":\"Annonce créée par le modérateur pour vérifier la règle de propriété.\",\"operationType\":\"DONATION\"}"
expect_status "MODERATOR creates own listing" 201   "$(api_call POST /api/listings "${MODERATOR_TOKEN}" "${OWNERSHIP_BODY}")"
OWNERSHIP_ID="$(json_field id)"

expect_status "USER cannot edit another owner's listing" 403   "$(api_call PATCH "/api/listings/${OWNERSHIP_ID}" "${USER_TOKEN}" '{"title":"Modification interdite"}')"

echo "LOT 3 smoke test: PASS"
