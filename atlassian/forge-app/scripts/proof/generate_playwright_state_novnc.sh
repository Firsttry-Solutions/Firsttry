#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'
umask 077

test -n "${JIRA_BASE_URL:-}"  || { echo "FAIL-CLOSED: JIRA_BASE_URL missing"; exit 1; }
test -n "${JIRA_EMAIL:-}"     || { echo "FAIL-CLOSED: JIRA_EMAIL missing"; exit 1; }
test -n "${JIRA_API_TOKEN:-}" || { echo "FAIL-CLOSED: JIRA_API_TOKEN missing"; exit 1; }

if [ "${FT_AUTH_GENERATE_STATE:-}" != "1" ]; then
  echo "FAIL-CLOSED: FT_AUTH_GENERATE_STATE must be 1 (explicit opt-in)"
  exit 1
fi

export FT_PLAYWRIGHT_MODE="headed"

bash scripts/proof/pw_auth_cleanup_guard.sh

# Run generator via NoVNC harness (must exist)
test -f scripts/proof/run_playwright_with_novnc.sh || { echo "FAIL-CLOSED: missing run_playwright_with_novnc.sh"; exit 1; }

# Delegate: NoVNC harness should open/forward UI so user can complete SSO.
exec bash scripts/proof/run_playwright_with_novnc.sh bash scripts/proof/generate_playwright_state.sh
