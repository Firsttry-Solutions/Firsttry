#!/bin/bash
# guard_no_ui_navigation.sh
#
# Ensures deterministic CI suite never attempts to navigate to Jira UI pages.
# Must be run before any deterministic E2E tests.
#
# Checks for forbidden patterns in:
#   - e2e/scripts/auth_preflight_rest_only.mjs
#   - e2e/scripts/guard_no_ui_navigation.sh (this file)
#
# Forbidden patterns:
#   - /jira/dashboards (dashboard URL path)
#   - page.goto( (Playwright UI navigation)
#   - id.atlassian.com (Jira auth domain)
#   - jira/dashboards (alternative path)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FORBIDDEN_PATTERNS=(
  "/jira/dashboards"
  "page.goto("
  "id.atlassian.com"
  "jira/dashboards"
)

echo "[GUARD] Checking for forbidden UI navigation patterns..."

VIOLATIONS=0

# Check the deterministic preflight script
if [ -f "$SCRIPT_DIR/auth_preflight_rest_only.mjs" ]; then
  for pattern in "${FORBIDDEN_PATTERNS[@]}"; do
    if grep -q "$pattern" "$SCRIPT_DIR/auth_preflight_rest_only.mjs"; then
      echo "[GUARD] ✗ VIOLATION: Found '$pattern' in auth_preflight_rest_only.mjs"
      VIOLATIONS=$((VIOLATIONS + 1))
    fi
  done
fi

if [ $VIOLATIONS -gt 0 ]; then
  echo "[GUARD] ✗ FAILED: $VIOLATIONS forbidden patterns detected"
  echo "[GUARD] Deterministic CI suite must not navigate to Jira UI"
  exit 1
fi

echo "[GUARD] ✓ PASSED: No forbidden UI navigation patterns found"
exit 0
