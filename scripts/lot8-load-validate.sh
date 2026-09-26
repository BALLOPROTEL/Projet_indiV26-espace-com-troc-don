#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "${ROOT_DIR}"

for cmd in bash python3; do
  command -v "${cmd}" >/dev/null 2>&1 || {
    echo "[FAIL] Missing command: ${cmd}"
    exit 1
  }
done

echo "=== LOT 8 - static load-test validation ==="

for file in   tests/load/lot8-api-hpa.jmx   tests/load/Dockerfile.jmeter   tests/load/summarize_jtl.py   tests/load/build_report.py   tests/load/keycloak-experimentation.md   scripts/lot8-load-run.sh   docs/13-lot8-performance.md; do
  test -f "${file}" || {
    echo "[FAIL] Missing LOT 8 artifact: ${file}"
    exit 1
  }
done

bash -n scripts/lot8-load-run.sh
python3 -m py_compile   tests/load/summarize_jtl.py   tests/load/build_report.py

python3 - <<'PY'
from pathlib import Path
import xml.etree.ElementTree as ET

path = Path("tests/load/lot8-api-hpa.jmx")
root = ET.parse(path).getroot()

if root.tag != "jmeterTestPlan":
    raise SystemExit("[FAIL] Root element is not jmeterTestPlan.")

content = path.read_text(encoding="utf-8")
required = [
    "__P(host,api.projet-indiv26.svc.cluster.local)",
    "__P(path,/api/listings)",
    "__P(threads,5)",
    "__P(ramp_seconds,5)",
    "__P(duration_seconds,30)",
    "HTTP 200 expected",
]
for marker in required:
    if marker not in content:
        raise SystemExit(f"[FAIL] Missing JMeter marker: {marker}")

print("[OK] JMeter XML parses and required parameters are present.")
PY

grep -q 'ARG JMETER_VERSION=5.6.3' tests/load/Dockerfile.jmeter
grep -q 'USER 10001:10001' tests/load/Dockerfile.jmeter
grep -q 'minReplicas: 1' infra/k8s/minikube/api-hpa.yaml
grep -q 'maxReplicas: 4' infra/k8s/minikube/api-hpa.yaml
grep -q 'averageUtilization: 60' infra/k8s/minikube/api-hpa.yaml
grep -q '^reports/load/$' .gitignore

echo "[OK] JMeter image, HPA target, scripts and report ignore rules validated."
echo "LOT 8 static validation: PASS"
