#!/usr/bin/env bash
set -euo pipefail

compose=(
  docker compose
  --env-file .codespaces/codespace.env
  -f compose.yaml
  -f .devcontainer/compose.codespaces.yml
)

"${compose[@]}" down --remove-orphans
