#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLUSTER_NAME="${M7_KIND_CLUSTER:-projet-indiv26-m7-ci}"
KIND_VERSION="${KIND_VERSION:-v0.33.0}"
KIND_NODE_IMAGE="${KIND_NODE_IMAGE:-kindest/node:v1.37.0@sha256:a1ed56cfb0e7b93589bdf97c8cd566405a265939e3620fc4f5de89adff580ae5}"
KIND_BIN=""
KIND_KUBECONFIG_DIR=""
CLUSTER_CREATED=false
GATEWAY_PF_PID=""
KEYCLOAK_PF_PID=""
WEB_PF_PID=""

cleanup() {
  local exit_code=$?
  trap - EXIT INT TERM
  for pid in "${GATEWAY_PF_PID}" "${KEYCLOAK_PF_PID}" "${WEB_PF_PID}"; do
    if [ -n "${pid}" ]; then
      kill "${pid}" >/dev/null 2>&1 || true
      wait "${pid}" 2>/dev/null || true
    fi
  done

  if [ "${CLUSTER_CREATED}" = "true" ]; then
    if [ "${exit_code}" -ne 0 ]; then
      local report="/tmp/m7-kind-debug.log"
      echo "[DIAG] Collecting Kubernetes diagnostics..."

      {
        echo "=== Pods ==="
        kubectl -n projet-indiv26 get pods -o wide || true

        echo "=== Web deployment ==="
        kubectl -n projet-indiv26 describe deployment web || true

        echo "=== Web Pod diagnostics ==="
        for pod in $(kubectl -n projet-indiv26 get pods -l app.kubernetes.io/name=web -o name 2>/dev/null); do
          kubectl -n projet-indiv26 describe "${pod}" || true
          kubectl -n projet-indiv26 logs "${pod}" --tail=100 || true
          kubectl -n projet-indiv26 logs "${pod}" --previous --tail=100 || true
        done

        echo "=== Kubernetes events ==="
        kubectl -n projet-indiv26 get events --sort-by=.lastTimestamp || true

        echo "=== Disk ==="
        df -h /workspaces || true

        echo "=== Memory ==="
        free -h || true
      } > "${report}" 2>&1

      echo "[DIAG] Report saved: ${report}"
    fi

    "${KIND_CMD[@]}" delete cluster --name "${CLUSTER_NAME}" >/dev/null 2>&1 || true
  fi

  [ -z "${KIND_BIN}" ] || rm -f "${KIND_BIN}"
  [ -z "${KIND_KUBECONFIG_DIR}" ] || rm -rf "${KIND_KUBECONFIG_DIR}"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

cd "${ROOT_DIR}"

# Every kubectl invocation (including the apply/validation subprocesses)
# targets only this smoke's temporary kubeconfig. Never merge a kind context
# into the developer's original ~/.kube/config or leave it as current.
KIND_KUBECONFIG_DIR="$(mktemp -d)"
export KUBECONFIG="${KIND_KUBECONFIG_DIR}/config"

for cmd in docker kubectl curl openssl base64 node; do
  command -v "${cmd}" >/dev/null 2>&1 || {
    echo "[FAIL] Missing command: ${cmd}"
    exit 1
  }
done

if command -v kind >/dev/null 2>&1; then
  KIND_CMD=(kind)
else
  # Official kind releases provide separate Linux AMD64 and ARM64 binaries.
  case "$(uname -m)" in
    x86_64|amd64) KIND_HOST_ARCH="amd64" ;;
    aarch64|arm64) KIND_HOST_ARCH="arm64" ;;
    *)
      echo "[FAIL] Unsupported host architecture for kind: $(uname -m)"
      exit 1
      ;;
  esac
  KIND_BIN="$(mktemp)"
  curl -fsSL -o "${KIND_BIN}" \
    "https://kind.sigs.k8s.io/dl/${KIND_VERSION}/kind-linux-${KIND_HOST_ARCH}"
  chmod +x "${KIND_BIN}"
  KIND_CMD=("${KIND_BIN}")
fi

echo "=== M7 - kind Kubernetes smoke ==="
if "${KIND_CMD[@]}" get clusters | grep -Fxq "${CLUSTER_NAME}"; then
  echo "[FAIL] kind cluster already exists: ${CLUSTER_NAME}"
  echo "[INFO] Refusing to delete or reuse a cluster not created by this smoke run."
  exit 1
