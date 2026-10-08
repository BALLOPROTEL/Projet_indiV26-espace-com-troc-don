#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
K8S_DIR="${ROOT_DIR}/infra/k8s/minikube"
NAMESPACE="${NAMESPACE:-projet-indiv26}"
APP_HOST="${APP_HOST:-app.projet-indiv26.local}"
API_HOST="${API_HOST:-api.projet-indiv26.local}"
AUTH_HOST="${AUTH_HOST:-auth.projet-indiv26.local}"
MANIFEST_ONLY=false
RENDERED=""
KUBECTL_SHIM_DIR=""
INGRESS_PF_PID=""
INGRESS_PF_LOG=""

cleanup() {
  if [ -n "${INGRESS_PF_PID}" ]; then
    kill "${INGRESS_PF_PID}" >/dev/null 2>&1 || true
    wait "${INGRESS_PF_PID}" 2>/dev/null || true
  fi
  [ -z "${RENDERED}" ] || rm -f "${RENDERED}"
  [ -z "${KUBECTL_SHIM_DIR}" ] || rm -rf "${KUBECTL_SHIM_DIR}"
  [ -z "${INGRESS_PF_LOG}" ] || rm -f "${INGRESS_PF_LOG}"
}
trap cleanup EXIT INT TERM

if [ "${1:-}" = "--manifest-only" ]; then
  MANIFEST_ONLY=true
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
    echo "[FAIL] kubectl or minikube is required."
    exit 1
  fi
fi

echo "=== M7 - Kubernetes multi-services validation ==="

RENDERED="$(mktemp)"
kubectl kustomize "${K8S_DIR}" > "${RENDERED}"

require_rendered() {
  local pattern="$1"
  local label="$2"
  if ! grep -Eq "${pattern}" "${RENDERED}"; then
    echo "[FAIL] Missing rendered contract: ${label}"
    exit 1
  fi
}

for name in gateway legacy-api catalog-service marketplace-service notification-service web rabbitmq keycloak postgres minio; do
  require_rendered "name: ${name}$" "resource ${name}"
done

for image in   projet-indiv26-gateway:m7-local   projet-indiv26-legacy-api:m7-local   projet-indiv26-catalog-service:m7-local   projet-indiv26-marketplace-service:m7-local   projet-indiv26-notification-service:m7-local   projet-indiv26-web:m7-local; do
  require_rendered "image: ${image}" "image ${image}"
done

for job in legacy-migrate catalog-migrate marketplace-migrate minio-bootstrap; do
  require_rendered "name: ${job}$" "job ${job}"
done

require_rendered 'CATALOG_SERVICE_URL: http://catalog-service:3101' 'Gateway -> Catalog DNS'
require_rendered 'MARKETPLACE_SERVICE_URL: http://marketplace-service:3102' 'Gateway -> Marketplace DNS'
require_rendered 'LEGACY_API_URL: http://legacy-api:3099' 'Gateway -> legacy DNS'
require_rendered 'CATALOG_INTERNAL_URL: http://catalog-service:3101' 'Marketplace -> Catalog DNS'
require_rendered 'KEYCLOAK_JWKS_URL: http://keycloak:8080/' 'internal Keycloak JWKS'
require_rendered 'app.projet-indiv26.local' 'Web ingress host'
require_rendered 'api.projet-indiv26.local' 'Gateway ingress host'
require_rendered 'auth.projet-indiv26.local' 'Keycloak ingress host'
require_rendered 'secretName: platform-tls' 'platform TLS secret'
require_rendered 'kind: HorizontalPodAutoscaler' 'Gateway HPA'
require_rendered 'maxReplicas: 4' 'Gateway HPA max replicas'
require_rendered 'averageUtilization: 60' 'Gateway HPA CPU target'
require_rendered 'job_name: gateway-pods' 'Prometheus Gateway discovery'

