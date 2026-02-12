#!/usr/bin/env bash
set -euo pipefail

# Playwright Dashboard Phase1 Diagnostics Test Runner

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../" && pwd)"

# Validate environment
if [[ -z "${JIRA_BASE_URL:-}" ]]; then
  echo "[PW_DIAG] ERROR: JIRA_BASE_URL not set"
  exit 1
fi

if [[ "${JIRA_BASE_URL}" != "https://firsttry.atlassian.net" ]]; then
  echo "[PW_DIAG] ERROR: JIRA_BASE_URL must be 'https://firsttry.atlassian.net', got '${JIRA_BASE_URL}'"
  exit 1
fi

if [[ -z "${JIRA_DASHBOARD_URL:-}" ]]; then
  echo "[PW_DIAG] ERROR: JIRA_DASHBOARD_URL not set"
  exit 1
fi

DASHBOARD_PREFIX="https://firsttry.atlassian.net/jira/dashboards/"
if [[ ! "${JIRA_DASHBOARD_URL}" =~ ^${DASHBOARD_PREFIX} ]]; then
  echo "[PW_DIAG] ERROR: JIRA_DASHBOARD_URL must start with '${DASHBOARD_PREFIX}', got '${JIRA_DASHBOARD_URL}'"
  exit 1
fi

cd "${REPO_ROOT}"
export JIRA_BASE_URL
export JIRA_DASHBOARD_URL

echo "[PW_DIAG] Running Playwright diagnostics test..."

npx playwright test tests/playwright/dashboard-phase1-diagnostics.spec.ts --headed

EXIT_CODE=$?

if [[ $EXIT_CODE -eq 0 ]]; then
  echo "[PW_DIAG] ✅ PASS"
else
  echo "[PW_DIAG] ❌ FAIL (exit code: $EXIT_CODE)"
  # Print latest output directory
  LATEST_OUT="$(ls -td /tmp/pw_dash_diag_* 2>/dev/null | head -1)"
  if [[ -n "${LATEST_OUT:-}" ]]; then
    echo "[PW_DIAG] LATEST_OUT_DIR=${LATEST_OUT}"
  fi
fi

exit $EXIT_CODE
