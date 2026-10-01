#!/usr/bin/env bash
set -euo pipefail

cleanup() {
  [[ -z "${api_pid:-}" ]] || kill "${api_pid}" >/dev/null 2>&1 || true
  [[ -z "${web_pid:-}" ]] || kill "${web_pid}" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

pnpm api:dev &
api_pid=$!

pnpm web:dev &
web_pid=$!

echo "[ProjetIndiv26] API and Web started."
echo "[ProjetIndiv26] Keep this terminal open. Ctrl+C stops both processes."

wait -n "${api_pid}" "${web_pid}"