fi

"${KIND_CMD[@]}" create cluster   --name "${CLUSTER_NAME}"   --image "${KIND_NODE_IMAGE}"   --wait 120s   --kubeconfig "${KUBECONFIG}"
CLUSTER_CREATED=true

bash scripts/m7-build-images.sh

images=(
  projet-indiv26-legacy-api:m7-local
  projet-indiv26-legacy-migrate:m7-local
  projet-indiv26-gateway:m7-local
  projet-indiv26-catalog-service:m7-local
  projet-indiv26-catalog-migrate:m7-local
  projet-indiv26-marketplace-service:m7-local
  projet-indiv26-marketplace-migrate:m7-local
  projet-indiv26-notification-service:m7-local
  projet-indiv26-notification-migrate:m8-local
  projet-indiv26-web:m7-local
  projet-indiv26-keycloak:m7-local
  projet-indiv26-minio:lot9b-local
  projet-indiv26-minio-bootstrap:lot9b-local
)

for image in "${images[@]}"; do
  "${KIND_CMD[@]}" load docker-image --name "${CLUSTER_NAME}" "${image}"
done

kubectl apply -f infra/k8s/minikube/namespace.yaml >/dev/null
kubectl -n projet-indiv26 create secret generic postgres-credentials \
  --from-literal='POSTGRES_DB=projet#ci?db' \
  --from-literal=POSTGRES_USER=app \
  --from-literal='POSTGRES_PASSWORD=m7:db@reserved/?#value' \
  --dry-run=client -o yaml | kubectl apply -f - >/dev/null
kubectl -n projet-indiv26 create secret generic rabbitmq-credentials \
  --from-literal=RABBITMQ_DEFAULT_USER=app \
  --from-literal='RABBITMQ_DEFAULT_PASS=m7:rabbit@reserved/?#value' \
  --dry-run=client -o yaml | kubectl apply -f - >/dev/null

M7_SKIP_OBSERVABILITY=true bash scripts/m7-k8s-apply.sh

for deployment in legacy-api catalog-service marketplace-service notification-service gateway web; do
  kubectl -n projet-indiv26 rollout status "deployment/${deployment}" --timeout=240s
done

kubectl -n projet-indiv26 exec deployment/gateway -- node -e "
const targets = [
  'http://legacy-api:3099/api/health/live',
  'http://catalog-service:3101/health/ready',
  'http://marketplace-service:3102/health/ready',
];
Promise.all(targets.map(async (url) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(url + ' -> ' + response.status);
})).catch((error) => { console.error(error); process.exit(1); });
"

kubectl -n projet-indiv26 exec deployment/marketplace-service -- node -e "
fetch('http://catalog-service:3101/health/ready')
  .then((response) => {
    if (!response.ok) throw new Error(String(response.status));
  })
  .catch((error) => { console.error(error); process.exit(1); });
"

kubectl -n projet-indiv26 exec deployment/rabbitmq -- rabbitmq-diagnostics -q ping >/dev/null

kubectl -n projet-indiv26 port-forward service/gateway 13000:3000 >/tmp/m7-kind-gateway.log 2>&1 &
GATEWAY_PF_PID=$!
kubectl -n projet-indiv26 port-forward service/keycloak 18081:8080 >/tmp/m7-kind-keycloak.log 2>&1 &
KEYCLOAK_PF_PID=$!
kubectl -n projet-indiv26 port-forward service/web 13001:3001 >/tmp/m7-kind-web.log 2>&1 &
WEB_PF_PID=$!

for attempt in $(seq 1 45); do
  gateway_ok=0
  keycloak_ok=0
  web_ok=0
  curl -fsS http://127.0.0.1:13000/api/health/ready >/dev/null 2>&1 && gateway_ok=1 || true
  curl -fsS -H 'Host: auth.projet-indiv26.test'     http://127.0.0.1:18081/realms/projet-indiv26/.well-known/openid-configuration >/dev/null 2>&1     && keycloak_ok=1 || true
  curl -fsS http://127.0.0.1:13001/ >/dev/null 2>&1 && web_ok=1 || true

  if [ "${gateway_ok}" -eq 1 ] && [ "${keycloak_ok}" -eq 1 ] && [ "${web_ok}" -eq 1 ]; then
    break
  fi
  if [ "${attempt}" -eq 45 ]; then
    echo "[FAIL] kind port-forward smoke did not become ready."
    cat /tmp/m7-kind-gateway.log /tmp/m7-kind-keycloak.log /tmp/m7-kind-web.log || true
    exit 1
  fi
  sleep 2
