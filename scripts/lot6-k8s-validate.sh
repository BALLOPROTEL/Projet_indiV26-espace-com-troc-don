#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
K8S_DIR="${ROOT_DIR}/infra/k8s/minikube"
NAMESPACE="projet-indiv26"
MANIFEST_ONLY=false

RENDERED=""
API_PF_LOG=""
API_PF_PID=""
INGRESS_PF_LOG=""
INGRESS_PF_PID=""

cleanup() {
  if [ -n "${API_PF_PID}" ]; then
    kill "${API_PF_PID}" >/dev/null 2>&1 || true
    wait "${API_PF_PID}" 2>/dev/null || true
  fi

  if [ -n "${INGRESS_PF_PID}" ]; then
    kill "${INGRESS_PF_PID}" >/dev/null 2>&1 || true
    wait "${INGRESS_PF_PID}" 2>/dev/null || true
  fi

  [ -z "${RENDERED}" ] || rm -f "${RENDERED}"
  [ -z "${API_PF_LOG}" ] || rm -f "${API_PF_LOG}"
  [ -z "${INGRESS_PF_LOG}" ] || rm -f "${INGRESS_PF_LOG}"
}
trap cleanup EXIT INT TERM

if [ "${1:-}" = "--manifest-only" ]; then
  MANIFEST_ONLY=true
fi

command -v kubectl >/dev/null 2>&1 || {
  echo "[FAIL] kubectl is required."
  exit 1
}

echo "=== LOT 6 - Kubernetes validation ==="

RENDERED="$(mktemp)"
kubectl kustomize "${K8S_DIR}" > "${RENDERED}"

grep -q "kind: Deployment" "${RENDERED}"
grep -q "kind: Service" "${RENDERED}"
grep -q "kind: ConfigMap" "${RENDERED}"
grep -q "kind: Ingress" "${RENDERED}"
grep -q "kind: HorizontalPodAutoscaler" "${RENDERED}"
grep -q "runAsNonRoot: true" "${RENDERED}"
grep -q "allowPrivilegeEscalation: false" "${RENDERED}"
grep -q "readOnlyRootFilesystem: true" "${RENDERED}"
grep -q "startupProbe:" "${RENDERED}"
grep -q "livenessProbe:" "${RENDERED}"
grep -q "readinessProbe:" "${RENDERED}"
grep -q "requests:" "${RENDERED}"
grep -q "limits:" "${RENDERED}"
grep -q "minReplicas: 1" "${RENDERED}"
grep -q "maxReplicas: 4" "${RENDERED}"

if grep -q "REPLACE_ME" "${RENDERED}"; then
  echo "[FAIL] Example Secret leaked into rendered Kustomize output."
  exit 1
fi

echo "[OK] Kustomize manifests render successfully."
echo "[OK] SecurityContext, probes, resources and HPA declarations detected."
echo "[OK] Secret examples are not part of the rendered deployment."

if [ "${MANIFEST_ONLY}" = true ]; then
  echo "LOT 6 manifest validation: PASS"
  exit 0
fi

for cmd in curl; do
  command -v "${cmd}" >/dev/null 2>&1 || {
    echo "[FAIL] Missing command for live validation: ${cmd}"
    exit 1
  }
done

kubectl -n "${NAMESPACE}" rollout status deployment/postgres --timeout=120s
kubectl -n "${NAMESPACE}" rollout status deployment/api --timeout=120s

RUN_AS_NON_ROOT="$(kubectl -n "${NAMESPACE}" get deployment api -o jsonpath='{.spec.template.spec.securityContext.runAsNonRoot}')"
RUN_AS_USER="$(kubectl -n "${NAMESPACE}" get deployment api -o jsonpath='{.spec.template.spec.securityContext.runAsUser}')"
ALLOW_PE="$(kubectl -n "${NAMESPACE}" get deployment api -o jsonpath='{.spec.template.spec.containers[0].securityContext.allowPrivilegeEscalation}')"
READ_ONLY_FS="$(kubectl -n "${NAMESPACE}" get deployment api -o jsonpath='{.spec.template.spec.containers[0].securityContext.readOnlyRootFilesystem}')"

[ "${RUN_AS_NON_ROOT}" = "true" ]
[ "${RUN_AS_USER}" = "1000" ]
[ "${ALLOW_PE}" = "false" ]
[ "${READ_ONLY_FS}" = "true" ]

echo "[OK] API pod security: non-root UID 1000, no privilege escalation, read-only root filesystem."

MIN_REPLICAS="$(kubectl -n "${NAMESPACE}" get hpa api -o jsonpath='{.spec.minReplicas}')"
MAX_REPLICAS="$(kubectl -n "${NAMESPACE}" get hpa api -o jsonpath='{.spec.maxReplicas}')"
TARGET_CPU="$(kubectl -n "${NAMESPACE}" get hpa api -o jsonpath='{.spec.metrics[0].resource.target.averageUtilization}')"

