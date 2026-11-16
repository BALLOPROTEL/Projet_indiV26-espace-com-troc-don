#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

[ "${JURY_ENVIRONMENT_CONFIRMED:-}" = "isolated" ] || {
  echo "[FAIL] Isolated jury environment confirmation required."
  exit 1
}
[ -n "${JURY_STACK_ENV_FILE:-}" ] && [ -f "$JURY_STACK_ENV_FILE" ] || {
  echo "[FAIL] Missing JURY_STACK_ENV_FILE."
  exit 1
}
[ -n "${JURY_REQUESTER_PASSWORD:-}" ] || {
  echo "[FAIL] JURY_REQUESTER_PASSWORD must be supplied in the environment for the requester login check."
  exit 1
}

read_env() {
  sed -n "s/^${1}=//p" "$JURY_STACK_ENV_FILE" | tail -n 1
}
project="$(read_env COMPOSE_PROJECT_NAME)"
keycloak_port="$(read_env KEYCLOAK_HOST_PORT)"
web_port="$(read_env WEB_HOST_PORT)"
gateway_port="$(read_env GATEWAY_HOST_PORT)"
catalog_port="$(read_env CATALOG_HOST_PORT)"
marketplace_port="$(read_env MARKETPLACE_HOST_PORT)"
notification_port="$(read_env NOTIFICATION_HOST_PORT)"
minio_port="$(read_env MINIO_API_HOST_PORT)"
keycloak_public="$(read_env KEYCLOAK_PUBLIC_URL)"

[[ "$project" =~ ^projet-indiv26-jury-[a-f0-9]{8}$ ]] || {
  echo "[FAIL] Invalid jury project name."
  exit 1
}

compose=(
  docker compose
  --env-file "$JURY_STACK_ENV_FILE"
  --project-name "$project"
  -f compose.yaml
  -f demo/jury/compose.jury.yml
)

wait_for_url() {
  local name="$1"
  local url="$2"
  for attempt in $(seq 1 90); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      echo "$name: PASS"
      return 0
    fi
    sleep 2
  done
  echo "[FAIL] $name unavailable: $url"
  "${compose[@]}" ps -a
  return 1
}

"${compose[@]}" ps -a
wait_for_url "Keycloak realm" "http://127.0.0.1:${keycloak_port}/realms/projet-indiv26/.well-known/openid-configuration"
wait_for_url "MinIO" "http://127.0.0.1:${minio_port}/minio/health/live"
wait_for_url "Catalog" "http://127.0.0.1:${catalog_port}/health/ready"
wait_for_url "Marketplace" "http://127.0.0.1:${marketplace_port}/health/ready"
wait_for_url "Notification" "http://127.0.0.1:${notification_port}/health/ready"
wait_for_url "Gateway" "http://127.0.0.1:${gateway_port}/api/health/ready"
wait_for_url "Web" "http://127.0.0.1:${web_port}"

JURY_TOKEN_URL="http://127.0.0.1:${keycloak_port}/realms/projet-indiv26/protocol/openid-connect/token" EXPECTED_ISSUER="${keycloak_public}/realms/projet-indiv26" node - <<'NODE'
const body = new URLSearchParams({
  grant_type: 'password',
  client_id: 'cli',
  username: 'demo-requester',
  password: process.env.JURY_REQUESTER_PASSWORD,
});
const response = await fetch(process.env.JURY_TOKEN_URL, {
  method: 'POST',
  headers: {'content-type': 'application/x-www-form-urlencoded'},
  body,
  redirect: 'error',
  signal: AbortSignal.timeout(8000),
});
if (!response.ok) throw new Error('demo-requester authentication failed');
const json = await response.json();
if (!json.access_token) throw new Error('No access token returned');
const payload = JSON.parse(Buffer.from(json.access_token.split('.')[1], 'base64url').toString());
const roles = new Set(payload.realm_access?.roles || []);
if (payload.preferred_username !== 'demo-requester') throw new Error('Unexpected requester identity');
if (payload.iss !== process.env.EXPECTED_ISSUER) throw new Error('Unexpected token issuer');
if (!roles.has('USER') || roles.has('MODERATOR') || roles.has('ADMIN')) {
  throw new Error('Requester RBAC is not USER-only');
}
console.log('demo-requester OIDC/JWT USER-only: PASS');
NODE

unset JURY_REQUESTER_PASSWORD || true
echo
echo "[OK] Isolated jury stack and second USER are technically ready for manual browser validation."
