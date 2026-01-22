#!/bin/bash
#
# E2E: Run Dashboard Acceptance Test with Real Jira UI Auth
#
# Coordinates:
# 1. Real browser login (launchPersistentContext + user SSO/MFA)
# 2. Validate storageState works for UI navigation (not just REST)
# 3. Run Playwright tests with fail-fast redirect detection
# 4. Collect artifacts and evidence
#
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
echo "DASHBOARD ACCEPTANCE TEST: REAL JIRA UI AUTH"
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
# STEP 1: Persistent Login (Real Jira UI Session)
# ============================================================================
echo "[STEP 1] Establishing REAL Jira UI session (headed browser with SSO/MFA)..."
echo ""

# Always create fresh session (don't reuse old profile)
if [ -d "$PROFILE_DIR" ]; then
  echo "  Removing old profile: $PROFILE_DIR"
  rm -rf "$PROFILE_DIR"
fi

if [ -f "$STORAGE_STATE" ]; then
  echo "  Removing old storageState: $STORAGE_STATE"
  rm -f "$STORAGE_STATE"
fi

echo "  Running auth under Xvfb (visible display for user to interact)..."
echo "  Please log in with your Jira credentials when the browser opens."
echo ""

if xvfb-run -a node e2e/scripts/auth_login_persistent.mjs 2>&1 | tee "$RUN_DIR/10_auth.log"; then
  echo ""
  echo "  ✅ PERSISTENT_AUTH_OK: Real Jira session established"
else
  echo ""
  echo "  ❌ PERSISTENT_AUTH_FAIL: Could not establish Jira session"
  echo ""
  echo "See details in: $RUN_DIR/10_auth.log"
  tail -50 "$RUN_DIR/10_auth.log" || true
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

echo "  ✅ StorageState verified: $local_size bytes"
ls -lah "$STORAGE_STATE" | tee "$RUN_DIR/10a_storage_ls.txt"
echo ""

# ============================================================================
# STEP 2: Validate StorageState is Usable for UI Navigation
# ============================================================================
echo "[STEP 2] PROOF: Validating storageState can navigate Jira dashboard (no auth redirect)..."
echo ""

if node e2e/scripts/validate_storage_state_ui.mjs 2>&1 | tee "$RUN_DIR/11_validate.log"; then
  echo ""
  echo "  ✅ STORAGESTATE_UI_OK: StorageState is valid for UI navigation"
else
  echo ""
  echo "  ❌ STORAGESTATE_UI_FAIL: StorageState cannot navigate without auth redirect"
  echo ""
  echo "See details in: $RUN_DIR/11_validate.log"
  tail -50 "$RUN_DIR/11_validate.log" || true
  exit 1
fi

echo ""

# ============================================================================
# STEP 3: Run Playwright Dashboard Acceptance Test
# ============================================================================
echo "[STEP 3] Running Playwright dashboard acceptance tests..."
echo "  (Tests will fail fast if they encounter id.atlassian.com redirects)"
echo ""

export STORAGE_STATE
export JIRA_DASHBOARD_URL
export FT_RUN_DIR

if npx playwright test e2e/tests/dashboard_acceptance_full.spec.ts \
  --reporter=line 2>&1 | tee "$RUN_DIR/20_test.log"; then
  
  echo ""
  echo "  ✅ All Playwright tests PASSED"
else
  echo ""
  echo "  ❌ Playwright tests FAILED"
  echo ""
  echo "See details in: $RUN_DIR/20_test.log"
  
  # Print last 150 lines of log for debugging
  echo ""
  echo "[DEBUG] Last 150 lines of test log:"
  tail -150 "$RUN_DIR/20_test.log" || true
  
  exit 1
fi

echo ""

# ============================================================================
# STEP 4: Collect Artifacts
# ============================================================================
echo "[STEP 4] Collecting test artifacts..."

# Copy playwright test results
if [ -d "test-results" ]; then
  echo "  Copying Playwright test results..."
  cp -r test-results/* "$RUN_DIR/" 2>/dev/null || true
fi

# Copy playwright report traces
if [ -d "playwright-report" ]; then
  echo "  Copying Playwright report..."
  cp -r playwright-report/* "$RUN_DIR/" 2>/dev/null || true
fi

echo "  ✅ Artifacts collected"
echo ""

# ============================================================================
# FINAL: Report Success
# ============================================================================
echo "================================================================================"
echo "✅ DASHBOARD ACCEPTANCE TEST COMPLETE"
echo "================================================================================"
echo ""
echo "Evidence saved to: $RUN_DIR"
echo ""
echo "Key artifacts:"
echo "  - 10_auth.log          (Real Jira UI auth session establishment)"
echo "  - 11_validate.log      (StorageState UI validation proof)"
echo "  - 20_test.log          (Playwright test execution)"
echo "  - auth_success.png     (Auth success screenshot)"
echo "  - validate_ok.png      (Validation proof screenshot)"
echo ""
echo "Markers:"
echo "  [PERSISTENT_AUTH_OK]"
echo "  [STORAGESTATE_UI_OK]"
echo "  Tests PASSED"
echo ""
echo "[DASHBOARD_ACCEPTANCE_OK]"
echo ""

exit 0
