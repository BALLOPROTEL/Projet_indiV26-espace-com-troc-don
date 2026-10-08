#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

echo "=== LOT 7 - Observability deployment on M7 ==="

# Deploy the complete M7 stack, including Gateway credentials,
# Prometheus, Grafana and Metrics Server.
M7_SKIP_OBSERVABILITY=false bash scripts/m7-minikube-up.sh

# Validate the real Gateway metrics endpoint, Prometheus
# discovery and Grafana dashboard.
bash scripts/lot7-observability-validate.sh

echo "[OK] LOT 7 observability deployment: PASS"
