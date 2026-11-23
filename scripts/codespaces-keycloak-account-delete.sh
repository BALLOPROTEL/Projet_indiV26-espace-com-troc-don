#!/usr/bin/env bash
set -euo pipefail

if [[ "${CODESPACES:-}" != "true" ]]; then
  echo "[FAIL] This helper is reserved for GitHub Codespaces."
  exit 1
fi

compose=(
  docker compose
  --env-file .codespaces/codespace.env
  -f compose.yaml
  -f .devcontainer/compose.codespaces.yml
)
kcadm=(
  "${compose[@]}"
  exec -T keycloak
  /opt/keycloak/bin/kcadm.sh
)

ready=false
for _ in {1..45}; do
  if "${kcadm[@]}" config credentials     --server http://127.0.0.1:8080     --realm master     --user admin     --password admin_local_change_me >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 2
done

if [[ "$ready" != "true" ]]; then
  echo "[FAIL] Keycloak Admin CLI did not become ready."
  exit 1
fi

"${kcadm[@]}" update   authentication/required-actions/delete_account   -r projet-indiv26   -s enabled=true >/dev/null

for username in demo-user demo-moderator demo-admin; do
  "${kcadm[@]}" add-roles     -r projet-indiv26     --uusername "$username"     --cclientid account     --rolename delete-account >/dev/null
done

echo "[OK] Keycloak self-service account deletion is enabled for demo actors."
