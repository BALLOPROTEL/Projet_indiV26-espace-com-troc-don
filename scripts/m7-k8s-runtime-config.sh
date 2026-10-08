#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NAMESPACE="projet-indiv26"
APP_HOST="app.projet-indiv26.local"
API_HOST="api.projet-indiv26.local"
AUTH_HOST="auth.projet-indiv26.local"
APP_PUBLIC_URL="https://${APP_HOST}"
API_PUBLIC_URL="https://${API_HOST}"
AUTH_PUBLIC_URL="https://${AUTH_HOST}"

for cmd in kubectl openssl base64 node; do
  command -v "${cmd}" >/dev/null 2>&1 || {
    echo "[FAIL] Missing command: ${cmd}"
    exit 1
  }
done

kubectl apply -f "${ROOT_DIR}/infra/k8s/minikube/namespace.yaml" >/dev/null

secret_value() {
  local secret_name="$1"
  local key="$2"
  kubectl -n "${NAMESPACE}" get secret "${secret_name}" \
    -o "jsonpath={.data.${key}}" 2>/dev/null | base64 -d
}

rand_hex() {
  openssl rand -hex "$1"
}

url_encode() {
  node -e 'process.stdout.write(encodeURIComponent(process.argv[1]))' "$1"
}

if kubectl -n "${NAMESPACE}" get secret postgres-credentials >/dev/null 2>&1; then
  POSTGRES_DB="$(secret_value postgres-credentials POSTGRES_DB)"
  POSTGRES_USER="$(secret_value postgres-credentials POSTGRES_USER)"
  POSTGRES_PASSWORD="$(secret_value postgres-credentials POSTGRES_PASSWORD)"
else
  POSTGRES_DB="projet_indiv26"
  POSTGRES_USER="app"
  POSTGRES_PASSWORD="$(rand_hex 16)"
fi

kubectl -n "${NAMESPACE}" create secret generic postgres-credentials \
  --from-literal=POSTGRES_DB="${POSTGRES_DB}" \
  --from-literal=POSTGRES_USER="${POSTGRES_USER}" \
  --from-literal=POSTGRES_PASSWORD="${POSTGRES_PASSWORD}" \
  --dry-run=client -o yaml | kubectl apply -f - >/dev/null

if kubectl -n "${NAMESPACE}" get secret rabbitmq-credentials >/dev/null 2>&1; then
  RABBITMQ_USER="$(secret_value rabbitmq-credentials RABBITMQ_DEFAULT_USER)"
  RABBITMQ_PASSWORD="$(secret_value rabbitmq-credentials RABBITMQ_DEFAULT_PASS)"
else
  RABBITMQ_USER="app"
  RABBITMQ_PASSWORD="$(rand_hex 18)"
fi

kubectl -n "${NAMESPACE}" create secret generic rabbitmq-credentials \
  --from-literal=RABBITMQ_DEFAULT_USER="${RABBITMQ_USER}" \
  --from-literal=RABBITMQ_DEFAULT_PASS="${RABBITMQ_PASSWORD}" \
  --dry-run=client -o yaml | kubectl apply -f - >/dev/null

if kubectl -n "${NAMESPACE}" get secret object-storage-credentials >/dev/null 2>&1; then
  MINIO_ROOT_USER="$(secret_value object-storage-credentials MINIO_ROOT_USER)"
  MINIO_ROOT_PASSWORD="$(secret_value object-storage-credentials MINIO_ROOT_PASSWORD)"
  S3_ACCESS_KEY="$(secret_value object-storage-credentials S3_ACCESS_KEY)"
  S3_SECRET_KEY="$(secret_value object-storage-credentials S3_SECRET_KEY)"
else
  MINIO_ROOT_USER="minio-root"
  MINIO_ROOT_PASSWORD="$(rand_hex 24)"
  S3_ACCESS_KEY="marketplace-api"
  S3_SECRET_KEY="$(rand_hex 24)"
fi

kubectl -n "${NAMESPACE}" create secret generic object-storage-credentials \
  --from-literal=MINIO_ROOT_USER="${MINIO_ROOT_USER}" \
  --from-literal=MINIO_ROOT_PASSWORD="${MINIO_ROOT_PASSWORD}" \
  --from-literal=S3_ACCESS_KEY="${S3_ACCESS_KEY}" \
  --from-literal=S3_SECRET_KEY="${S3_SECRET_KEY}" \
  --dry-run=client -o yaml | kubectl apply -f - >/dev/null

if kubectl -n "${NAMESPACE}" get secret keycloak-admin >/dev/null 2>&1; then
  KEYCLOAK_ADMIN_USER="$(secret_value keycloak-admin KC_BOOTSTRAP_ADMIN_USERNAME)"
  KEYCLOAK_ADMIN_PASSWORD="$(secret_value keycloak-admin KC_BOOTSTRAP_ADMIN_PASSWORD)"
else
  KEYCLOAK_ADMIN_USER="admin"
  KEYCLOAK_ADMIN_PASSWORD="$(rand_hex 20)"
fi

kubectl -n "${NAMESPACE}" create secret generic keycloak-admin \
  --from-literal=KC_BOOTSTRAP_ADMIN_USERNAME="${KEYCLOAK_ADMIN_USER}" \
  --from-literal=KC_BOOTSTRAP_ADMIN_PASSWORD="${KEYCLOAK_ADMIN_PASSWORD}" \
  --dry-run=client -o yaml | kubectl apply -f - >/dev/null

if kubectl -n "${NAMESPACE}" get secret catalog-secrets >/dev/null 2>&1; then
  INTERNAL_SERVICE_TOKEN="$(secret_value catalog-secrets INTERNAL_SERVICE_TOKEN)"
