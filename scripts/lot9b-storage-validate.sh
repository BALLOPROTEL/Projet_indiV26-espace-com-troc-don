#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATIC_ONLY=false
KUBECTL_SHIM_DIR=""
RENDERED=""

cleanup() {
  [ -z "${RENDERED}" ] || rm -f "${RENDERED}"
  [ -z "${KUBECTL_SHIM_DIR}" ] || rm -rf "${KUBECTL_SHIM_DIR}"
}
trap cleanup EXIT INT TERM

if [ "${1:-}" = "--static" ]; then
  STATIC_ONLY=true
fi

cd "${ROOT_DIR}"

echo "=== LOT 9B-B - object storage validation ==="

for file in   infra/minio/listing-images-policy.json   infra/k8s/minikube/minio-pvc.yaml   infra/k8s/minikube/minio-deployment.yaml   infra/k8s/minikube/minio-service.yaml   infra/k8s/minikube/minio-bootstrap-configmap.yaml   infra/k8s/minikube/minio-bootstrap-job.yaml   apps/api/src/storage/object-storage.service.ts   apps/api/src/storage/storage.module.ts   apps/api/src/listings/image-file.validator.ts   apps/api/src/listings/listing-images.service.ts   apps/api/src/listings/listing-images.controller.ts   apps/api/test/object-storage.integration-spec.ts; do
  test -f "${file}" || {
    echo "[FAIL] Missing LOT 9B-B artifact: ${file}"
    exit 1
  }
done

python3 - <<'PY'
import json
from pathlib import Path

policy = json.loads(
    Path("infra/minio/listing-images-policy.json").read_text(
        encoding="utf-8"
    )
)
serialized = json.dumps(policy)
required = [
    "s3:GetBucketLocation",
    "s3:ListBucket",
    "s3:GetObject",
    "s3:PutObject",
    "s3:DeleteObject",
    "arn:aws:s3:::listing-images",
]
for item in required:
    assert item in serialized, item

assert "s3:*" not in serialized
print("[OK] Bucket policy JSON is valid and least-privilege.")
PY

grep -q 'image: quay.io/minio/mc:RELEASE.2025-04-16T18-13-26Z' compose.yaml
grep -q 'image: quay.io/minio/mc:RELEASE.2025-04-16T18-13-26Z' infra/k8s/minikube/minio-bootstrap-job.yaml

if grep -R -qE 'image:[[:space:]]+minio/mc:' compose.yaml infra/k8s/minikube; then
  echo "[FAIL] Docker Hub minio/mc reference detected; use quay.io/minio/mc."
  exit 1
fi

if command -v docker >/dev/null 2>&1; then
  docker compose config >/dev/null
  echo "[OK] Docker Compose with MinIO renders successfully."
fi

if ! command -v kubectl >/dev/null 2>&1; then
  if command -v minikube >/dev/null 2>&1; then
    KUBECTL_SHIM_DIR="$(mktemp -d)"
    cat > "${KUBECTL_SHIM_DIR}/kubectl" <<'EOF'
#!/usr/bin/env bash
exec minikube kubectl -- "$@"
EOF
    chmod +x "${KUBECTL_SHIM_DIR}/kubectl"
    export PATH="${KUBECTL_SHIM_DIR}:${PATH}"
  else
    echo "[FAIL] kubectl or minikube is required for Kustomize validation."
    exit 1
  fi
fi

RENDERED="$(mktemp)"
kubectl kustomize infra/k8s/minikube > "${RENDERED}"

grep -q 'name: minio' "${RENDERED}"
grep -q 'name: minio-bootstrap' "${RENDERED}"
grep -q 'name: object-storage-credentials' "${RENDERED}"
grep -q 'S3_ENDPOINT: http://minio:9000' "${RENDERED}"
grep -q 'type: ClusterIP' infra/k8s/minikube/minio-service.yaml

if grep -R -q '^kind: Ingress$' infra/k8s/minikube/minio*.yaml; then
  echo "[FAIL] MinIO must not have a public Ingress."
  exit 1
fi

echo "[OK] MinIO Kubernetes resources render without public Ingress."
echo "[OK] LOT 9B-B static validation: PASS"

if [ "${STATIC_ONLY}" = true ]; then
  exit 0
fi

for cmd in docker curl pnpm; do
  command -v "${cmd}" >/dev/null 2>&1 || {
    echo "[FAIL] Missing command for live storage validation: ${cmd}"
    exit 1
  }
done

echo "[INFO] Starting PostgreSQL, MinIO and bucket bootstrap..."
docker compose up -d postgres minio minio-init

BOOTSTRAP_OK=false
for attempt in $(seq 1 60); do
  state="$(docker inspect -f '{{.State.Status}}' projet-indiv26-minio-init 2>/dev/null || true)"
  exit_code="$(docker inspect -f '{{.State.ExitCode}}' projet-indiv26-minio-init 2>/dev/null || true)"

  if [ "${state}" = "exited" ]; then
    if [ "${exit_code}" = "0" ]; then
      BOOTSTRAP_OK=true
      break
    fi

    echo "[FAIL] MinIO bootstrap exited with code ${exit_code}."
    docker logs projet-indiv26-minio-init || true
    exit 1
  fi

  echo "[WAIT] MinIO bootstrap: ${attempt}/60"
  sleep 2
done

if [ "${BOOTSTRAP_OK}" != "true" ]; then
  echo "[FAIL] MinIO bootstrap did not complete in time."
  docker logs projet-indiv26-minio-init || true
  exit 1
fi

HEALTH_STATUS="$(curl -sS -o /dev/null -w '%{http_code}'   http://127.0.0.1:9000/minio/health/live)"

if [ "${HEALTH_STATUS}" != "200" ]; then
  echo "[FAIL] MinIO health returned HTTP ${HEALTH_STATUS}; expected 200."
  exit 1
fi

ANON_STATUS="$(curl -sS -o /dev/null -w '%{http_code}'   http://127.0.0.1:9000/listing-images/)"

if [ "${ANON_STATUS}" != "403" ]; then
  echo "[FAIL] Anonymous bucket access returned HTTP ${ANON_STATUS}; expected 403."
  exit 1
fi

echo "[OK] MinIO healthy and listing-images bucket rejects anonymous access."

echo "[INFO] Applying Prisma migrations before storage integration..."
pnpm db:deploy

S3_ENDPOINT=http://127.0.0.1:9000 S3_REGION=us-east-1 S3_BUCKET=listing-images S3_ACCESS_KEY=marketplace-api S3_SECRET_KEY=marketplace_storage_local_change_me_2026 S3_FORCE_PATH_STYLE=true pnpm --filter api exec jest   --config jest.integration.config.cjs   --runInBand   test/object-storage.integration-spec.ts

echo "LOT 9B-B object storage validation: PASS"
