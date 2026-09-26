#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NAMESPACE="projet-indiv26"
KUBECTL_SHIM_DIR=""
API_PF_PID=""
API_PF_LOG=""

cleanup() {
  if [ -n "${API_PF_PID}" ]; then
    kill "${API_PF_PID}" >/dev/null 2>&1 || true
    wait "${API_PF_PID}" 2>/dev/null || true
  fi
  [ -z "${API_PF_LOG}" ] || rm -f "${API_PF_LOG}"
  [ -z "${KUBECTL_SHIM_DIR}" ] || rm -rf "${KUBECTL_SHIM_DIR}"
}
trap cleanup EXIT INT TERM

for cmd in curl base64; do
  command -v "${cmd}" >/dev/null 2>&1 || {
    echo "[FAIL] Missing command: ${cmd}"
    exit 1
  }
done

if ! command -v kubectl >/dev/null 2>&1; then
  if ! command -v minikube >/dev/null 2>&1; then
    echo "[FAIL] kubectl is unavailable and minikube fallback is not installed."
    exit 1
  fi

  KUBECTL_SHIM_DIR="$(mktemp -d)"
  cat > "${KUBECTL_SHIM_DIR}/kubectl" <<'EOF'
#!/usr/bin/env bash
exec minikube kubectl -- "$@"
EOF
  chmod +x "${KUBECTL_SHIM_DIR}/kubectl"
  export PATH="${KUBECTL_SHIM_DIR}:${PATH}"
fi

cd "${ROOT_DIR}"

echo "=== LOT 9 - live security validation ==="

bash scripts/lot7-observability-validate.sh

kubectl -n "${NAMESPACE}" rollout status deployment/api --timeout=120s

API_PF_LOG="$(mktemp)"
kubectl -n "${NAMESPACE}" port-forward service/api 3002:80   >"${API_PF_LOG}" 2>&1 &
API_PF_PID=$!

READY=false
for attempt in $(seq 1 30); do
  if curl --connect-timeout 2 --max-time 5 -fsS     http://127.0.0.1:3002/api/health/live >/dev/null 2>&1; then
    READY=true
    break
  fi
  echo "[WAIT] API port-forward: ${attempt}/30"
  sleep 1
done

if [ "${READY}" != "true" ]; then
  echo "[FAIL] API port-forward did not become ready."
  cat "${API_PF_LOG}" || true
  exit 1
fi

HEADERS="$(mktemp)"
trap 'rm -f "${HEADERS}"; cleanup' EXIT INT TERM
curl -sS -D "${HEADERS}" -o /dev/null   http://127.0.0.1:3002/api/health/live

grep -qi '^x-content-type-options: nosniff' "${HEADERS}"
grep -qi '^x-frame-options: DENY' "${HEADERS}"
grep -qi '^referrer-policy: strict-origin-when-cross-origin' "${HEADERS}"
grep -qi '^permissions-policy:' "${HEADERS}"

if grep -qi '^x-powered-by:' "${HEADERS}"; then
  echo "[FAIL] X-Powered-By is still exposed."
  exit 1
fi

rm -f "${HEADERS}"
trap cleanup EXIT INT TERM

echo "[OK] API security headers are present and X-Powered-By is absent."

SWAGGER_STATUS="$(curl -sS -o /dev/null -w '%{http_code}'   http://127.0.0.1:3002/docs)"

if [ "${SWAGGER_STATUS}" != "404" ]; then
  echo "[FAIL] Production Swagger returned HTTP ${SWAGGER_STATUS}; expected 404."
  exit 1
fi

echo "[OK] Swagger is disabled in the production Minikube deployment."

UNAUTH_STATUS="$(curl -sS -o /dev/null -w '%{http_code}'   http://127.0.0.1:3002/api/metrics)"

if [ "${UNAUTH_STATUS}" != "401" ]; then
  echo "[FAIL] Metrics without token returned HTTP ${UNAUTH_STATUS}; expected 401."
  exit 1
fi

METRICS_TOKEN="$(kubectl -n "${NAMESPACE}" get secret api-secrets   -o jsonpath='{.data.METRICS_TOKEN}' | base64 -d)"

AUTH_STATUS="$(curl -sS -o /dev/null -w '%{http_code}'   -H "Authorization: Bearer ${METRICS_TOKEN}"   http://127.0.0.1:3002/api/metrics)"

if [ "${AUTH_STATUS}" != "200" ]; then
  echo "[FAIL] Metrics with token returned HTTP ${AUTH_STATUS}; expected 200."
  exit 1
fi

echo "[OK] Metrics endpoint rejects anonymous access and accepts the internal token."
echo "LOT 9 live security validation: PASS"
