#!/usr/bin/env bash
set -euo pipefail

IMAGE="${1:-projet-indiv26-api:lot5-local}"
CONTAINER_NAME="${CONTAINER_NAME:-projet-indiv26-api-lot5-smoke}"
PORT="${PORT:-3001}"

cleanup() {
  docker rm -f "${CONTAINER_NAME}" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "=== LOT 5 - Docker image smoke test ==="
echo "Image: ${IMAGE}"

configured_user="$(docker image inspect "${IMAGE}" --format '{{.Config.User}}')"

if [ "${configured_user}" != "node" ]; then
  echo "[FAIL] Expected runtime user 'node', got '${configured_user:-<empty>}'"
  exit 1
fi

echo "[OK] Runtime user is non-root: ${configured_user}"

docker run -d   --name "${CONTAINER_NAME}"   -p "127.0.0.1:${PORT}:3000"   -e DATABASE_URL="postgresql://app:dummy@127.0.0.1:5432/projet_indiv26?schema=public"   -e KEYCLOAK_ISSUER="http://127.0.0.1:8081/realms/projet-indiv26"   -e KEYCLOAK_AUDIENCE="api"   "${IMAGE}" >/dev/null

for attempt in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:${PORT}/api/health/live" >/dev/null 2>&1; then
    echo "[OK] Container liveness endpoint: HTTP 200"
    echo "LOT 5 Docker smoke test: PASS"
    exit 0
  fi

  if ! docker inspect "${CONTAINER_NAME}" --format '{{.State.Running}}' 2>/dev/null | grep -q true; then
    echo "[FAIL] Container stopped before becoming ready"
    docker logs "${CONTAINER_NAME}" || true
    exit 1
  fi

  sleep 1
done

echo "[FAIL] Liveness endpoint did not respond after 30 seconds"
docker logs "${CONTAINER_NAME}" || true
exit 1
