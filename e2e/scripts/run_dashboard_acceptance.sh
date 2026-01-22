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
echo "DASHBOARD ACCEPTANCE TEST: SMART STORAGE-FIRST PIPELINE"
echo "================================================================================"
echo "RUN_DIR: $RUN_DIR"
echo ""

# ============================================================================
# STEP 0: PRECONDITION CHECK
# ============================================================================
echo "[STEP 0] Validating preconditions..."

if [ -z "${JIRA_DASHBOARD_URL:-}" ]; then
  echo "  ❌ JIRA_DASHBOARD_URL not set"
  echo "[PRECONDITION_FAIL]"
  exit 1
fi

echo "  ✅ JIRA_DASHBOARD_URL set: $JIRA_DASHBOARD_URL"

# Setup environment
export JIRA_DASHBOARD_URL
export FT_RUN_DIR="$RUN_DIR"

AUTH_DIR="./e2e/.auth"
STORAGE_STATE="${STORAGE_STATE:-$AUTH_DIR/storageState.persistent.json}"
PROFILE_DIR="$AUTH_DIR/pw_profile"

echo "  ✅ STORAGE_STATE: $STORAGE_STATE"

mkdir -p "$AUTH_DIR"
echo ""

# ============================================================================
# STEP 1: Check if existing storageState is valid (storage-first strategy)
# ============================================================================
echo "[STEP 1] Checking for existing valid storageState..."
echo ""

STORAGE_EXISTS=0
if [ -f "$STORAGE_STATE" ]; then
  STORAGE_EXISTS=1
  size=$(wc -c < "$STORAGE_STATE")
  echo "  ✅ StorageState exists: $size bytes"
  ls -lah "$STORAGE_STATE" | tee "$RUN_DIR/00_storage_ls.txt"
else
  echo "  ℹ️  StorageState not found, will attempt auth if needed"
fi

echo ""

# ============================================================================
# STEP 2: Validate existing storageState (if present)
# ============================================================================
if [ $STORAGE_EXISTS -eq 1 ]; then
  echo "[STEP 2] Validating existing storageState for UI navigation..."
  echo ""
  
  if node e2e/scripts/validate_storage_state_ui.mjs 2>&1 | tee "$RUN_DIR/10_validate_existing.log"; then
    echo ""
    echo "  ✅ STORAGESTATE_UI_OK: Existing session is still valid"
    echo "[AUTH_SKIPPED_STORAGESTATE_VALID]"
    AUTH_NEEDED=0
  else
    echo ""
    echo "  ℹ️  Existing storageState expired or invalid"
    echo "[AUTH_REQUIRED_STORAGESTATE_INVALID]"
    AUTH_NEEDED=1
  fi
else
  echo "[STEP 2] Skipping validation (no existing storageState)"
  echo "[AUTH_REQUIRED_STORAGESTATE_INVALID]"
  AUTH_NEEDED=1
fi

echo ""

# ============================================================================
# STEP 3: Perform auth only if needed
# ============================================================================
if [ $AUTH_NEEDED -eq 1 ]; then
  echo "[STEP 3] Real Jira UI session required (headed browser with SSO/MFA)..."
  echo ""
  
  # Check for interactive environment
  if [ -z "${DISPLAY:-}" ]; then
    echo "  ❌ Environment not interactive (DISPLAY empty)"
    echo "  Cannot complete interactive SSO login in this environment."
    echo "  Please:"
    echo "    1. Run this on a machine with a GUI display"
    echo "    2. Execute: npm run dashboard:auth"
    echo "    3. Copy the storageState to: $STORAGE_STATE"
    echo "    4. Re-run: npm run dashboard:playwright"
    echo ""
    echo "[AUTH_ENV_NOT_INTERACTIVE]"
    exit 1
  fi
  
  echo "  DISPLAY is set ($DISPLAY), attempting interactive auth..."
  echo "  Please log in with your Jira credentials when the browser opens."
  echo ""
  
  # Clean old artifacts before auth attempt
  if [ -d "$PROFILE_DIR" ]; then
    echo "  Removing old profile: $PROFILE_DIR"
    rm -rf "$PROFILE_DIR"
  fi
  
  if [ -f "$STORAGE_STATE" ]; then
    echo "  Removing invalid storageState: $STORAGE_STATE"
    rm -f "$STORAGE_STATE"
  fi
  
  # Run auth
  if xvfb-run -a node e2e/scripts/auth_login_persistent.mjs 2>&1 | tee "$RUN_DIR/11_auth_new.log"; then
    echo ""
    echo "  ✅ PERSISTENT_AUTH_OK: Real Jira session established"
  else
    echo ""
    echo "  ❌ PERSISTENT_AUTH_FAIL: Could not establish Jira session"
    echo ""
    echo "See details in: $RUN_DIR/11_auth_new.log"
    tail -50 "$RUN_DIR/11_auth_new.log" || true
    exit 1
  fi
  
  echo ""
  
  # Verify storage file created
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
  echo ""
