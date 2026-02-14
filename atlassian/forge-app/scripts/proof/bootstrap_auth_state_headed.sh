#!/bin/bash
# bootstrap_auth_state_headed.sh
# Purpose: Generate tests/playwright/.auth/state.json via headed/manual login.
# Useful for SSO tenants where headless automation is blocked by bot-guard/MFA.
# Requires: JIRA_BASE_URL, JIRA_DASHBOARD_URL, and manual login completion.

set -euo pipefail

# ============================================================================
# Configuration
# ============================================================================
JIRA_BASE_URL="${JIRA_BASE_URL:-}"
JIRA_DASHBOARD_URL="${JIRA_DASHBOARD_URL:-}"
FT_PLAYWRIGHT_MODE="headed"  # Force headed mode for manual login
JIRA_EMAIL=""  # Empty: SSO often blocks automation; human completes login
JIRA_PASSWORD=""
FT_BOOTSTRAP_TIMEOUT_SECONDS="${FT_BOOTSTRAP_TIMEOUT_SECONDS:-900}"  # 15 min default

# ============================================================================
# Validate preconditions
# ============================================================================
if [ -z "$JIRA_BASE_URL" ]; then
  echo "[ERROR] JIRA_BASE_URL is not set. Exiting." >&2
  exit 1
fi

if [ -z "$JIRA_DASHBOARD_URL" ]; then
  echo "[ERROR] JIRA_DASHBOARD_URL is not set. Exiting." >&2
  exit 1
fi

# ============================================================================
# Create runner-owned bootstrap output directory
# ============================================================================
BOOT_DIR="/tmp/pw_state_bootstrap_$(date -u +"%Y-%m-%dT%H%M%SZ")"
mkdir -p "$BOOT_DIR"
echo "[BOOTSTRAP] Output directory: $BOOT_DIR"

# ============================================================================
# Export environment for auth setup
# ============================================================================
export JIRA_BASE_URL
export JIRA_DASHBOARD_URL
export FT_PLAYWRIGHT_MODE
export JIRA_EMAIL
export JIRA_PASSWORD
export OUT_DIR="$BOOT_DIR"

# ============================================================================
# Run auth setup (headed mode, manual login)
# ============================================================================
echo "[BOOTSTRAP] Starting headed auth setup (please complete login manually in browser)..."
echo "[BOOTSTRAP] Command: timeout ${FT_BOOTSTRAP_TIMEOUT_SECONDS}s npx playwright test --project setup"

# Run auth setup with timeout and capture output
BOOTSTRAP_EXIT=0
(
  cd "$(dirname "$0")/../.."  # Navigate to forge-app root
  timeout "${FT_BOOTSTRAP_TIMEOUT_SECONDS}s" npx playwright test --project setup 2>&1 || true
) | tee -a "$BOOT_DIR/bootstrap.stdout.log" 2> >(tee -a "$BOOT_DIR/bootstrap.stderr.log" >&2) || BOOTSTRAP_EXIT=$?

# Normalize timeout exit codes
if [ "$BOOTSTRAP_EXIT" -eq 124 ] || [ "$BOOTSTRAP_EXIT" -eq 137 ] || [ "$BOOTSTRAP_EXIT" -eq 143 ]; then
  BOOTSTRAP_EXIT=124
fi

echo "[BOOTSTRAP] Auth setup exited with code: $BOOTSTRAP_EXIT"

# ============================================================================
# Validate state.json
# ============================================================================
STATE_FILE="tests/playwright/.auth/state.json"
RESULT="OK"
REASON_CODE="STATE_BOOTSTRAP_OK"
STATE_BYTES=0

if [ $BOOTSTRAP_EXIT -eq 124 ]; then
  RESULT="FAIL"
  REASON_CODE="STATE_BOOTSTRAP_TIMEOUT"
  echo "[BOOTSTRAP] ERROR: Bootstrap timed out after ${FT_BOOTSTRAP_TIMEOUT_SECONDS}s" >&2
elif [ ! -f "$STATE_FILE" ]; then
  RESULT="FAIL"
  REASON_CODE="STATE_FILE_MISSING"
  echo "[BOOTSTRAP] ERROR: State file not created at $STATE_FILE" >&2
else
  STATE_BYTES=$(stat -f%z "$STATE_FILE" 2>/dev/null || stat -c%s "$STATE_FILE" 2>/dev/null)
  
  if [ "$STATE_BYTES" -lt 200 ]; then
    RESULT="FAIL"
    REASON_CODE="STATE_FILE_TOO_SMALL"
    echo "[BOOTSTRAP] ERROR: State file too small ($STATE_BYTES bytes, need >= 200)" >&2
  else
    # Validate JSON and check for cookies/origins
    if node -e "const fs = require('fs'); JSON.parse(fs.readFileSync('$STATE_FILE', 'utf-8'))" 2>/dev/null; then
      if node -e "
        const fs = require('fs');
        const s = JSON.parse(fs.readFileSync('$STATE_FILE', 'utf-8'));
        const ok = (Array.isArray(s.cookies) && s.cookies.length > 0) || (Array.isArray(s.origins) && s.origins.length > 0);
        if (!ok) process.exit(2);
      " 2>/dev/null; then
        RESULT="OK"
        REASON_CODE="STATE_BOOTSTRAP_OK"
        echo "[BOOTSTRAP] ✓ State file validated: $STATE_BYTES bytes, has cookies/origins"
      else
        RESULT="FAIL"
        REASON_CODE="STATE_FILE_EMPTY_SECTIONS"
        echo "[BOOTSTRAP] ERROR: State file missing cookies/origins sections" >&2
      fi
    else
      RESULT="FAIL"
      REASON_CODE="STATE_FILE_INVALID"
      echo "[BOOTSTRAP] ERROR: State file is not valid JSON" >&2
    fi
  fi
fi

# ============================================================================
# Write deterministic evidence JSON (no timestamps inside)
# ============================================================================
EVIDENCE_FILE="$BOOT_DIR/bootstrap-result.json"
node -e "
const fs = require('fs');
const evidence = {
  result: '$RESULT',
  reasonCode: '$REASON_CODE',
  statePath: '$STATE_FILE',
  stateBytes: $STATE_BYTES
};
fs.writeFileSync('$EVIDENCE_FILE', JSON.stringify(evidence, Object.keys(evidence).sort(), 2) + '\n');
" 2>/dev/null || true

echo "[BOOTSTRAP] Evidence written to $EVIDENCE_FILE"
cat "$EVIDENCE_FILE"

# ============================================================================
# Exit with appropriate code
# ============================================================================
if [ "$RESULT" = "OK" ]; then
  echo "[BOOTSTRAP] ✓ Bootstrap successful"
  echo "[BOOTSTRAP] State file ready at: $STATE_FILE"
  exit 0
elif [ "$BOOTSTRAP_EXIT" -eq 124 ]; then
  echo "[BOOTSTRAP] ✗ Bootstrap failed: timeout" >&2
  exit 124
else
  echo "[BOOTSTRAP] ✗ Bootstrap failed: $REASON_CODE" >&2
  exit 1
fi
