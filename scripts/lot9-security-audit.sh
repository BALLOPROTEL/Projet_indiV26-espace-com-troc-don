#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATIC_ONLY=false
KUBECTL_SHIM_DIR=""
RENDERED=""

cleanup() {
  [ -z "${RENDERED}" ] || rm -f "${RENDERED}"
  [ -z "${KUBECTL_SHIM_DIR}" ] || rm -rf "${KUBECTL_SHIM_DIR}"
}
trap cleanup EXIT INT TERM

if [ "${1:-}" = "--static" ]; then
  STATIC_ONLY=true
fi

cd "${ROOT_DIR}"

for cmd in git python3; do
  command -v "${cmd}" >/dev/null 2>&1 || {
    echo "[FAIL] Missing command: ${cmd}"
    exit 1
  }
done

if ! command -v kubectl >/dev/null 2>&1; then
  if command -v minikube >/dev/null 2>&1; then
    KUBECTL_SHIM_DIR="$(mktemp -d)"
    cat > "${KUBECTL_SHIM_DIR}/kubectl" <<'EOF'
#!/usr/bin/env bash
exec minikube kubectl -- "$@"
EOF
    chmod +x "${KUBECTL_SHIM_DIR}/kubectl"
    export PATH="${KUBECTL_SHIM_DIR}:${PATH}"
    echo "[INFO] kubectl not found; using 'minikube kubectl --' fallback."
  else
    echo "[FAIL] kubectl or minikube is required."
    exit 1
  fi
fi

echo "=== LOT 9 - final security audit ==="

echo "[CHECK] No tracked dotenv secrets"
if git ls-files | grep -E '(^|/)\.env($|\.)' | grep -v '\.env\.example$'; then
  echo "[FAIL] Tracked dotenv file detected."
  exit 1
fi

echo "[CHECK] No tracked private keys or common live-token patterns"
if git grep -nE   -e '-----BEGIN ([A-Z0-9 ]+ )?PRIVATE KEY-----|AKIA[0-9A-Z]{16}|github_pat_[A-Za-z0-9_]{20,}|ghp_[A-Za-z0-9]{20,}'   -- .   ':!docs/14-lot9-security-audit.md'   ':!scripts/lot9-security-audit.sh'; then
  echo "[FAIL] Potential tracked secret material detected."
  exit 1
fi

echo "[CHECK] Kubernetes Secret manifests are examples only"
while IFS= read -r file; do
  case "${file}" in
    *.example.yaml) ;;
    *)
      echo "[FAIL] Tracked non-example Kubernetes secret manifest: ${file}"
      exit 1
      ;;
  esac
done < <(git ls-files 'infra/k8s/minikube/*secret*.yaml')

echo "[CHECK] Keycloak security model"
python3 - <<'PY'
import json
from pathlib import Path

realm = json.loads(
    Path("infra/keycloak/projet-indiv26-realm.json").read_text(
        encoding="utf-8"
    )
)

assert realm["registrationAllowed"] is False
assert realm["bruteForceProtected"] is True
assert realm["failureFactor"] == 5

clients = {client["clientId"]: client for client in realm["clients"]}

api = clients["api"]
assert api["bearerOnly"] is True
assert api["directAccessGrantsEnabled"] is False
assert api["serviceAccountsEnabled"] is False

web = clients["web"]
assert web["publicClient"] is True
assert web["standardFlowEnabled"] is True
assert web["directAccessGrantsEnabled"] is False
assert web["attributes"]["pkce.code.challenge.method"] == "S256"

cli = clients["cli"]
assert cli["directAccessGrantsEnabled"] is True
assert "smoke-test" in cli["name"]

roles = {role["name"] for role in realm["roles"]["realm"]}
assert {"USER", "MODERATOR", "ADMIN"}.issubset(roles)

print(
    "[OK] Keycloak app clients hardened; "
    "Direct Grant remains isolated to local smoke client."
)
PY

echo "[CHECK] GitHub Actions are pinned to immutable SHAs"
python3 - <<'PY'
import re
from pathlib import Path

workflow = Path(".github/workflows/bootstrap-ci.yml").read_text(
    encoding="utf-8"
)
uses = re.findall(
    r"^\s*uses:\s*([^\s#]+)",
    workflow,
    flags=re.MULTILINE,
)

if not uses:
    raise SystemExit("[FAIL] No GitHub Actions references found.")

bad = []
for ref in uses:
    if ref.startswith("./"):
        continue
    if "@" not in ref:
        bad.append(ref)
        continue
    _, version = ref.rsplit("@", 1)
    if not re.fullmatch(r"[0-9a-f]{40}", version):
        bad.append(ref)

if bad:
    raise SystemExit(
        "[FAIL] Non-immutable GitHub Action refs: "
        + ", ".join(bad)
    )

print(
    f"[OK] {len(uses)} action references use immutable commit SHAs."
)
PY

