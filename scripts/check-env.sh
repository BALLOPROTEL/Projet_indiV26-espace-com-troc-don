#!/usr/bin/env bash
set -u

echo "=== Projet_individuel26 / LOT 0 - WSL/Linux environment check ==="
echo

failed=0

check_cmd() {
  local name="$1"
  local cmd="$2"
  shift 2

  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "[MISSING] $name"
    failed=$((failed + 1))
    return
  fi

  echo "[OK] $name"
  "$cmd" "$@" 2>&1 | head -n 3 | sed 's/^/     /'
}

echo "=== Platform ==="
uname -a | sed 's/^/     /'
if grep -qi microsoft /proc/version 2>/dev/null; then
  echo "[OK] WSL detected"
else
  echo "[INFO] Linux detected; WSL marker not found"
fi

if [ -f /etc/os-release ]; then
  . /etc/os-release
  echo "[INFO] Distribution: ${PRETTY_NAME:-unknown}"
fi

echo
echo "=== Tooling ==="
check_cmd "Git" git --version
check_cmd "Node.js" node --version
check_cmd "Corepack" corepack --version
check_cmd "pnpm" pnpm --version
check_cmd "Docker CLI" docker --version
check_cmd "kubectl" kubectl version --client
check_cmd "Minikube" minikube version
check_cmd "Java" java -version
check_cmd "JMeter" jmeter -v

echo
echo "=== Runtime checks ==="

if command -v docker >/dev/null 2>&1; then
  if docker info >/dev/null 2>&1; then
    echo "[OK] Docker daemon reachable from WSL"
  else
    echo "[WARN] Docker CLI is installed but the daemon is not reachable from WSL"
    echo "       If using Docker Desktop, verify WSL Integration."
  fi
fi

if command -v kubectl >/dev/null 2>&1; then
  if kubectl get nodes >/tmp/projet_indiv26_nodes 2>&1; then
    echo "[OK] Kubernetes context reachable"
    sed 's/^/     /' /tmp/projet_indiv26_nodes
  else
    echo "[INFO] kubectl installed; no reachable cluster yet"
  fi
  rm -f /tmp/projet_indiv26_nodes
fi

echo
if [ "$failed" -eq 0 ]; then
  echo "Tooling check: PASS"
  exit 0
else
  echo "Tooling check: INCOMPLETE - $failed tool(s) missing"
  exit 1
fi
