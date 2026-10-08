#!/usr/bin/env bash
set -euo pipefail

# Run this helper INSIDE local WSL2, not in remote GitHub Codespaces.
# Keep it running while browsing from Windows. It preserves the fixed
# HTTPS hostnames/port used by Keycloak issuer, TLS, CORS and the Web app.
if ! grep -Eqi '(microsoft|wsl)' /proc/version /proc/sys/kernel/osrelease 2>/dev/null; then
  echo "[FAIL] This Windows-browser helper must run in local WSL2."
  echo "[INFO] Codespaces: use pnpm m7:k8s:validate for remote-cluster HTTPS checks."
  exit 1
fi

command -v kubectl >/dev/null 2>&1 || {
  echo "[FAIL] Missing kubectl."
  exit 1
}

if [ "$(kubectl config current-context)" != "minikube" ]; then
  echo "[FAIL] Expected kubectl context minikube."
  exit 1
fi

bind_address="${M7_WSL_BIND_ADDRESS:-127.0.0.1}"
case "${bind_address}" in
  127.0.0.1) ;;
  0.0.0.0)
    echo "[WARN] Binding to all WSL interfaces may expose the demo to other devices."
    echo "[INFO] Prefer the default 127.0.0.1 binding."
    ;;
  *)
    echo "[FAIL] M7_WSL_BIND_ADDRESS must be 127.0.0.1 or 0.0.0.0."
    exit 1
    ;;
esac

# On Linux configurations where ports below 1024 are restricted,
# use sudo with the user's KUBECONFIG as shown in the documentation.
unprivileged_start="$(cat /proc/sys/net/ipv4/ip_unprivileged_port_start)"
if [ "$(id -u)" -ne 0 ] && [ "${unprivileged_start}" -gt 443 ]; then
  echo "[FAIL] Binding HTTPS port 443 requires elevated privileges here."
  echo '[INFO] From WSL, run: sudo env KUBECONFIG="$HOME/.kube/config" bash scripts/m7-wsl-browser-access.sh'
  exit 1
fi

kubectl --context minikube -n ingress-nginx rollout status   deployment/ingress-nginx-controller --timeout=180s

echo "[INFO] Set these entries in the WINDOWS hosts file (as Administrator):"
echo "127.0.0.1 app.projet-indiv26.test api.projet-indiv26.test auth.projet-indiv26.test"
echo "[INFO] Do NOT map these Windows names to the Minikube Docker node IP."
echo "[INFO] Keep this terminal running during Windows browser testing."
echo "[INFO] HTTPS ingress is forwarded at 443 (no port suffix, matching Keycloak issuer)."
echo "[INFO] The demo certificate is self-signed; trust it locally only if appropriate."
echo "[INFO] Press Ctrl+C to stop the tunnel."

exec kubectl --context minikube -n ingress-nginx port-forward   --address "${bind_address}"   service/ingress-nginx-controller 443:443