done

token_response="$(
  curl -fsS -H 'Host: auth.projet-indiv26.test'     -X POST http://127.0.0.1:18081/realms/projet-indiv26/protocol/openid-connect/token     -H 'content-type: application/x-www-form-urlencoded'     --data-urlencode 'grant_type=password'     --data-urlencode 'client_id=cli'     --data-urlencode 'username=demo-user'     --data-urlencode 'password=demo-user-local'
)"

access_token="$(
  TOKEN_RESPONSE="${token_response}" node -e "
    const payload = JSON.parse(process.env.TOKEN_RESPONSE);
    if (!payload.access_token) process.exit(1);
    process.stdout.write(payload.access_token);
  "
)"

ACCESS_TOKEN="${access_token}" node - <<'NODE'
const payload = JSON.parse(
  Buffer.from(process.env.ACCESS_TOKEN.split('.')[1], 'base64url').toString('utf8'),
);
const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
if (payload.iss !== 'https://auth.projet-indiv26.test/realms/projet-indiv26') {
  throw new Error('Unexpected issuer: ' + payload.iss);
}
if (!audiences.includes('api')) {
  throw new Error('Missing api audience');
}
NODE

status="$(
  curl -sS -o /tmp/m7-kind-proposals.json -w '%{http_code}'     -H "Authorization: Bearer ${access_token}"     http://127.0.0.1:13000/api/proposals/me
)"
[ "${status}" = "200" ]

# Persistence regression: restarting Keycloak must NOT change JWT subject
# (Marketplace/PostgreSQL records refer to this stable value).
first_subject="$(ACCESS_TOKEN="${access_token}" node -e "
  const p = JSON.parse(Buffer.from(process.env.ACCESS_TOKEN.split('.')[1], 'base64url').toString());
  if (!p.sub) process.exit(1);
  process.stdout.write(p.sub);
")"
echo "[INFO] Restarting Keycloak to prove persistent user identity..."
kubectl -n projet-indiv26 rollout restart deployment/keycloak >/dev/null
kubectl -n projet-indiv26 rollout status deployment/keycloak --timeout=240s

# Port forwarding a Service selects one pod; re-establish it after rollout.
kill "${KEYCLOAK_PF_PID}" >/dev/null 2>&1 || true
wait "${KEYCLOAK_PF_PID}" 2>/dev/null || true
kubectl -n projet-indiv26 port-forward service/keycloak 18081:8080 >/tmp/m7-kind-keycloak.log 2>&1 &
KEYCLOAK_PF_PID=$!

second_token=""
for attempt in $(seq 1 45); do
  second_token="$(curl -fsS -H 'Host: auth.projet-indiv26.test' \
    --connect-timeout 2 --max-time 5 \
    -X POST http://127.0.0.1:18081/realms/projet-indiv26/protocol/openid-connect/token \
    -H 'content-type: application/x-www-form-urlencoded' \
    --data-urlencode 'grant_type=password' \
    --data-urlencode 'client_id=cli' \
    --data-urlencode 'username=demo-user' \
    --data-urlencode 'password=demo-user-local' 2>/dev/null || true)"
  if [ -n "${second_token}" ]; then
    break
  fi
  sleep 2
done
if [ -z "${second_token}" ]; then
  echo "[FAIL] Keycloak token endpoint unavailable after restart."
  exit 1
fi
SECOND_TOKEN="${second_token}" FIRST_SUB="${first_subject}" node <<'NODE'
const jwt = JSON.parse(process.env.SECOND_TOKEN);
if (!jwt.access_token) throw new Error('No JWT after Keycloak restart');
const payload = JSON.parse(Buffer.from(jwt.access_token.split('.')[1], 'base64url').toString());
if (payload.sub !== process.env.FIRST_SUB) {
  throw new Error('Keycloak JWT sub changed after pod recreation');
}
console.log('[OK] Keycloak JWT sub persists across pod recreation.');
NODE

kubectl -n projet-indiv26 get deployments,services,jobs,hpa
echo "M7 kind multi-services smoke: PASS"
