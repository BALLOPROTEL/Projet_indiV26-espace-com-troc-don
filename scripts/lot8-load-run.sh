#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NAMESPACE="projet-indiv26"
IMAGE="projet-indiv26-jmeter:lot8-local"
REPORT_ROOT="${LOT8_REPORT_ROOT:-${ROOT_DIR}/reports/load}"
RUN_ID="${LOT8_RUN_ID:-$(date +%Y%m%d-%H%M%S)}"
REPORT_DIR="${REPORT_ROOT}/${RUN_ID}"

BASELINE_THREADS="${LOT8_BASELINE_THREADS:-5}"
BASELINE_RAMP_SECONDS="${LOT8_BASELINE_RAMP_SECONDS:-5}"
BASELINE_DURATION_SECONDS="${LOT8_BASELINE_DURATION_SECONDS:-30}"

STRESS_THREADS="${LOT8_STRESS_THREADS:-80}"
STRESS_RAMP_SECONDS="${LOT8_STRESS_RAMP_SECONDS:-10}"
STRESS_DURATION_SECONDS="${LOT8_STRESS_DURATION_SECONDS:-120}"

KUBECTL_SHIM_DIR=""
MONITOR_PID=""
STOP_FILE=""
TEMP_JOB_FILE=""

cleanup() {
  if [ -n "${STOP_FILE}" ]; then
    touch "${STOP_FILE}" 2>/dev/null || true
  fi

  if [ -n "${MONITOR_PID}" ]; then
    kill "${MONITOR_PID}" >/dev/null 2>&1 || true
    wait "${MONITOR_PID}" 2>/dev/null || true
  fi

  [ -z "${TEMP_JOB_FILE}" ] || rm -f "${TEMP_JOB_FILE}"
  [ -z "${KUBECTL_SHIM_DIR}" ] || rm -rf "${KUBECTL_SHIM_DIR}"
}
trap cleanup EXIT INT TERM

for cmd in docker minikube python3; do
  command -v "${cmd}" >/dev/null 2>&1 || {
    echo "[FAIL] Missing command: ${cmd}"
    exit 1
  }
done

if ! command -v kubectl >/dev/null 2>&1; then
  KUBECTL_SHIM_DIR="$(mktemp -d)"
  cat > "${KUBECTL_SHIM_DIR}/kubectl" <<'EOF'
#!/usr/bin/env bash
exec minikube kubectl -- "$@"
EOF
  chmod +x "${KUBECTL_SHIM_DIR}/kubectl"
  export PATH="${KUBECTL_SHIM_DIR}:${PATH}"
  echo "[INFO] kubectl not found; using 'minikube kubectl --' fallback."
fi

cd "${ROOT_DIR}"
mkdir -p "${REPORT_DIR}"

echo "=== LOT 8 - JMeter / HPA experiment ==="
echo "[INFO] Reports: ${REPORT_DIR}"

minikube status >/dev/null 2>&1 || {
  echo "[FAIL] Minikube is not running. Run 'pnpm obs:up' first."
  exit 1
}

for deployment in api prometheus grafana; do
  kubectl -n "${NAMESPACE}" rollout status     "deployment/${deployment}" --timeout=120s
done

kubectl -n "${NAMESPACE}" get hpa api >/dev/null 2>&1 || {
  echo "[FAIL] HPA api is missing. Run 'pnpm obs:up' first."
  exit 1
}

echo "[INFO] Building dedicated JMeter image..."
docker build --pull   -f tests/load/Dockerfile.jmeter   -t "${IMAGE}"   .

echo "[INFO] Loading JMeter image into Minikube..."
minikube image load "${IMAGE}"

run_phase() {
  local phase="$1"
  local threads="$2"
  local ramp="$3"
  local duration="$4"
  local job="lot8-jmeter-${phase}"

  echo
  echo "=== ${phase}: threads=${threads}, ramp=${ramp}s, duration=${duration}s ==="

  kubectl -n "${NAMESPACE}" delete job "${job}"     --ignore-not-found=true >/dev/null

  TEMP_JOB_FILE="$(mktemp)"
  cat > "${TEMP_JOB_FILE}" <<EOF
apiVersion: batch/v1
kind: Job
metadata:
  name: ${job}
  namespace: ${NAMESPACE}
  labels:
    app.kubernetes.io/name: jmeter
    app.kubernetes.io/part-of: projet-indiv26
    projet-indiv26/experiment: lot8
    projet-indiv26/scenario: ${phase}
spec:
  backoffLimit: 0
  template:
    metadata:
      labels:
        app.kubernetes.io/name: jmeter
        projet-indiv26/experiment: lot8
        projet-indiv26/scenario: ${phase}
    spec:
      automountServiceAccountToken: false
      restartPolicy: Never
      securityContext:
        runAsNonRoot: true
        runAsUser: 10001
        runAsGroup: 10001
        fsGroup: 10001
        seccompProfile:
          type: RuntimeDefault
      containers:
        - name: jmeter
          image: ${IMAGE}
          imagePullPolicy: Never
          args:
            - -n
            - -t
            - /opt/load/plan.jmx
            - -Jhost=api.projet-indiv26.svc.cluster.local
            - -Jport=80
            - -Jprotocol=http
            - -Jpath=/api/listings
            - -Jthreads=${threads}
            - -Jramp_seconds=${ramp}
            - -Jduration_seconds=${duration}
            - -Jjmeter.save.saveservice.output_format=csv
            - -Jjmeter.save.saveservice.print_field_names=true
            - -Jjmeter.save.saveservice.autoflush=true
            - -l
            - /results/results.jtl
            - -j
            - /results/jmeter.log
          resources:
            requests:
              cpu: 200m
              memory: 256Mi
            limits:
              cpu: "1"
              memory: 768Mi
          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            capabilities:
              drop:
                - ALL
          volumeMounts:
            - name: results
              mountPath: /results
            - name: tmp
              mountPath: /tmp
      volumes:
        - name: results
          emptyDir: {}
        - name: tmp
          emptyDir: {}
EOF

  kubectl apply -f "${TEMP_JOB_FILE}" >/dev/null
  rm -f "${TEMP_JOB_FILE}"
  TEMP_JOB_FILE=""

  if ! kubectl -n "${NAMESPACE}" wait     --for=condition=complete "job/${job}"     --timeout="$((duration + 180))s"; then
    echo "[FAIL] JMeter job ${job} did not complete."
    kubectl -n "${NAMESPACE}" describe "job/${job}" || true
    kubectl -n "${NAMESPACE}" logs       -l "job-name=${job}" --tail=200 || true
    exit 1
  fi

  local pod
  pod="$(kubectl -n "${NAMESPACE}" get pods     -l "job-name=${job}"     -o jsonpath='{.items[0].metadata.name}')"

  kubectl -n "${NAMESPACE}" logs "${pod}"     > "${REPORT_DIR}/${phase}-console.log"

  kubectl -n "${NAMESPACE}" cp     "${pod}:/results/results.jtl"     "${REPORT_DIR}/${phase}-results.jtl"

  kubectl -n "${NAMESPACE}" cp     "${pod}:/results/jmeter.log"     "${REPORT_DIR}/${phase}-jmeter.log"

  python3 tests/load/summarize_jtl.py     "${REPORT_DIR}/${phase}-results.jtl"     --scenario "${phase}"     --output "${REPORT_DIR}/${phase}-summary.json"

  kubectl -n "${NAMESPACE}" delete job "${job}"     --ignore-not-found=true >/dev/null
}

