#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
K8S_DIR="${ROOT_DIR}/infra/k8s/minikube"
NAMESPACE="projet-indiv26"
MANIFEST_ONLY=false

RENDERED=""
API_PF_PID=""
PROM_PF_PID=""
GRAFANA_PF_PID=""
API_PF_LOG=""
PROM_PF_LOG=""
GRAFANA_PF_LOG=""

cleanup() {
  for pid in "${API_PF_PID}" "${PROM_PF_PID}" "${GRAFANA_PF_PID}"; do
    if [ -n "${pid}" ]; then
      kill "${pid}" >/dev/null 2>&1 || true
      wait "${pid}" 2>/dev/null || true
    fi
  done

  for file in "${RENDERED}" "${API_PF_LOG}" "${PROM_PF_LOG}" "${GRAFANA_PF_LOG}"; do
    [ -z "${file}" ] || rm -f "${file}"
  done
}
trap cleanup EXIT INT TERM

if [ "${1:-}" = "--manifest-only" ]; then
  MANIFEST_ONLY=true
fi

command -v kubectl >/dev/null 2>&1 || {
  echo "[FAIL] kubectl is required."
  exit 1
}

echo "=== LOT 7 - Observability validation ==="

RENDERED="$(mktemp)"
kubectl kustomize "${K8S_DIR}" > "${RENDERED}"

grep -q "name: prometheus" "${RENDERED}"
grep -q "name: grafana" "${RENDERED}"
grep -q "kind: RoleBinding" "${RENDERED}"
grep -q "metrics_path: /api/metrics" "${RENDERED}"
grep -q "LOT 7 — API Observabilité" "${RENDERED}"
grep -q "readOnlyRootFilesystem: true" "${RENDERED}"

echo "[OK] Prometheus, Grafana, RBAC and dashboard render through Kustomize."

if [ "${MANIFEST_ONLY}" = true ]; then
  echo "LOT 7 manifest validation: PASS"
  exit 0
fi

command -v curl >/dev/null 2>&1 || {
  echo "[FAIL] curl is required for live validation."
  exit 1
}

kubectl -n "${NAMESPACE}" rollout status deployment/api --timeout=120s
kubectl -n "${NAMESPACE}" rollout status deployment/prometheus --timeout=120s
kubectl -n "${NAMESPACE}" rollout status deployment/grafana --timeout=120s

API_PF_LOG="$(mktemp)"
kubectl -n "${NAMESPACE}" port-forward service/api 3002:80 >"${API_PF_LOG}" 2>&1 &
API_PF_PID=$!

API_OK=false
for attempt in $(seq 1 30); do
  if curl --connect-timeout 2 --max-time 5 -fsS     http://127.0.0.1:3002/api/health/live >/dev/null 2>&1; then
    API_OK=true
    break
  fi
  echo "[WAIT] API metrics endpoint: attempt ${attempt}/30"
  sleep 1
done

if [ "${API_OK}" != "true" ]; then
  echo "[FAIL] API port-forward did not become reachable."
  cat "${API_PF_LOG}" || true
  exit 1
fi

curl -fsS   -H "x-request-id: lot7-validation"   http://127.0.0.1:3002/api/health/live >/dev/null

METRICS="$(curl -fsS http://127.0.0.1:3002/api/metrics)"
printf '%s' "${METRICS}" | grep -q "projet_indiv26_http_requests_total"
printf '%s' "${METRICS}" | grep -q "projet_indiv26_http_request_duration_seconds_bucket"
printf '%s' "${METRICS}" | grep -q "projet_indiv26_process_resident_memory_bytes"

echo "[OK] API exposes HTTP, latency and process metrics."

LOG_OK=false
for attempt in $(seq 1 10); do
  if kubectl -n "${NAMESPACE}" logs     -l app.kubernetes.io/name=api     --tail=100 2>/dev/null |     grep -q '"request_id":"lot7-validation"'; then
    LOG_OK=true
    break
  fi
  sleep 1
done

if [ "${LOG_OK}" != "true" ]; then
  echo "[FAIL] Structured request log with correlation id was not found."
  exit 1
fi

echo "[OK] Structured logs include request_id correlation."

PROM_PF_LOG="$(mktemp)"
kubectl -n "${NAMESPACE}" port-forward service/prometheus 9090:9090 >"${PROM_PF_LOG}" 2>&1 &
PROM_PF_PID=$!

PROM_OK=false
for attempt in $(seq 1 30); do
  if curl --connect-timeout 2 --max-time 5 -fsS     http://127.0.0.1:9090/-/ready >/dev/null 2>&1; then
    PROM_OK=true
    break
  fi
  echo "[WAIT] Prometheus: attempt ${attempt}/30"
  sleep 1
done

if [ "${PROM_OK}" != "true" ]; then
  echo "[FAIL] Prometheus did not become ready."
  cat "${PROM_PF_LOG}" || true
  exit 1
fi

TARGETS_OK=false
for attempt in $(seq 1 30); do
  TARGETS="$(curl -fsS http://127.0.0.1:9090/api/v1/targets)"
  if printf '%s' "${TARGETS}" | grep -q '"job":"api-pods"' &&      printf '%s' "${TARGETS}" | grep -q '"health":"up"'; then
    TARGETS_OK=true
    break
  fi
  echo "[WAIT] Prometheus API target: attempt ${attempt}/30"
  sleep 2
done

if [ "${TARGETS_OK}" != "true" ]; then
  echo "[FAIL] Prometheus has no healthy api-pods target."
  exit 1
fi

echo "[OK] Prometheus discovers and scrapes the API pod."

GRAFANA_PF_LOG="$(mktemp)"
kubectl -n "${NAMESPACE}" port-forward service/grafana 3003:3000 >"${GRAFANA_PF_LOG}" 2>&1 &
GRAFANA_PF_PID=$!

GRAFANA_OK=false
for attempt in $(seq 1 30); do
  if curl --connect-timeout 2 --max-time 5 -fsS     http://127.0.0.1:3003/api/health >/dev/null 2>&1; then
    GRAFANA_OK=true
    break
  fi
  echo "[WAIT] Grafana: attempt ${attempt}/30"
  sleep 1
done

if [ "${GRAFANA_OK}" != "true" ]; then
  echo "[FAIL] Grafana did not become healthy."
  cat "${GRAFANA_PF_LOG}" || true
  exit 1
fi

DASHBOARDS="$(curl -fsS 'http://127.0.0.1:3003/api/search?query=LOT%207')"
printf '%s' "${DASHBOARDS}" | grep -q "LOT 7"

echo "[OK] Grafana is healthy and LOT 7 dashboard is provisioned."

kubectl -n "${NAMESPACE}" get pods,svc

echo "LOT 7 observability validation: PASS"
