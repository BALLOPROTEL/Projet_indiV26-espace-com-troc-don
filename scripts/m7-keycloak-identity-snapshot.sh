#!/usr/bin/env bash
set -euo pipefail

# One-time transition from the old ephemeral Keycloak dev H2 database to the
# persistent PostgreSQL database. Preserve existing demo-account user IDs
# before the original Keycloak pod is replaced. Abort on unknown users.
NAMESPACE="projet-indiv26"
SNAPSHOT_SECRET="keycloak-user-ids"

if kubectl -n "${NAMESPACE}" get secret "${SNAPSHOT_SECRET}" >/dev/null 2>&1; then
  echo "[OK] Existing Keycloak user-ID snapshot retained."
  exit 0
fi

if ! kubectl -n "${NAMESPACE}" get deployment/keycloak >/dev/null 2>&1; then
  echo "[INFO] Fresh cluster: fixed demo-user IDs from the realm import will be used."
  exit 0
fi

echo "[INFO] Capturing existing demo-user IDs before Keycloak DB migration..."
tmp_log="$(mktemp)"
pf_pid=""
cleanup() {
  [ -z "${pf_pid}" ] || { kill "${pf_pid}" >/dev/null 2>&1 || true; wait "${pf_pid}" 2>/dev/null || true; }
  rm -f "${tmp_log}"
}
trap cleanup EXIT INT TERM

kubectl -n "${NAMESPACE}" rollout status deployment/keycloak --timeout=120s
kubectl -n "${NAMESPACE}" port-forward service/keycloak 18086:8080 >"${tmp_log}" 2>&1 &
pf_pid=$!

admin_user="$(kubectl -n "${NAMESPACE}" get secret keycloak-admin -o jsonpath='{.data.KC_BOOTSTRAP_ADMIN_USERNAME}' | base64 -d)"
admin_password="$(kubectl -n "${NAMESPACE}" get secret keycloak-admin -o jsonpath='{.data.KC_BOOTSTRAP_ADMIN_PASSWORD}' | base64 -d)"

if ! user_ids_json="$(KEYCLOAK_ADMIN_USER="${admin_user}" KEYCLOAK_ADMIN_PASSWORD="${admin_password}" node <<'NODE'
const { setTimeout: delay } = require('node:timers/promises');
const origin = 'http://127.0.0.1:18086';
const expected = ['demo-user', 'demo-moderator', 'demo-admin'];
(async () => {
  let token;
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      const body = new URLSearchParams({
        grant_type: 'password',
        client_id: 'admin-cli',
        username: process.env.KEYCLOAK_ADMIN_USER,
        password: process.env.KEYCLOAK_ADMIN_PASSWORD,
      });
      const response = await fetch(origin + '/realms/master/protocol/openid-connect/token', {
        method: 'POST',
        headers: { host: 'auth.projet-indiv26.test' },
        body,
        signal: AbortSignal.timeout(4000),
      });
      if (response.status === 400 || response.status === 401 || response.status === 403) {
        throw new Error('Keycloak admin authentication refused (' + response.status + ')');
      }
      if (!response.ok) throw new Error('Keycloak token endpoint: ' + response.status);
      token = (await response.json()).access_token;
      if (!token) throw new Error('Missing admin access token');
      break;
    } catch (error) {
      if (/authentication refused/.test(error.message)) throw error;
      if (attempt === 29) throw error;
      await delay(1000);
    }
  }

  const response = await fetch(origin + '/admin/realms/projet-indiv26/users?max=1000', {
    headers: { authorization: 'Bearer ' + token, host: 'auth.projet-indiv26.test' },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error('Cannot list existing Keycloak users: HTTP ' + response.status);
  const users = await response.json();
  if (!Array.isArray(users)) throw new Error('Invalid Keycloak user list');
  if (users.some(user => !expected.includes(user.username))) {
    throw new Error('Non-demo Keycloak accounts exist: manual database migration required.');
  }
  const ids = {};
  for (const username of expected) {
    const user = users.find(user => user.username === username);
    if (!user?.id || !/^[a-f0-9-]{36}$/i.test(user.id)) {
      throw new Error('Cannot preserve current user ID for ' + username);
    }
    ids[username] = user.id;
  }
  process.stdout.write(JSON.stringify(ids));
})().catch(error => { console.error('[FAIL] ' + error.message); process.exit(1); });
NODE
)"; then
  echo "[FAIL] Keycloak identity snapshot failed. Existing identity storage was NOT replaced."
  exit 1
fi

kubectl -n "${NAMESPACE}" create secret generic "${SNAPSHOT_SECRET}" \
  --from-literal=KEYCLOAK_USER_IDS_JSON="${user_ids_json}" \
  --dry-run=client -o yaml | kubectl apply -f - >/dev/null

echo "[OK] Existing demo-account subject IDs preserved in the cluster secret."