record_hpa_snapshot() {
  local output="$1"
  {
    date --iso-8601=seconds
    kubectl -n "${NAMESPACE}" get hpa api -o wide
    kubectl -n "${NAMESPACE}" get deployment api
    kubectl -n "${NAMESPACE}" get pods       -l app.kubernetes.io/name=api -o wide
  } > "${output}"
}

wait_for_hpa_baseline() {
  echo "[INFO] Waiting for HPA to settle at one desired replica..."
  for attempt in $(seq 1 30); do
    local desired
    desired="$(kubectl -n "${NAMESPACE}" get hpa api       -o jsonpath='{.status.desiredReplicas}' 2>/dev/null || true)"
    if [ "${desired}" = "1" ]; then
      echo "[OK] HPA baseline: desired replicas=1."
      return 0
    fi
    echo "[WAIT] HPA desired replicas=${desired:-unknown} (${attempt}/30)"
    sleep 5
  done

  echo "[WARN] HPA did not return to one desired replica before stress."
}

start_hpa_monitor() {
  STOP_FILE="$(mktemp)"
  rm -f "${STOP_FILE}"

  echo "timestamp,current_replicas,desired_replicas,ready_replicas,cpu_current_percent,cpu_target_percent"     > "${REPORT_DIR}/hpa-history.csv"

  (
    while [ ! -f "${STOP_FILE}" ]; do
      timestamp="$(date --iso-8601=seconds)"
      current="$(kubectl -n "${NAMESPACE}" get hpa api         -o jsonpath='{.status.currentReplicas}' 2>/dev/null || true)"
      desired="$(kubectl -n "${NAMESPACE}" get hpa api         -o jsonpath='{.status.desiredReplicas}' 2>/dev/null || true)"
      ready="$(kubectl -n "${NAMESPACE}" get deployment api         -o jsonpath='{.status.readyReplicas}' 2>/dev/null || true)"
      cpu_current="$(kubectl -n "${NAMESPACE}" get hpa api         -o jsonpath='{.status.currentMetrics[0].resource.current.averageUtilization}'         2>/dev/null || true)"
      cpu_target="$(kubectl -n "${NAMESPACE}" get hpa api         -o jsonpath='{.spec.metrics[0].resource.target.averageUtilization}'         2>/dev/null || true)"

      echo "${timestamp},${current:-0},${desired:-0},${ready:-0},${cpu_current:-0},${cpu_target:-0}"         >> "${REPORT_DIR}/hpa-history.csv"
      sleep 5
    done
  ) &
  MONITOR_PID=$!
}

stop_hpa_monitor() {
  touch "${STOP_FILE}"
  wait "${MONITOR_PID}" 2>/dev/null || true
  MONITOR_PID=""
  rm -f "${STOP_FILE}"
  STOP_FILE=""
}

record_hpa_snapshot "${REPORT_DIR}/hpa-before.txt"

run_phase   baseline   "${BASELINE_THREADS}"   "${BASELINE_RAMP_SECONDS}"   "${BASELINE_DURATION_SECONDS}"

wait_for_hpa_baseline

start_hpa_monitor

run_phase   stress   "${STRESS_THREADS}"   "${STRESS_RAMP_SECONDS}"   "${STRESS_DURATION_SECONDS}"

echo "[INFO] Keeping HPA monitor active for 20 seconds after JMeter..."
sleep 20
stop_hpa_monitor

record_hpa_snapshot "${REPORT_DIR}/hpa-after.txt"

echo
echo "=== LOT 8 measured report ==="
if ! python3 tests/load/build_report.py "${REPORT_DIR}"; then
  echo
  echo "[FAIL] Stress completed but no HPA scale-up above one replica was observed."
  echo "Increase LOT8_STRESS_THREADS or LOT8_STRESS_DURATION_SECONDS and rerun."
  exit 1
fi

echo
echo "[OK] HPA scale-up observed."
echo "[OK] LOT 8 evidence stored in: ${REPORT_DIR}"
echo "LOT 8 load experiment: PASS"
