#!/bin/bash
#
# E2E: Run Dashboard Acceptance Test with Evidence Collection
#
# Coordinates: persistent auth login, Playwright test run, and artifact collection.
# Exits: 0 (all pass), 1 (any failure)
#

set -euo pipefail

# Use provided RUN_DIR or create new one
if [ -z "${FT_RUN_DIR:-}" ]; then
  RUN_DIR="/tmp/ft_pw_dashboard_acceptance_$(date -u +%Y%m%dT%H%M%SZ)"
else
  RUN_DIR="$FT_RUN_DIR"
fi

mkdir -p "$RUN_DIR"
cd /workspaces/Firsttry

echo "================================================================================"
echo "DASHBOARD ACCEPTANCE TEST"
echo "================================================================================"
echo "RUN_DIR: $RUN_DIR"
echo ""

# Setup environment
export JIRA_DASHBOARD_URL="${JIRA_DASHBOARD_URL:-https://firsttry.atlassian.net/jira/dashboards/10102}"
export FT_RUN_DIR="$RUN_DIR"

AUTH_DIR="./e2e/.auth"
STORAGE_STATE="$AUTH_DIR/storageState.persistent.json"
PROFILE_DIR="$AUTH_DIR/pw_profile"

mkdir -p "$AUTH_DIR"

# ============================================================================
# STEP 1: Persistent Login (if storage doesn't exist)
# ============================================================================
if [ ! -f "$STORAGE_STATE" ]; then
  echo "[STEP 1] Establishing persistent Jira session..."
  echo "  Note: Browser window will open. Please log in manually if needed."
  echo ""

  if xvfb-run -a node e2e/scripts/auth_login_persistent.mjs 2>&1 | tee "$RUN_DIR/20_auth_persistent.log"; then
    echo "  ✅ Persistent auth successful"
  else
    echo "  ❌ Persistent auth failed"
    echo "See: $RUN_DIR/20_auth_persistent.log"
    exit 1
  fi
  echo ""

  # Verify storage file
  if [ ! -f "$STORAGE_STATE" ]; then
    echo "  ❌ Storage file not created: $STORAGE_STATE"
    exit 1
  fi

  local_size=$(wc -c < "$STORAGE_STATE")
  if [ "$local_size" -lt 100 ]; then
    echo "  ❌ Storage file too small ($local_size bytes, expected >= 100)"
    exit 1
  fi

  echo "  ✅ Storage verified: $local_size bytes"
  ls -lah "$STORAGE_STATE" | tee "$RUN_DIR/21_storage_ls.txt"
else
  echo "[STEP 1] Using existing persistent session:"
  ls -lah "$STORAGE_STATE" | tee "$RUN_DIR/21_storage_ls_existing.txt"
fi

echo ""

# ============================================================================
# STEP 2: Run Playwright Dashboard Acceptance Test
# ============================================================================
echo "[STEP 2] Running Playwright dashboard acceptance test..."
echo ""

export STORAGE_STATE
export JIRA_DASHBOARD_URL
export FT_RUN_DIR

if npx playwright test e2e/tests/dashboard_acceptance_full.spec.ts \
  --reporter=line 2>&1 | tee "$RUN_DIR/30_pw_run.log"; then
  
  echo ""
  echo "  ✅ All Playwright tests passed"
else
  echo ""
  echo "  ❌ Playwright test failed"
  echo "See: $RUN_DIR/30_pw_run.log"
  
  # Print last 100 lines of log for debugging
  echo ""
  echo "[DEBUG] Last 100 lines of Playwright log:"
  tail -100 "$RUN_DIR/30_pw_run.log" || true
  
  exit 1
fi

echo ""

# ============================================================================
# STEP 3: Collect Artifacts
# ============================================================================
echo "[STEP 3] Collecting artifacts..."

if [ -d "$RUN_DIR/playwright" ]; then
  echo "  Copying traces, screenshots, etc..."
  cp -r "$RUN_DIR/playwright"/* "$RUN_DIR/" 2>/dev/null || true
  echo "  ✅ Artifacts collected"
fi

echo ""

# ============================================================================
# FINAL: Report
# ============================================================================
echo "================================================================================"
echo "✅ DASHBOARD ACCEPTANCE TEST PASSED"
echo "================================================================================"
echo ""
echo "Evidence saved to: $RUN_DIR"
echo ""
echo "Contents:"
ls -lah "$RUN_DIR" | grep -v '^d' | tail -20
echo ""
echo "Key artifacts:"
echo "  - 20_auth_persistent.log      (auth session establishment)"
echo "  - 30_pw_run.log               (Playwright test output)"
echo "  - 10_normal_mode.png          (screenshot: normal mode)"
echo "  - 11_debug_mode.png           (screenshot: debug mode)"
echo "  - 12_after_refresh.png        (screenshot: after refresh)"
echo ""
echo "[DASHBOARD_ACCEPTANCE_OK]"
echo ""

exit 0