if grep -Eq 'http://(localhost|127\.0\.0\.1)' "${RENDERED}"; then
  echo "[FAIL] A Kubernetes runtime manifest still contains localhost/127.0.0.1."
  grep -En 'http://(localhost|127\.0\.0\.1)' "${RENDERED}" || true
  exit 1
fi

if grep -Eq 'app\.kubernetes\.io/name: api$|name: api-config$|name: api$' "${RENDERED}"; then
  echo "[FAIL] Obsolete monolith API resource is still rendered in M7."
  exit 1
fi

startup_count="$(grep -c 'startupProbe:' "${RENDERED}")"
readiness_count="$(grep -c 'readinessProbe:' "${RENDERED}")"
requests_count="$(grep -c 'requests:' "${RENDERED}")"
limits_count="$(grep -c 'limits:' "${RENDERED}")"

[ "${startup_count}" -ge 8 ]
[ "${readiness_count}" -ge 10 ]
[ "${requests_count}" -ge 10 ]
[ "${limits_count}" -ge 10 ]

echo "[OK] Kustomize renders the M7 microservice topology."
echo "[OK] Kubernetes DNS, probes, resources, HPA, TLS and migration Jobs are declared."
echo "[OK] No obsolete monolith API or localhost inter-service dependency is rendered."

if [ "${MANIFEST_ONLY}" = true ]; then
  echo "M7 Kubernetes manifest validation: PASS"
  exit 0
fi

command -v curl >/dev/null 2>&1 || {
  echo "[FAIL] curl is required for live validation."
  exit 1
}

for deployment in   postgres rabbitmq minio keycloak   legacy-api catalog-service marketplace-service notification-service   gateway web prometheus grafana; do
  kubectl -n "${NAMESPACE}" rollout status "deployment/${deployment}" --timeout=240s
done

for job in minio-bootstrap legacy-migrate catalog-migrate marketplace-migrate; do
  kubectl -n "${NAMESPACE}" wait --for=condition=complete "job/${job}" --timeout=180s
done

kubectl -n "${NAMESPACE}" exec deployment/rabbitmq -- rabbitmq-diagnostics -q ping >/dev/null
echo "[OK] RabbitMQ pod responds to diagnostics."

kubectl -n "${NAMESPACE}" exec deployment/gateway -- node -e "
const targets = [
  ['legacy', 'http://legacy-api:3099/api/health/live'],
  ['catalog', 'http://catalog-service:3101/health/ready'],
  ['marketplace', 'http://marketplace-service:3102/health/ready'],
];
(async () => {
  for (const [name, url] of targets) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(name + ' -> ' + response.status);
  }
})().catch((error) => { console.error(error); process.exit(1); });
"
echo "[OK] Gateway -> Legacy/Catalog/Marketplace Kubernetes DNS."

kubectl -n "${NAMESPACE}" exec deployment/marketplace-service -- node -e "
fetch('http://catalog-service:3101/health/ready')
  .then((response) => {
    if (!response.ok) throw new Error(String(response.status));
  })
  .catch((error) => { console.error(error); process.exit(1); });
"
echo "[OK] Marketplace -> Catalog Kubernetes DNS."

MIN_REPLICAS="$(kubectl -n "${NAMESPACE}" get hpa gateway -o jsonpath='{.spec.minReplicas}')"
MAX_REPLICAS="$(kubectl -n "${NAMESPACE}" get hpa gateway -o jsonpath='{.spec.maxReplicas}')"
TARGET_CPU="$(kubectl -n "${NAMESPACE}" get hpa gateway -o jsonpath='{.spec.metrics[0].resource.target.averageUtilization}')"
[ "${MIN_REPLICAS}" = "1" ]
[ "${MAX_REPLICAS}" = "4" ]
[ "${TARGET_CPU}" = "60" ]
echo "[OK] Gateway HPA spec: 1..4 replicas at 60% CPU."

