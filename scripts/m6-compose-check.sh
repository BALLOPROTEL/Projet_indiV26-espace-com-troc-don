#!/usr/bin/env bash
set -euo pipefail

compose=(docker compose -f compose.yaml)

if [[ "${CODESPACES:-}" == "true" ]]; then
  if [[ ! -f .codespaces/codespace.env ]]; then
    node .devcontainer/prepare-codespaces.mjs
  fi

  compose=(
    docker compose
    --env-file .codespaces/codespace.env
    -f compose.yaml
    -f .devcontainer/compose.codespaces.yml
  )
fi

wait_for_url() {
  local name="$1"
  local url="$2"

  for attempt in $(seq 1 90); do
    if curl -fsS "${url}" >/dev/null 2>&1; then
      echo "${name}: PASS"
      return 0
    fi
    sleep 2
  done

  echo "[FAIL] ${name} unavailable: ${url}"
  "${compose[@]}" ps -a
  "${compose[@]}" logs --tail=120
  return 1
}

postgres_port="${POSTGRES_HOST_PORT:-5433}"
rabbitmq_management_port="${RABBITMQ_MANAGEMENT_HOST_PORT:-15672}"
keycloak_port="${KEYCLOAK_HOST_PORT:-8081}"
minio_api_port="${MINIO_API_HOST_PORT:-9000}"
legacy_port="${LEGACY_API_HOST_PORT:-3099}"
catalog_port="${CATALOG_HOST_PORT:-3101}"
marketplace_port="${MARKETPLACE_HOST_PORT:-3102}"
notification_port="${NOTIFICATION_HOST_PORT:-3103}"
gateway_port="${GATEWAY_HOST_PORT:-3000}"
web_port="${WEB_HOST_PORT:-3001}"

echo "=== M6 Compose services ==="
"${compose[@]}" ps -a

wait_for_url "Keycloak realm" "http://127.0.0.1:${keycloak_port}/realms/projet-indiv26/.well-known/openid-configuration"
wait_for_url "MinIO" "http://127.0.0.1:${minio_api_port}/minio/health/live"
wait_for_url "Legacy API" "http://127.0.0.1:${legacy_port}/api/health/live"
wait_for_url "Catalog Service" "http://127.0.0.1:${catalog_port}/health/ready"
wait_for_url "Marketplace Service" "http://127.0.0.1:${marketplace_port}/health/ready"
wait_for_url "Notification Service" "http://127.0.0.1:${notification_port}/health/ready"
wait_for_url "API Gateway" "http://127.0.0.1:${gateway_port}/api/health/ready"
wait_for_url "Web" "http://127.0.0.1:${web_port}"

"${compose[@]}" exec -T postgres pg_isready -U app -d projet_indiv26 >/dev/null
echo "PostgreSQL: PASS"

"${compose[@]}" exec -T rabbitmq rabbitmq-diagnostics -q ping >/dev/null
echo "RabbitMQ: PASS"

for schema_table in 'public."Listing"' 'catalog."Listing"' 'marketplace."Proposal"'; do
  exists="$("${compose[@]}" exec -T postgres psql -U app -d projet_indiv26 -Atqc "SELECT to_regclass('${schema_table}') IS NOT NULL;")"
  if [[ "${exists}" != "t" ]]; then
    echo "[FAIL] Missing migrated table: ${schema_table}"
    exit 1
  fi
done
echo "PostgreSQL public/catalog/marketplace ownership: PASS"

for migration in legacy-migrate catalog-migrate marketplace-migrate minio-init; do
  container_id="$("${compose[@]}" ps -aq "${migration}" | head -n 1)"
  if [[ -z "${container_id}" ]]; then
    echo "[FAIL] Missing one-shot service: ${migration}"
    exit 1
  fi

  exit_code="$(docker inspect -f '{{.State.ExitCode}}' "${container_id}")"
  if [[ "${exit_code}" != "0" ]]; then
    echo "[FAIL] ${migration} exited with ${exit_code}"
    exit 1
  fi
done
echo "Migration/bootstrap jobs: PASS"

"${compose[@]}" exec -T gateway node - <<'NODE'
const targets = [
  ['legacy', 'http://legacy-api:3099/api/health/live'],
  ['catalog', 'http://catalog-service:3101/health/ready'],
  ['marketplace', 'http://marketplace-service:3102/health/ready'],
];

(async () => {
  for (const [name, url] of targets) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`${name} internal DNS check failed: ${response.status}`);
    }
  }
  console.log('Gateway internal Docker DNS: PASS');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
NODE

"${compose[@]}" exec -T marketplace-service node - <<'NODE'
fetch('http://catalog-service:3101/health/ready')
  .then((response) => {
    if (!response.ok) {
      throw new Error(`Catalog internal readiness failed: ${response.status}`);
    }
    console.log('Marketplace -> Catalog Docker DNS: PASS');
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
NODE

curl -fsS "http://127.0.0.1:${gateway_port}/api/listings" >/dev/null
echo "Gateway -> Catalog public contract: PASS"

curl -fsS "http://127.0.0.1:${web_port}/api/listings" >/dev/null
echo "Web -> Gateway rewrite: PASS"

echo
echo "M6 Docker Compose multi-services: PASS"
