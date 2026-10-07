#!/usr/bin/env bash
set -euo pipefail

if [[ "${CODESPACES:-}" != "true" ]]; then
  echo "[FAIL] This command is reserved for GitHub Codespaces."
  exit 1
fi

node .devcontainer/prepare-codespaces.mjs
bash scripts/m6-compose-check.sh
