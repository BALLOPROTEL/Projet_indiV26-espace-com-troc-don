#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

[ "${JURY_ENVIRONMENT_CONFIRMED:-}" = "isolated" ] || {
  echo "[FAIL] Set JURY_ENVIRONMENT_CONFIRMED=isolated only for a verified disposable stack."
  exit 1
}
[ -n "${JURY_STACK_ENV_FILE:-}" ] && [ -f "$JURY_STACK_ENV_FILE" ] || {
  echo "[FAIL] JURY_STACK_ENV_FILE must point to the generated jury-stack.env."
  exit 1
}

read_env() {
  sed -n "s/^${1}=//p" "$JURY_STACK_ENV_FILE" | tail -n 1
}
project="$(read_env COMPOSE_PROJECT_NAME)"
realm_file="$(read_env KEYCLOAK_REALM_FILE)"
realm_gid="$(read_env JURY_REALM_GID)"

[[ "$project" =~ ^projet-indiv26-jury-[a-f0-9]{8}$ ]] || {
  echo "[FAIL] Invalid isolated Compose project name."
  exit 1
}
[ -f "$realm_file" ] || {
  echo "[FAIL] Disposable Keycloak realm file is missing."
  exit 1
}
[[ "$realm_gid" =~ ^[0-9]+$ ]] || {
  echo "[FAIL] Invalid realm group id."
  exit 1
}

root_real="$(realpath "$ROOT_DIR")"
realm_real="$(realpath "$realm_file")"
case "$realm_real" in
  "$root_real"|"$root_real"/*)
    echo "[FAIL] Refusing a credential-bearing realm file inside the repository."
    exit 1
    ;;
esac

actual_gid="$(stat -c '%g' "$realm_real")"
actual_mode="$(stat -c '%a' "$realm_real")"
[ "$actual_gid" = "$realm_gid" ] || {
  echo "[FAIL] Realm GID changed after preparation."
  exit 1
}
case "$actual_mode" in
  600|640) ;;
  *)
    echo "[FAIL] Realm permissions must be 0600 or 0640, never world-readable."
    exit 1
    ;;
esac

free_kb="$(df -Pk . | awk 'NR==2 {print $4}')"
if [ "$free_kb" -lt 4194304 ]; then
  echo "[FAIL] Less than 4 GiB free. Do not build a second stack until disk space is reviewed safely."
  exit 1
fi

echo "=== Isolated jury stack: $project ==="
df -h .
docker system df

compose=(
  docker compose
  --env-file "$JURY_STACK_ENV_FILE"
  --project-name "$project"
  -f compose.yaml
  -f demo/jury/compose.jury.yml
)

"${compose[@]}" up -d --build
echo
echo "[OK] Jury stack started without touching the current Codespace project or its volumes."
echo "Run: JURY_STACK_ENV_FILE='$JURY_STACK_ENV_FILE' JURY_ENVIRONMENT_CONFIRMED=isolated pnpm jury:stack:check"
