#!/usr/bin/env bash
set -euo pipefail

repo="${GITHUB_REPOSITORY:-BALLOPROTEL/Projet_indiV26-espace-com-troc-don}"
branch="${MAIN_BRANCH:-main}"
mode="${1:---audit}"

if ! command -v gh >/dev/null 2>&1; then
  echo "gh CLI is required." >&2
  exit 2
fi

if [[ -z "${GH_TOKEN:-}" ]]; then
  echo "Set GH_TOKEN to a repository-admin token with Administration read/write permission." >&2
  exit 2
fi

required_checks=(
  "Validate repository structure"
  "Contract compatibility M8"
  "M9 Web lint typecheck unit build"
)

protection_url="repos/$repo/branches/$branch/protection"

audit() {
  echo "== Protection audit: $repo:$branch =="
  gh api "$protection_url"     --jq '{
      required_status_checks: .required_status_checks.contexts,
      strict: .required_status_checks.strict,
      enforce_admins: .enforce_admins.enabled,
      pull_request_reviews: (.required_pull_request_reviews != null),
      required_conversation_resolution: .required_conversation_resolution.enabled,
      allow_force_pushes: .allow_force_pushes.enabled,
      allow_deletions: .allow_deletions.enabled
    }'

  for context in "${required_checks[@]}"; do
    gh api "$protection_url" --jq '.required_status_checks.contexts[]' |
      grep -Fxq "$context" || {
        echo "Missing required check: $context" >&2
        return 1
      }
  done
}

apply() {
  local payload
  payload="$(mktemp)"
  trap 'rm -f "$payload"' EXIT
  cat >"$payload" <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "Validate repository structure",
      "Contract compatibility M8",
      "M9 Web lint typecheck unit build"
    ]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "required_approving_review_count": 0,
    "require_last_push_approval": false
  },
  "restrictions": null,
  "required_linear_history": false,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false,
  "required_conversation_resolution": true,
  "lock_branch": false,
  "allow_fork_syncing": true
}
JSON

  gh api     --method PUT     -H "Accept: application/vnd.github+json"     "$protection_url"     --input "$payload" >/dev/null

  echo "Protection applied."
  audit
}

case "$mode" in
  --audit) audit ;;
  --apply) apply ;;
  *)
    echo "Usage: $0 [--audit|--apply]" >&2
    exit 2
    ;;
esac