else
  INTERNAL_SERVICE_TOKEN="$(rand_hex 32)"
fi

if kubectl -n "${NAMESPACE}" get secret gateway-secrets >/dev/null 2>&1; then
  METRICS_TOKEN="$(secret_value gateway-secrets METRICS_TOKEN)"
else
  METRICS_TOKEN="$(rand_hex 32)"
fi

POSTGRES_USER_URL="$(url_encode "${POSTGRES_USER}")"
POSTGRES_PASSWORD_URL="$(url_encode "${POSTGRES_PASSWORD}")"
RABBITMQ_USER_URL="$(url_encode "${RABBITMQ_USER}")"
RABBITMQ_PASSWORD_URL="$(url_encode "${RABBITMQ_PASSWORD}")"

DATABASE_URL="postgresql://${POSTGRES_USER_URL}:${POSTGRES_PASSWORD_URL}@postgres:5432/${POSTGRES_DB}?schema=public"
CATALOG_DATABASE_URL="postgresql://${POSTGRES_USER_URL}:${POSTGRES_PASSWORD_URL}@postgres:5432/${POSTGRES_DB}?schema=catalog"
MARKETPLACE_DATABASE_URL="postgresql://${POSTGRES_USER_URL}:${POSTGRES_PASSWORD_URL}@postgres:5432/${POSTGRES_DB}?schema=marketplace"
RABBITMQ_URL="amqp://${RABBITMQ_USER_URL}:${RABBITMQ_PASSWORD_URL}@rabbitmq:5672"

kubectl -n "${NAMESPACE}" create secret generic legacy-api-secrets \
  --from-literal=DATABASE_URL="${DATABASE_URL}" \
  --from-literal=METRICS_TOKEN="${METRICS_TOKEN}" \
  --dry-run=client -o yaml | kubectl apply -f - >/dev/null

kubectl -n "${NAMESPACE}" create secret generic catalog-secrets \
  --from-literal=CATALOG_DATABASE_URL="${CATALOG_DATABASE_URL}" \
  --from-literal=INTERNAL_SERVICE_TOKEN="${INTERNAL_SERVICE_TOKEN}" \
  --dry-run=client -o yaml | kubectl apply -f - >/dev/null

kubectl -n "${NAMESPACE}" create secret generic marketplace-secrets \
  --from-literal=MARKETPLACE_DATABASE_URL="${MARKETPLACE_DATABASE_URL}" \
  --from-literal=INTERNAL_SERVICE_TOKEN="${INTERNAL_SERVICE_TOKEN}" \
  --from-literal=RABBITMQ_URL="${RABBITMQ_URL}" \
  --dry-run=client -o yaml | kubectl apply -f - >/dev/null

kubectl -n "${NAMESPACE}" create secret generic notification-secrets \
  --from-literal=RABBITMQ_URL="${RABBITMQ_URL}" \
  --dry-run=client -o yaml | kubectl apply -f - >/dev/null

kubectl -n "${NAMESPACE}" create secret generic gateway-secrets \
  --from-literal=METRICS_TOKEN="${METRICS_TOKEN}" \
  --dry-run=client -o yaml | kubectl apply -f - >/dev/null

realm_tmp="$(mktemp)"
tls_dir="$(mktemp -d)"
cleanup() {
  rm -f "${realm_tmp}"
  rm -rf "${tls_dir}"
}
trap cleanup EXIT

APP_PUBLIC_URL="${APP_PUBLIC_URL}" node - "${ROOT_DIR}/infra/keycloak/projet-indiv26-realm.json" "${realm_tmp}" <<'NODE'
const fs = require('node:fs');

const source = process.argv[2];
const destination = process.argv[3];
const webUrl = process.env.APP_PUBLIC_URL;
const realm = JSON.parse(fs.readFileSync(source, 'utf8'));
const web = realm.clients?.find((client) => client.clientId === 'web');

if (!web || !webUrl) {
  throw new Error('Missing Keycloak web client or APP_PUBLIC_URL');
}

web.rootUrl = webUrl;
web.baseUrl = webUrl;
web.redirectUris = [webUrl + '/*'];
web.webOrigins = [webUrl];
web.attributes = {
  ...(web.attributes ?? {}),
  'pkce.code.challenge.method': 'S256',
  'post.logout.redirect.uris': webUrl + '/*',
};

fs.writeFileSync(destination, JSON.stringify(realm, null, 2) + '\n');
NODE

kubectl -n "${NAMESPACE}" create configmap keycloak-realm \
  --from-file=realm.json="${realm_tmp}" \
  --dry-run=client -o yaml | kubectl apply -f - >/dev/null

openssl req -x509 -nodes -newkey rsa:2048 -days 7 \
  -keyout "${tls_dir}/tls.key" \
  -out "${tls_dir}/tls.crt" \
  -subj "/CN=${APP_HOST}" \
  -addext "subjectAltName=DNS:${APP_HOST},DNS:${API_HOST},DNS:${AUTH_HOST}" \
  >/dev/null 2>&1

kubectl -n "${NAMESPACE}" create secret tls platform-tls \
  --cert="${tls_dir}/tls.crt" \
  --key="${tls_dir}/tls.key" \
  --dry-run=client -o yaml | kubectl apply -f - >/dev/null

echo "[OK] M7 runtime Secrets, Keycloak realm and TLS material are ready."
echo "[INFO] App: ${APP_PUBLIC_URL}"
echo "[INFO] API: ${API_PUBLIC_URL}"
echo "[INFO] Auth: ${AUTH_PUBLIC_URL}"