kubectl -n ingress-nginx rollout status deployment/ingress-nginx-controller --timeout=180s
INGRESS_PF_LOG="$(mktemp)"
kubectl -n ingress-nginx port-forward service/ingress-nginx-controller 8443:443 >"${INGRESS_PF_LOG}" 2>&1 &
INGRESS_PF_PID=$!

for attempt in $(seq 1 45); do
  if curl -kfsS --connect-timeout 2 --max-time 5     --resolve "${API_HOST}:8443:127.0.0.1"     "https://${API_HOST}:8443/api/health/live" >/dev/null 2>&1; then
    break
  fi
  if [ "${attempt}" -eq 45 ]; then
    echo "[FAIL] M7 TLS Ingress did not become reachable."
    cat "${INGRESS_PF_LOG}" || true
    exit 1
  fi
  sleep 2
done

curl -kfsS --resolve "${APP_HOST}:8443:127.0.0.1"   "https://${APP_HOST}:8443/" >/dev/null
curl -kfsS --resolve "${API_HOST}:8443:127.0.0.1"   "https://${API_HOST}:8443/api/health/ready" >/dev/null
curl -kfsS --resolve "${AUTH_HOST}:8443:127.0.0.1"   "https://${AUTH_HOST}:8443/realms/projet-indiv26/.well-known/openid-configuration" >/dev/null
echo "[OK] Web, Gateway and Keycloak answer through HTTPS Ingress."

token_response="$(
  curl -kfsS --resolve "${AUTH_HOST}:8443:127.0.0.1"     -X POST "https://${AUTH_HOST}:8443/realms/projet-indiv26/protocol/openid-connect/token"     -H 'content-type: application/x-www-form-urlencoded'     --data-urlencode 'grant_type=password'     --data-urlencode 'client_id=cli'     --data-urlencode 'username=demo-user'     --data-urlencode 'password=demo-user-local'
)"

access_token="$(
  TOKEN_RESPONSE="${token_response}" node -e "
    const payload = JSON.parse(process.env.TOKEN_RESPONSE);
    if (!payload.access_token) process.exit(1);
    process.stdout.write(payload.access_token);
  "
)"

ACCESS_TOKEN="${access_token}" EXPECTED_ISSUER="https://${AUTH_HOST}/realms/projet-indiv26" node - <<'NODE'
const token = process.env.ACCESS_TOKEN;
const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
const expected = process.env.EXPECTED_ISSUER;
const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
if (payload.iss !== expected) throw new Error('Unexpected issuer: ' + payload.iss);
if (!audiences.includes('api')) throw new Error('Missing api audience');
NODE

auth_status="$(
  curl -ksS -o /tmp/m7-proposals.json -w '%{http_code}'     --resolve "${API_HOST}:8443:127.0.0.1"     -H "Authorization: Bearer ${access_token}"     "https://${API_HOST}:8443/api/proposals/me"
)"
[ "${auth_status}" = "200" ]
echo "[OK] Real Keycloak JWT reaches Marketplace through the Gateway Ingress."

echo "[INFO] Waiting for Gateway HPA metrics..."
metrics_ok=false
for attempt in $(seq 1 24); do
  targets="$(kubectl -n "${NAMESPACE}" get hpa gateway --no-headers 2>/dev/null | awk '{print $3}')"
  if [ -n "${targets}" ] && [[ "${targets}" != *"<unknown>"* ]]; then
    metrics_ok=true
    echo "[OK] HPA metrics available: ${targets}"
    break
  fi
  sleep 5
done
if [ "${metrics_ok}" != "true" ]; then
  echo "[FAIL] Gateway HPA metrics are still unknown."
  kubectl -n "${NAMESPACE}" get hpa gateway || true
  exit 1
fi

kubectl -n "${NAMESPACE}" get pods,svc,ingress,hpa,pvc,jobs
echo "M7 Kubernetes multi-services validation: PASS"