else
  echo "[STEP 3] Skipping auth (existing storageState is valid)"
  echo ""
fi

# ============================================================================
# STEP 4: Final validation of storageState before tests
# ============================================================================
echo "[STEP 4] Final validation of storageState for UI navigation..."
echo ""

# ============================================================================
# STEP 4: Final validation of storageState before tests
# ============================================================================
echo "[STEP 4] Final validation of storageState for UI navigation..."
echo ""

if node e2e/scripts/validate_storage_state_ui.mjs 2>&1 | tee "$RUN_DIR/12_validate_final.log"; then
  echo ""
  echo "  ✅ STORAGESTATE_UI_OK: Ready for test execution"
else
  echo ""
  echo "  ❌ STORAGESTATE_UI_FAIL: Cannot proceed with tests"
  echo ""
  echo "See details in: $RUN_DIR/12_validate_final.log"
  tail -50 "$RUN_DIR/12_validate_final.log" || true
  exit 1
fi

echo ""

# ============================================================================
# STEP 5: Run Playwright Dashboard Acceptance Test
# ============================================================================
echo "[STEP 5] Running Playwright dashboard acceptance tests..."
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
# STEP 6: Collect Artifacts
# ============================================================================
echo "[STEP 6] Collecting test artifacts..."

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

# Copy auth artifacts if they exist
if [ -f "e2e/.auth/auth_fail.png" ]; then
  echo "  Copying auth failure screenshot..."
  cp -v e2e/.auth/auth_fail.png "$RUN_DIR/" 2>/dev/null || true
fi

if [ -f "e2e/.auth/validate_fail.png" ]; then
  echo "  Copying validate failure screenshot..."
  cp -v e2e/.auth/validate_fail.png "$RUN_DIR/" 2>/dev/null || true
fi

if [ -f "$STORAGE_STATE" ]; then
  echo "  Copying storageState..."
  cp -v "$STORAGE_STATE" "$RUN_DIR/storageState.persistent.json" 2>/dev/null || true
fi

# Create artifact tree listing
echo "  Creating artifact tree listing..."
ls -R "$RUN_DIR" > "$RUN_DIR/90_artifact_tree.txt" 2>&1 || true

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
echo "  - 10_validate_existing.log     (Existing storageState validation)"
echo "  - 11_auth_new.log              (Real Jira UI auth, if performed)"
echo "  - 12_validate_final.log        (Final storageState validation)"
echo "  - 20_test.log                  (Playwright test execution)"
echo "  - 90_artifact_tree.txt         (Complete artifact listing)"
echo ""
echo "Markers:"
echo "  [AUTH_SKIPPED_STORAGESTATE_VALID]  (existing session reused)"
echo "  [AUTH_REQUIRED_STORAGESTATE_INVALID] (new session needed)"
echo "  [AUTH_ENV_NOT_INTERACTIVE]         (DISPLAY empty, cannot auth)"
echo "  [PERSISTENT_AUTH_OK]               (auth succeeded)"
echo "  [PERSISTENT_AUTH_FAIL]             (auth failed)"
echo "  [STORAGESTATE_UI_OK]               (session valid for UI)"
echo "  [STORAGESTATE_UI_FAIL]             (session invalid for UI)"
echo ""
echo "[DASHBOARD_ACCEPTANCE_OK]"
echo ""

exit 0
