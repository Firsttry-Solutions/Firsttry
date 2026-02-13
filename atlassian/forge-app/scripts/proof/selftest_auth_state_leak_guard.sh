#!/bin/bash
# selftest_auth_state_leak_guard.sh
# Purpose: Local self-test to verify guard_no_auth_state_leak.sh works correctly.
# No secrets, no CI dependencies. Tests pre/post phases and failure scenarios.

set -euo pipefail

echo "========== AUTH STATE LEAK GUARD SELF-TEST =========="

TEST_PASSED=0
TEST_FAILED=0

# Determine the repo directory (assuming script is in scripts/proof/)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "[INFO] Repository root: $REPO_ROOT"
cd "$REPO_ROOT" || exit 1

# ============================================================================
# Helper: Run a single test
# ============================================================================
run_test() {
  local name="$1"
  local expected_exit="$2"
  shift 2
  
  echo -n "[TEST] $name ... "
  
  # Execute the command and capture exit code
  actual_exit=0
  "$@" >/dev/null 2>&1 || actual_exit=$?
  
  if [ "$actual_exit" -eq "$expected_exit" ]; then
    echo "✓ PASS"
    TEST_PASSED=$((TEST_PASSED + 1))
  else
    echo "✗ FAIL (expected exit $expected_exit, got $actual_exit)"
    TEST_FAILED=$((TEST_FAILED + 1))
  fi
}

# ============================================================================
# SUB-TEST 1: Pre-phase guard 
# ============================================================================
echo ""
echo "[SUBTEST 1] Pre-phase guard (should PASS: no state.json, no tracking violations)"

rm -f "$REPO_ROOT/tests/playwright/.auth/state.json" 2>/dev/null || true

run_test "Pre-phase with no state.json" 0 \
  env FT_GUARD_PHASE=pre bash "$REPO_ROOT/scripts/proof/guard_no_auth_state_leak.sh"

# ============================================================================
# SUB-TEST 2: Pre-phase with untracked state.json  
# ============================================================================
echo ""
echo "[SUBTEST 2] Pre-phase with untracked state.json (should PASS: not tracked)"

mkdir -p "$REPO_ROOT/tests/playwright/.auth"
cat > "$REPO_ROOT/tests/playwright/.auth/state.json" << 'EOF'
{"cookies": [{"name": "fake_cookie", "value": "xxx"}], "origins": [{"origin": "https://test.example.com"}]}
EOF
chmod 0600 "$REPO_ROOT/tests/playwright/.auth/state.json"

run_test "Pre-phase with untracked fake state.json" 0 \
  env FT_GUARD_PHASE=pre bash "$REPO_ROOT/scripts/proof/guard_no_auth_state_leak.sh"

# ============================================================================
# SUB-TEST 3: Post-phase with state in artifact dir
# ============================================================================
echo ""
echo "[SUBTEST 3] Post-phase with state.json in artifact dir (should FAIL)"

FAKE_ARTIFACT_DIR="/tmp/pw_dash_diag_fake_test_$(date +%s)"
mkdir -p "$FAKE_ARTIFACT_DIR"
cp "$REPO_ROOT/tests/playwright/.auth/state.json" "$FAKE_ARTIFACT_DIR/state.json"

run_test "Post-phase detects state.json in artifact dir" 1 \
  env FT_GUARD_PHASE=post bash "$REPO_ROOT/scripts/proof/guard_no_auth_state_leak.sh"

rm -rf "$FAKE_ARTIFACT_DIR"

# ============================================================================
# SUB-TEST 4: .gitignore patterns
# ============================================================================
echo ""
echo "[SUBTEST 4] Verify .gitignore contains state.json patterns"

run_test ".gitignore has tests/playwright/.auth/state.json" 0 \
  grep -q "tests/playwright/.auth/state.json" "$REPO_ROOT/.gitignore"

run_test ".gitignore has wildcard *.json pattern" 0 \
  grep "tests/playwright/.auth/.*json" "$REPO_ROOT/.gitignore"

# ============================================================================
# SUB-TEST 5: install_state_from_env.sh validation
# ============================================================================
echo ""
echo "[SUBTEST 5] Verify install_state_from_env.sh fail-closed + no set -x"

run_test "install_state_from_env.sh has set -euo pipefail" 0 \
  grep -q "set -euo pipefail" "$REPO_ROOT/scripts/proof/install_state_from_env.sh"

# Check it doesn't have set -x
if grep -E "^set -x|^[[:space:]]*set -x" "$REPO_ROOT/scripts/proof/install_state_from_env.sh" 2>/dev/null | grep -v "^#"; then
  echo "[TEST] install_state_from_env.sh does NOT have set -x ... ✗ FAIL"
  TEST_FAILED=$((TEST_FAILED + 1))
else
  echo "[TEST] install_state_from_env.sh does NOT have set -x ... ✓ PASS"
  TEST_PASSED=$((TEST_PASSED + 1))
fi

# ============================================================================
# SUB-TEST 6: Workflow YAML secret safety
# ============================================================================
echo ""
echo "[SUBTEST 6] Verify workflow YAML does NOT echo FT_AUTH_STATE_JSON_B64"

if grep -E 'echo.*\$' "$REPO_ROOT/.github/workflows/pw_dashboard_state_only.yml" 2>/dev/null | grep -q "FT_AUTH_STATE_JSON_B64"; then
  echo "[TEST] Workflow does NOT echo FT_AUTH_STATE_JSON_B64 ... ✗ FAIL"
  TEST_FAILED=$((TEST_FAILED + 1))
else
  echo "[TEST] Workflow does NOT echo FT_AUTH_STATE_JSON_B64 ... ✓ PASS"
  TEST_PASSED=$((TEST_PASSED + 1))
fi

# ============================================================================
# SUB-TEST 7: Cleanup
# ============================================================================
echo ""
echo "[SUBTEST 7] Clean up"

rm -f "$REPO_ROOT/tests/playwright/.auth/state.json" 2>/dev/null || true
run_test "Fake state.json cleaned up" 0 \
  test ! -f "$REPO_ROOT/tests/playwright/.auth/state.json"

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
