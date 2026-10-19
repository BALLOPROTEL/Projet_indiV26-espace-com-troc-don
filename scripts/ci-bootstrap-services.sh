#!/usr/bin/env bash
# Ephemeral GitHub Actions ONLY. Docker service containers are started as job
# steps rather than native job.services (which pull images before any retry or
# fallback can execute). Nothing here touches a Codespace or persistent volume.
set -euo pipefail

pull_official() {
  local image="$1" source attempt
  if docker image inspect "${image}" >/dev/null 2>&1; then
    echo "[CI] Cached official image: ${image}"
    return 0
  fi
  # Same official Docker library tags, two independently operated registries.
  # Do NOT fall back to unofficial community mirrors or an unverified image.
  for source in "public.ecr.aws/docker/library/${image}" "docker.io/library/${image}"; do
    for attempt in 1 2 3; do
      echo "[CI] Pull ${image} from ${source} (try ${attempt}/3)"
      if docker pull "${source}"; then
        docker tag "${source}" "${image}"
        return 0
      fi
      echo "[CI] Official registry unavailable; retrying or using fallback."
      if [[ "${attempt}" -lt 3 ]]; then sleep "$((attempt * 3))"; fi
    done
  done
  echo "[FAIL] Both official registries failed for ${image}" >&2
  return 1
}

# Preload exactly the base images used by the existing CI Docker builds too.
for image in \
  postgres:16-alpine \
  rabbitmq:4.1-management-alpine \
  alpine:3.24.1 \
  node:24.20.0-alpine3.24; do
  pull_official "${image}"
done

cleanup_on_error() {
  docker rm -f bootstrap-ci-postgres bootstrap-ci-rabbitmq >/dev/null 2>&1 || true
}
trap cleanup_on_error ERR

# Reproduce the old action service ports/health checks; bind only to loopback.
docker run --detach --rm --name bootstrap-ci-postgres \
  --env POSTGRES_DB=projet_indiv26 --env POSTGRES_USER=app \
  --env POSTGRES_PASSWORD=app_ci_password \
  --publish 127.0.0.1:5432:5432 \
  --health-cmd 'pg_isready -U app -d projet_indiv26' \
  --health-interval 5s --health-timeout 3s --health-retries 10 \
  postgres:16-alpine

docker run --detach --rm --name bootstrap-ci-rabbitmq \
  --publish 127.0.0.1:5672:5672 \
  --publish 127.0.0.1:15672:15672 \
  --health-cmd 'rabbitmq-diagnostics -q ping' \
  --health-interval 5s --health-timeout 5s --health-retries 20 \
  rabbitmq:4.1-management-alpine

for name in bootstrap-ci-postgres bootstrap-ci-rabbitmq; do
  ready=false
  for attempt in $(seq 1 90); do
    status="$(docker inspect --format '{{.State.Health.Status}}' "${name}")"
    if [[ "${status}" == healthy ]]; then ready=true; break; fi
    if [[ "${status}" == unhealthy ]]; then
      echo "[FAIL] CI service became unhealthy: ${name}" >&2
      exit 1
    fi
    sleep 2
  done
  if [[ "${ready}" != true ]]; then
    echo "[FAIL] CI service health timed out: ${name}" >&2
    exit 1
  fi
  echo "[CI] ${name} healthy."
done
trap - ERR
