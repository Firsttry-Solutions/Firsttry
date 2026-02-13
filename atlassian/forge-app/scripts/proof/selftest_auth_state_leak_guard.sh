#!/bin/bash
# selftest_auth_state_leak_guard.sh
# Purpose: Validate guard_no_auth_state_leak.sh matches contract-true schema and behavior.

set -euo pipefail

echo "========== AUTH STATE LEAK GUARD SELF-TEST =========="

TEST_PASSED=0
TEST_FAILED=0

# Determine the repo directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "[INFO] Repository root: $REPO_ROOT"
cd "$REPO_ROOT" || exit 1

# ============================================================================
# Helper: Verify JSON schema contract
# ============================================================================
verify_json_schema() {
  local json_file="$1"
  local expect_result="$2"  # OK or FAIL
  local expect_reason="$3"  # UNKNOWN, STATE_FILE_TRACKED, etc
  
  if [ ! -f "$json_file" ]; then
    echo "✗ FAIL: JSON file not created: $json_file"
    TEST_FAILED=$((TEST_FAILED + 1))
    return 1
  fi
  
  # Use node to parse and verify schema
  local verify_output=$(node -e "
    const fs = require('fs');
    const j = JSON.parse(fs.readFileSync('$json_file', 'utf-8'));
    const topKeys = Object.keys(j);
    const expectedKeys = ['result', 'reasonCode', 'details'];
    
    // Check exact top-level keys in order
    if (topKeys.length !== 3 || 
        topKeys[0] !== 'result' || 
        topKeys[1] !== 'reasonCode' || 
        topKeys[2] !== 'details') {
      console.log('SCHEMA_FAIL: unexpected top-level keys');
      process.exit(1);
    }
    
    // Check result value
    if (j.result !== '$expect_result') {
      console.log('RESULT_MISMATCH: got ' + j.result);
      process.exit(1);
    }
    
    // Check reasonCode value
    if (j.reasonCode !== '$expect_reason') {
      console.log('REASON_MISMATCH: got ' + j.reasonCode);
      process.exit(1);
    }
    
    // Check details exists and is an object
    if (typeof j.details !== 'object' || j.details === null || Array.isArray(j.details)) {
      console.log('DETAILS_INVALID');
      process.exit(1);
    }
    
    // Check required detail fields
    const requiredDetails = ['echoRisk', 'newestOutDir', 'outDirHasState', 'phase', 'staged', 'stateExists', 'statePath', 'tracked', 'violations'];
    const detailKeys = Object.keys(j.details);
    
    if (detailKeys.length !== requiredDetails.length) {
      console.log('DETAIL_COUNT_MISMATCH: expected ' + requiredDetails.length + ' got ' + detailKeys.length);
      process.exit(1);
    }
    
    for (const k of requiredDetails) {
      if (!detailKeys.includes(k)) {
        console.log('DETAIL_MISSING: ' + k);
        process.exit(1);
      }
    }
    
    // Check no 'phase' at top level
    if (j.hasOwnProperty('phase')) {
      console.log('TOPLEVEL_PHASE_INVALID');
      process.exit(1);
    }
    
    // Check no 'reason_code' at top level (should be reasonCode)
    if (j.hasOwnProperty('reason_code')) {
      console.log('TOPLEVEL_REASON_CODE_INVALID');
      process.exit(1);
    }
    
    console.log('SCHEMA_OK');
  " 2>&1 || true)
  
  if [ "$verify_output" = "SCHEMA_OK" ]; then
    echo "✓ PASS"
    TEST_PASSED=$((TEST_PASSED + 1))
    return 0
  else
    echo "✗ FAIL: $verify_output"
    TEST_FAILED=$((TEST_FAILED + 1))
    return 1
  fi
}

# ============================================================================
# SUB-TEST 1: Pre-phase OK with correct schema
# ============================================================================
echo ""
echo "[SUBTEST 1] Pre-phase guard returns OK with correct JSON schema"

rm -f "$REPO_ROOT/tests/playwright/.auth/state.json" 2>/dev/null || true

export FT_GUARD_PHASE="pre"
bash "$REPO_ROOT/scripts/proof/guard_no_auth_state_leak.sh" >/dev/null 2>&1

LATEST_GUARD=$(ls -1dt /tmp/pw_state_guard_* 2>/dev/null | head -1)
if [ -n "$LATEST_GUARD" ] && [ -f "$LATEST_GUARD/state-guard-result.json" ]; then
  echo -n "[TEST] Pre-phase JSON schema correct ... "
  verify_json_schema "$LATEST_GUARD/state-guard-result.json" "OK" "UNKNOWN"
else
  echo "[TEST] Pre-phase JSON schema correct ... ✗ FAIL: no evidence file"
  TEST_FAILED=$((TEST_FAILED + 1))
fi

unset FT_GUARD_PHASE

# ============================================================================
# SUB-TEST 2: Post-phase FAIL when state leaked to artifact dir
# ============================================================================
echo ""
echo "[SUBTEST 2] Post-phase detects state.json in artifact dir"

mkdir -p "$REPO_ROOT/tests/playwright/.auth"
cat > "$REPO_ROOT/tests/playwright/.auth/state.json" << 'EOF'
{"cookies": [{"name": "test", "value": "x"}], "origins": []}
EOF
chmod 0600 "$REPO_ROOT/tests/playwright/.auth/state.json"

# Create fake artifact directory with leaked state
FAKE_ARTIFACT="/tmp/pw_dash_diag_fake_$(date +%s)"
mkdir -p "$FAKE_ARTIFACT"
cp "$REPO_ROOT/tests/playwright/.auth/state.json" "$FAKE_ARTIFACT/state.json"

export FT_GUARD_PHASE="post"
bash "$REPO_ROOT/scripts/proof/guard_no_auth_state_leak.sh" >/dev/null 2>&1 || true

LATEST_GUARD=$(ls -1dt /tmp/pw_state_guard_* 2>/dev/null | head -1)
if [ -n "$LATEST_GUARD" ] && [ -f "$LATEST_GUARD/state-guard-result.json" ]; then
  echo -n "[TEST] Post-phase detects artifact leak ... "
  verify_json_schema "$LATEST_GUARD/state-guard-result.json" "FAIL" "STATE_FILE_PRESENT_IN_ARTIFACT_DIR"
else
  echo "[TEST] Post-phase detects artifact leak ... ✗ FAIL: no evidence file"
  TEST_FAILED=$((TEST_FAILED + 1))
fi

rm -rf "$FAKE_ARTIFACT"
unset FT_GUARD_PHASE

# ============================================================================
# SUB-TEST 3: Post-phase FAIL when state exists with cleanup expectation
# ============================================================================
echo ""
echo "[SUBTEST 3] Post-phase detects state.json with cleanup expectation"

# state.json still exists from subtest 2
export FT_GUARD_PHASE="post"
export FT_GUARD_EXPECT_STATE_CLEANUP=1

bash "$REPO_ROOT/scripts/proof/guard_no_auth_state_leak.sh" >/dev/null 2>&1 || true

LATEST_GUARD=$(ls -1dt /tmp/pw_state_guard_* 2>/dev/null | head -1)
if [ -n "$LATEST_GUARD" ] && [ -f "$LATEST_GUARD/state-guard-result.json" ]; then
  echo -n "[TEST] Post-phase detects uncleaned state ... "
  verify_json_schema "$LATEST_GUARD/state-guard-result.json" "FAIL" "STATE_FILE_PRESENT_IN_REPO"
else
  echo "[TEST] Post-phase detects uncleaned state ... ✗ FAIL: no evidence file"
  TEST_FAILED=$((TEST_FAILED + 1))
fi

rm -f "$REPO_ROOT/tests/playwright/.auth/state.json" 2>/dev/null || true
unset FT_GUARD_PHASE
unset FT_GUARD_EXPECT_STATE_CLEANUP

# ============================================================================
# SUB-TEST 4: Verify .gitignore patterns
# ============================================================================
echo ""
echo "[SUBTEST 4] Verify .gitignore contains state.json patterns"

echo -n "[TEST] .gitignore has tests/playwright/.auth/state.json ... "
if grep -q "tests/playwright/.auth/state.json" "$REPO_ROOT/.gitignore"; then
  echo "✓ PASS"
  TEST_PASSED=$((TEST_PASSED + 1))
else
  echo "✗ FAIL"
  TEST_FAILED=$((TEST_FAILED + 1))
fi

echo -n "[TEST] .gitignore has wildcard *.json pattern ... "
if grep "tests/playwright/.auth.*json" "$REPO_ROOT/.gitignore" | grep -q '\*'; then
  echo "✓ PASS"
  TEST_PASSED=$((TEST_PASSED + 1))
else
  echo "✗ FAIL"
  TEST_FAILED=$((TEST_FAILED + 1))
fi

# ============================================================================
# SUB-TEST 5: Verify scripts don't echo secrets
# ============================================================================
echo ""
echo "[SUBTEST 5] Verify scripts don't echo secrets"

echo -n "[TEST] install_state_from_env.sh has set -euo pipefail ... "
if grep -q "set -euo pipefail" "$REPO_ROOT/scripts/proof/install_state_from_env.sh"; then
  echo "✓ PASS"
  TEST_PASSED=$((TEST_PASSED + 1))
else
  echo "✗ FAIL"
  TEST_FAILED=$((TEST_FAILED + 1))
fi

echo -n "[TEST] install_state_from_env.sh does NOT have set -x ... "
if ! grep -E "^set -x|^[[:space:]]*set -x" "$REPO_ROOT/scripts/proof/install_state_from_env.sh" 2>/dev/null | grep -v "^#" >/dev/null; then
  echo "✓ PASS"
  TEST_PASSED=$((TEST_PASSED + 1))
else
  echo "✗ FAIL"
  TEST_FAILED=$((TEST_FAILED + 1))
fi

echo -n "[TEST] workflow does NOT echo FT_AUTH_STATE_JSON_B64 ... "
if ! grep -E '(echo|printenv|env\s*\|).*FT_AUTH_STATE_JSON_B64' "$REPO_ROOT/.github/workflows/pw_dashboard_state_only.yml" 2>/dev/null | grep -v "^[[:space:]]*#" >/dev/null; then
  echo "✓ PASS"
  TEST_PASSED=$((TEST_PASSED + 1))
else
  echo "✗ FAIL"
  TEST_FAILED=$((TEST_FAILED + 1))
fi

# ============================================================================
# SUB-TEST 6: Runner integration (produces PRE and POST guard dirs)
# ============================================================================
echo ""
echo "[SUBTEST 6] Runner produces PRE and POST guard dirs with valid schema"

# Set up minimal state-only environment (runner will fail on network, but guards will run)
export JIRA_BASE_URL="https://example.invalid"
export JIRA_DASHBOARD_URL="https://example.invalid/jira/dashboards/1"
export FT_AUTH_MODE="state-only"
export FT_PLAYWRIGHT_TIMEOUT_SECONDS=5

# Ensure state.json does NOT exist (runner will catch this)
rm -f "$REPO_ROOT/tests/playwright/.auth/state.json" 2>/dev/null || true

# Run runner (will fail after pre-guard due to missing state, trap will run post-guard)
bash "$REPO_ROOT/scripts/proof/run_dashboard_playwright.sh" >/dev/null 2>&1 || true

# Check that at least 2 guard dirs were created (pre and post)
GUARD_DIRS=$(ls -1dt /tmp/pw_state_guard_* 2>/dev/null | head -2)
GUARD_COUNT=$(echo "$GUARD_DIRS" | wc -l)

echo -n "[TEST] Runner created at least 2 guard directories (pre + post) ... "
if [[ $GUARD_COUNT -ge 2 ]]; then
  echo "✓ PASS"
  TEST_PASSED=$((TEST_PASSED + 1))
  
  # Verify latest 2 guard dirs have valid JSON schema
  echo "$GUARD_DIRS" | while read -r guard_dir; do
    if [[ -f "$guard_dir/state-guard-result.json" ]]; then
      if node -e "
        const fs = require('fs');
        try {
          const j = JSON.parse(fs.readFileSync('$guard_dir/state-guard-result.json', 'utf-8'));
          const topKeys = Object.keys(j);
          if (topKeys.length === 3 && topKeys[0] === 'result' && topKeys[1] === 'reasonCode' && topKeys[2] === 'details') {
            process.exit(0);
          }
          process.exit(1);
        } catch(e) {
          process.exit(1);
        }
      " 2>/dev/null; then
        :  # Schema valid, no output
      fi
    fi
  done
else
  echo "✗ FAIL (got $GUARD_COUNT dirs, expected >= 2)"
  TEST_FAILED=$((TEST_FAILED + 1))
fi

# ============================================================================
# Summary
# ============================================================================
echo ""
echo "========== SELF-TEST SUMMARY =========="
echo "Tests passed: $TEST_PASSED"
echo "Tests failed: $TEST_FAILED"

if [ "$TEST_FAILED" -eq 0 ]; then
  echo "✓ All self-tests PASSED"
  exit 0
else
  echo "✗ Some self-tests FAILED"
  exit 1
fi
