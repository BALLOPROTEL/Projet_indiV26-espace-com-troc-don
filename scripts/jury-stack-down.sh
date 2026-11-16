#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

[ "${JURY_ENVIRONMENT_CONFIRMED:-}" = "isolated" ] || {
  echo "[FAIL] Isolated jury environment confirmation required."
  exit 1
}
[ -n "${JURY_STACK_ENV_FILE:-}" ] && [ -f "$JURY_STACK_ENV_FILE" ] || {
  echo "[FAIL] Missing JURY_STACK_ENV_FILE."
  exit 1
}
project="$(sed -n 's/^COMPOSE_PROJECT_NAME=//p' "$JURY_STACK_ENV_FILE" | tail -n 1)"
[[ "$project" =~ ^projet-indiv26-jury-[a-f0-9]{8}$ ]] || {
  echo "[FAIL] Refusing to stop a non-jury Compose project."
  exit 1
}

docker compose   --env-file "$JURY_STACK_ENV_FILE"   --project-name "$project"   -f compose.yaml   -f demo/jury/compose.jury.yml   down --remove-orphans

echo "[OK] Jury containers/network stopped. Volumes were intentionally preserved; no -v/prune was used."