[ "${MIN_REPLICAS}" = "1" ]
[ "${MAX_REPLICAS}" = "4" ]
[ "${TARGET_CPU}" = "60" ]

echo "[OK] HPA: min=1 max=4 target CPU=60%."

API_SECRET_TYPE="$(kubectl -n "${NAMESPACE}" get secret api-secrets -o jsonpath='{.type}')"
TLS_SECRET_TYPE="$(kubectl -n "${NAMESPACE}" get secret api-tls -o jsonpath='{.type}')"

[ "${API_SECRET_TYPE}" = "Opaque" ]
[ "${TLS_SECRET_TYPE}" = "kubernetes.io/tls" ]

echo "[OK] Runtime Secret and TLS Secret exist in the cluster."

API_PF_LOG="$(mktemp)"
kubectl -n "${NAMESPACE}" port-forward service/api 3002:80 >"${API_PF_LOG}" 2>&1 &
API_PF_PID=$!

SERVICE_OK=false
for attempt in $(seq 1 30); do
  if curl --connect-timeout 2 --max-time 5 -fsS     http://127.0.0.1:3002/api/health/live >/dev/null 2>&1; then
    SERVICE_OK=true
    break
  fi
  echo "[WAIT] Service API port-forward: attempt ${attempt}/30"
  sleep 1
done

if [ "${SERVICE_OK}" != "true" ]; then
  echo "[FAIL] API Service port-forward did not become reachable."
  cat "${API_PF_LOG}" || true
  exit 1
fi

curl --connect-timeout 2 --max-time 5 -fsS   http://127.0.0.1:3002/api/health/live >/dev/null
curl --connect-timeout 2 --max-time 5 -fsS   http://127.0.0.1:3002/api/health/ready >/dev/null

echo "[OK] Service API: liveness HTTP 200 and readiness HTTP 200."

kill "${API_PF_PID}" >/dev/null 2>&1 || true
wait "${API_PF_PID}" 2>/dev/null || true
API_PF_PID=""

echo "[INFO] Validating NGINX Ingress + TLS through a local controller port-forward..."

kubectl -n ingress-nginx rollout status deployment/ingress-nginx-controller --timeout=120s

INGRESS_PF_LOG="$(mktemp)"
kubectl -n ingress-nginx port-forward service/ingress-nginx-controller 8443:443 >"${INGRESS_PF_LOG}" 2>&1 &
INGRESS_PF_PID=$!

INGRESS_OK=false
for attempt in $(seq 1 30); do
  if curl --connect-timeout 2 --max-time 5 -kfsS     --resolve "api.projet-indiv26.local:8443:127.0.0.1"     "https://api.projet-indiv26.local:8443/api/health/live" >/dev/null 2>&1; then
    INGRESS_OK=true
    break
  fi
  echo "[WAIT] HTTPS Ingress: attempt ${attempt}/30"
  sleep 2
done

if [ "${INGRESS_OK}" != "true" ]; then
  echo "[FAIL] HTTPS Ingress did not answer through the ingress-nginx controller."
  echo "--- ingress port-forward log ---"
  cat "${INGRESS_PF_LOG}" || true
  echo "--- application ingress ---"
  kubectl -n "${NAMESPACE}" describe ingress api || true
  echo "--- ingress controller pods ---"
  kubectl -n ingress-nginx get pods -o wide || true
  exit 1
fi

echo "[OK] NGINX Ingress + TLS: HTTPS liveness HTTP 200."

kill "${INGRESS_PF_PID}" >/dev/null 2>&1 || true
wait "${INGRESS_PF_PID}" 2>/dev/null || true
INGRESS_PF_PID=""

echo "[INFO] Waiting for HPA metrics from metrics-server..."

METRICS_OK=false
for attempt in $(seq 1 24); do
  TARGETS="$(kubectl -n "${NAMESPACE}" get hpa api --no-headers 2>/dev/null | awk '{print $3}')"
  if [ -n "${TARGETS}" ] && [[ "${TARGETS}" != *"<unknown>"* ]]; then
    METRICS_OK=true
    echo "[OK] HPA metrics available: ${TARGETS}"
    break
  fi
  echo "[WAIT] HPA metrics: attempt ${attempt}/24"
  sleep 5
done

if [ "${METRICS_OK}" != "true" ]; then
  echo "[FAIL] HPA metrics are still unknown."
  kubectl -n "${NAMESPACE}" get hpa api || true
  kubectl top pods -n "${NAMESPACE}" || true
  kubectl -n kube-system get pods -l k8s-app=metrics-server -o wide || true
  exit 1
fi

kubectl -n "${NAMESPACE}" get pods,svc,ingress,hpa,pvc

echo "LOT 6 Kubernetes validation: PASS"
