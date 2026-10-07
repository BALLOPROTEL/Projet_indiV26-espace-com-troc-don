#!/usr/bin/env bash
set -euo pipefail

export COMPOSE_PROJECT_NAME="projet-indiv26-m6-ci"
export POSTGRES_HOST_PORT=55433
export RABBITMQ_AMQP_HOST_PORT=55672
export RABBITMQ_MANAGEMENT_HOST_PORT=15682
export KEYCLOAK_HOST_PORT=18081
export MINIO_API_HOST_PORT=19000
export MINIO_CONSOLE_HOST_PORT=19001
export LEGACY_API_HOST_PORT=13099
export CATALOG_HOST_PORT=13101
export MARKETPLACE_HOST_PORT=13102
export NOTIFICATION_HOST_PORT=13103
export GATEWAY_HOST_PORT=13000
export WEB_HOST_PORT=13001
export KEYCLOAK_PUBLIC_URL=http://localhost:18081
export WEB_PUBLIC_URL=http://localhost:13001

smoke_dir=".m6-smoke"
export KEYCLOAK_REALM_FILE="./${smoke_dir}/keycloak-realm.json"

cleanup() {
  docker compose -f compose.yaml down -v --remove-orphans >/dev/null 2>&1 || true
  rm -rf "${smoke_dir}"
}

trap cleanup EXIT

rm -rf "${smoke_dir}"
mkdir -p "${smoke_dir}"

SMOKE_WEB_URL="${WEB_PUBLIC_URL}" node - <<'NODE'
const fs = require('node:fs');

const realm = JSON.parse(
  fs.readFileSync('infra/keycloak/projet-indiv26-realm.json', 'utf8'),
);
const webUrl = process.env.SMOKE_WEB_URL;
const webClient = realm.clients?.find((client) => client.clientId === 'web');

if (!webClient || !webUrl) {
  throw new Error('Missing Web client or SMOKE_WEB_URL');
}

webClient.rootUrl = webUrl;
webClient.baseUrl = webUrl;
webClient.redirectUris = [`${webUrl}/*`];
webClient.webOrigins = [webUrl];
webClient.attributes = {
  ...(webClient.attributes ?? {}),
  'pkce.code.challenge.method': 'S256',
  'post.logout.redirect.uris': `${webUrl}/*`,
};

fs.writeFileSync(
  '.m6-smoke/keycloak-realm.json',
  `${JSON.stringify(realm, null, 2)}\n`,
);
NODE

echo "=== M6 isolated Compose smoke ==="
docker compose -f compose.yaml up -d --build

bash scripts/m6-compose-check.sh

echo "[INFO] Validating the Web OIDC redirect registered by the smoke realm..."
verifier="m6-compose-smoke-pkce-verifier-2026"
challenge="$(
  printf '%s' "${verifier}" |
    openssl dgst -binary -sha256 |
    openssl base64 -A |
    tr '+/' '-_' |
    tr -d '='
)"

oidc_headers="${smoke_dir}/oidc-headers.txt"
oidc_status="$(
  curl -sS -o /dev/null -D "${oidc_headers}" -w '%{http_code}' -G     "http://127.0.0.1:${KEYCLOAK_HOST_PORT}/realms/projet-indiv26/protocol/openid-connect/auth"     --data-urlencode 'client_id=web'     --data-urlencode "redirect_uri=${WEB_PUBLIC_URL}/"     --data-urlencode 'response_type=code'     --data-urlencode 'scope=openid'     --data-urlencode 'prompt=none'     --data-urlencode "code_challenge=${challenge}"     --data-urlencode 'code_challenge_method=S256'
)"

if [[ "${oidc_status}" != "302" ]]; then
  echo "[FAIL] Web OIDC authorization returned HTTP ${oidc_status}; expected 302."
  cat "${oidc_headers}"
  exit 1
fi

location="$(awk 'BEGIN{IGNORECASE=1} /^location:/ {sub(/^[^:]*:[[:space:]]*/, ""); sub(/\r$/, ""); print; exit}' "${oidc_headers}")"
if [[ "${location}" != "${WEB_PUBLIC_URL}/"* ]]; then
  echo "[FAIL] Keycloak did not accept the M6 Web redirect URI."
  echo "Location: ${location}"
  exit 1
fi
echo "Web OIDC redirect URI: PASS"

echo "[INFO] Validating a real Keycloak token through the Gateway..."
token_response="$(
  curl -fsS -X POST     "http://127.0.0.1:${KEYCLOAK_HOST_PORT}/realms/projet-indiv26/protocol/openid-connect/token"     -H 'content-type: application/x-www-form-urlencoded'     --data-urlencode 'grant_type=password'     --data-urlencode 'client_id=cli'     --data-urlencode 'username=demo-user'     --data-urlencode 'password=demo-user-local'
)"

access_token="$(
  TOKEN_RESPONSE="${token_response}" node -e "
    const payload = JSON.parse(process.env.TOKEN_RESPONSE);
    if (!payload.access_token) process.exit(1);
    process.stdout.write(payload.access_token);
  "
)"

auth_status="$(
  curl -sS -o "${smoke_dir}/authenticated-proposals.json" -w '%{http_code}'     -H "Authorization: Bearer ${access_token}"     "http://127.0.0.1:${GATEWAY_HOST_PORT}/api/proposals"
)"

if [[ "${auth_status}" != "200" ]]; then
  echo "[FAIL] Authenticated Gateway request returned HTTP ${auth_status}; expected 200."
  cat "${smoke_dir}/authenticated-proposals.json"
  exit 1
fi
echo "Keycloak JWT -> Gateway -> Marketplace: PASS"

echo "M6 isolated Compose smoke: PASS"
