#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
K8S_DIR="${ROOT_DIR}/infra/k8s/minikube"
NAMESPACE="projet-indiv26"

cd "${ROOT_DIR}"

echo "=== LOT 7 - Observability deployment ==="

bash scripts/lot6-minikube-up.sh

echo "[INFO] Restarting API so the freshly built instrumented image is used..."
kubectl -n "${NAMESPACE}" rollout restart deployment/api
kubectl -n "${NAMESPACE}" rollout status deployment/api --timeout=180s

echo "[INFO] Deploying Prometheus RBAC and configuration..."
kubectl apply -f "${K8S_DIR}/prometheus-rbac.yaml"
kubectl apply -f "${K8S_DIR}/prometheus-configmap.yaml"
kubectl apply -f "${K8S_DIR}/prometheus-deployment.yaml"
kubectl apply -f "${K8S_DIR}/prometheus-service.yaml"

echo "[INFO] Deploying Grafana provisioning and dashboard..."
kubectl apply -f "${K8S_DIR}/grafana-configmap.yaml"
kubectl apply -f "${K8S_DIR}/grafana-deployment.yaml"
kubectl apply -f "${K8S_DIR}/grafana-service.yaml"

kubectl -n "${NAMESPACE}" rollout status deployment/prometheus --timeout=180s
kubectl -n "${NAMESPACE}" rollout status deployment/grafana --timeout=180s

echo
kubectl -n "${NAMESPACE}" get pods,svc,hpa

echo
echo "LOT 7 observability deployment: PASS"
echo "Next: pnpm obs:validate"
