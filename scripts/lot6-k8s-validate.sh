#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
K8S_DIR="${ROOT_DIR}/infra/k8s/minikube"
NAMESPACE="projet-indiv26"
MANIFEST_ONLY=false

if [ "${1:-}" = "--manifest-only" ]; then
  MANIFEST_ONLY=true
fi

command -v kubectl >/dev/null 2>&1 || {
  echo "[FAIL] kubectl is required."
  exit 1
}

echo "=== LOT 6 - Kubernetes validation ==="

RENDERED="$(mktemp)"
trap 'rm -f "${RENDERED}"' EXIT

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

for cmd in minikube curl; do
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

PF_LOG="$(mktemp)"
kubectl -n "${NAMESPACE}" port-forward service/api 3002:80 >"${PF_LOG}" 2>&1 &
PF_PID=$!

cleanup() {
  kill "${PF_PID}" >/dev/null 2>&1 || true
  wait "${PF_PID}" 2>/dev/null || true
  rm -f "${PF_LOG}"
}
trap cleanup EXIT

for _ in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:3002/api/health/live >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

curl -fsS http://127.0.0.1:3002/api/health/live >/dev/null
curl -fsS http://127.0.0.1:3002/api/health/ready >/dev/null

echo "[OK] Service API: liveness HTTP 200 and readiness HTTP 200."

MINIKUBE_IP="$(minikube ip)"

INGRESS_OK=false
for _ in $(seq 1 30); do
  if curl -kfsS \
    --resolve "api.projet-indiv26.local:443:${MINIKUBE_IP}" \
    "https://api.projet-indiv26.local/api/health/live" >/dev/null 2>&1; then
    INGRESS_OK=true
    break
  fi
  sleep 2
done

if [ "${INGRESS_OK}" != "true" ]; then
  echo "[FAIL] HTTPS Ingress did not answer within the expected window."
  kubectl -n "${NAMESPACE}" describe ingress api || true
  exit 1
fi

echo "[OK] NGINX Ingress + TLS: HTTPS liveness HTTP 200."

METRICS_OK=false
for _ in $(seq 1 24); do
  TARGETS="$(kubectl -n "${NAMESPACE}" get hpa api --no-headers 2>/dev/null | awk '{print $3}')"
  if [ -n "${TARGETS}" ] && [[ "${TARGETS}" != *"<unknown>"* ]]; then
    METRICS_OK=true
    break
  fi
  sleep 5
done

if [ "${METRICS_OK}" != "true" ]; then
  echo "[FAIL] HPA metrics are still unknown."
  kubectl -n "${NAMESPACE}" get hpa api
  exit 1
fi

kubectl -n "${NAMESPACE}" get pods,svc,ingress,hpa,pvc

echo "LOT 6 Kubernetes validation: PASS"