echo "[CHECK] API / Web hardening controls"
grep -q "X-Content-Type-Options"   apps/api/src/security-headers.middleware.ts
grep -q "X-Frame-Options"   apps/api/src/security-headers.middleware.ts
grep -q "X-Powered-By"   apps/api/src/security-headers.middleware.ts
grep -q "Content-Security-Policy"   apps/web/next.config.ts
grep -q "Permissions-Policy"   apps/web/next.config.ts
grep -q "SWAGGER_ENABLED" apps/api/src/main.ts
grep -q 'SWAGGER_ENABLED: "false"'   infra/k8s/minikube/api-configmap.yaml
grep -q "Valid metrics bearer token is required"   apps/api/src/observability/metrics-access.service.ts

echo "[CHECK] Kubernetes hardening / network exposure"
RENDERED="$(mktemp)"
kubectl kustomize infra/k8s/minikube > "${RENDERED}"

grep -q 'secretName: api-tls'   infra/k8s/minikube/api-ingress.yaml
grep -q 'ssl-redirect: "true"'   infra/k8s/minikube/api-ingress.yaml

for service in api postgres prometheus grafana minio; do
  grep -q 'type: ClusterIP'     "infra/k8s/minikube/${service}-service.yaml"
done

grep -q 'automountServiceAccountToken: false'   infra/k8s/minikube/api-deployment.yaml
grep -q 'runAsNonRoot: true'   infra/k8s/minikube/api-deployment.yaml
grep -q 'readOnlyRootFilesystem: true'   infra/k8s/minikube/api-deployment.yaml
grep -q 'allowPrivilegeEscalation: false'   infra/k8s/minikube/api-deployment.yaml
grep -q 'drop:' infra/k8s/minikube/api-deployment.yaml
grep -q 'ALL' infra/k8s/minikube/api-deployment.yaml

grep -q   'credentials_file: /etc/prometheus/secrets/metrics-token'   infra/k8s/minikube/prometheus-configmap.yaml
grep -q 'key: METRICS_TOKEN'   infra/k8s/minikube/prometheus-deployment.yaml
grep -q 'name: S3_ACCESS_KEY' infra/k8s/minikube/api-deployment.yaml
grep -q 'name: S3_SECRET_KEY' infra/k8s/minikube/api-deployment.yaml

if grep -q 'MINIO_ROOT_' infra/k8s/minikube/api-deployment.yaml; then
  echo "[FAIL] API deployment must not receive MinIO root credentials."
  exit 1
fi

python3 - <<'PY'
import json
from pathlib import Path

policy = json.loads(
    Path("infra/minio/listing-images-policy.json").read_text(
        encoding="utf-8"
    )
)
serialized = json.dumps(policy)

assert "s3:GetObject" in serialized
assert "s3:PutObject" in serialized
assert "s3:DeleteObject" in serialized
assert "s3:ListBucket" in serialized
assert "s3:*" not in serialized
assert "arn:aws:s3:::listing-images" in serialized
print("[OK] Object-storage app policy is bucket-scoped and non-admin.")
PY

INGRESS_COUNT="$(
  grep -Rl '^kind: Ingress$' infra/k8s/minikube     | wc -l     | tr -d ' '
)"
if [ "${INGRESS_COUNT}" != "1" ]; then
  echo "[FAIL] Expected exactly one Ingress (API), found ${INGRESS_COUNT}."
  exit 1
fi

echo "[CHECK] Prometheus RBAC remains namespace-scoped"
python3 - <<'PY'
from pathlib import Path

rbac = Path(
    "infra/k8s/minikube/prometheus-rbac.yaml"
).read_text(encoding="utf-8")

assert "kind: Role\n" in rbac
assert "kind: ClusterRole\n" not in rbac
assert "kind: RoleBinding\n" in rbac
assert "kind: ClusterRoleBinding\n" not in rbac

for verb in ("get", "list", "watch"):
    assert f"- {verb}" in rbac

print("[OK] Prometheus uses namespace-scoped pod discovery RBAC.")
PY

echo "[CHECK] CI keeps dependency and image vulnerability gates"
grep -q "pnpm audit --prod --json"   .github/workflows/bootstrap-ci.yml
grep -q "vulnerabilities.high"   .github/workflows/bootstrap-ci.yml
grep -q "vulnerabilities.critical"   .github/workflows/bootstrap-ci.yml
grep -q "Trivy HIGH/CRITICAL gate"   .github/workflows/bootstrap-ci.yml
grep -q "severity: HIGH,CRITICAL"   .github/workflows/bootstrap-ci.yml

echo "[OK] LOT 9 static security controls: PASS"

if [ "${STATIC_ONLY}" = true ]; then
  exit 0
fi

command -v pnpm >/dev/null 2>&1 || {
  echo "[FAIL] pnpm is required for full audit."
  exit 1
}

echo
echo "=== LOT 9 - quality and dependency gates ==="
pnpm api:quality
pnpm web:quality
pnpm api:audit:prod
pnpm obs:validate:manifests
pnpm storage:validate:manifests
pnpm load:validate

echo
echo "LOT 9 final security audit: PASS"
