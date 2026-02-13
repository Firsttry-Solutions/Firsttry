#!/bin/bash
# selftest_auth_state_leak_guard.sh
# Purpose: Local self-test to verify guard_no_auth_state_leak.sh works correctly.
# No secrets, no CI dependencies. Tests pre/post phases and failure scenarios.

set -euo pipefail

echo "========== AUTH STATE LEAK GUARD SELF-TEST =========="

TEST_PASSED=0
TEST_FAILED=0

# Ensure we're in the repo root
cd "$(git rev-parse --show-toplevel)" || exit 1

# ============================================================================
# Helper functions
# ============================================================================
test_assert() {
  local name="$1"
  local expected_exit="$2"
  local cmd="$3"
  
  echo -n "[TEST] $name ... "
  if eval "$cmd" >/dev/null 2>&1; then
    local actual_exit=0
  else
    local actual_exit=$?
  fi
  
  if [ "$actual_exit" -eq "$expected_exit" ]; then
    echo "✓ PASS"
    TEST_PASSED=$((TEST_PASSED + 1))
  else
    echo "✗ FAIL (expected exit $expected_exit, got $actual_exit)"
    TEST_FAILED=$((TEST_FAILED + 1))
  fi
}

# ============================================================================
# SUB-TEST 1: Pre-phase guard (no state.json, no tracking issues)
# ============================================================================
echo ""
echo "[SUBTEST 1] Pre-phase guard (should PASS: no state.json, no tracking violations)"

# Ensure state.json does NOT exist for this test
rm -f tests/playwright/.auth/state.json

export FT_GUARD_PHASE="pre"
test_assert "Pre-phase with no state.json" 0 \
  "bash scripts/proof/guard_no_auth_state_leak.sh"

unset FT_GUARD_PHASE

# ============================================================================
# SUB-TEST 2: Create fake state.json and re-verify pre-phase still passes
# ============================================================================
echo ""
echo "[SUBTEST 2] Pre-phase with untracked state.json (should PASS: not tracked)"

mkdir -p tests/playwright/.auth

# Create a minimal fake state (NOT a real secret, just test data)
cat > tests/playwright/.auth/state.json << 'EOF'
{
  "cookies": [{"name": "fake_cookie", "value": "xxx"}],
  "origins": [{"origin": "https://test.example.com"}]
}
EOF

chmod 0600 tests/playwright/.auth/state.json

export FT_GUARD_PHASE="pre"
test_assert "Pre-phase with untracked fake state.json" 0 \
  "bash scripts/proof/guard_no_auth_state_leak.sh"

unset FT_GUARD_PHASE

# ============================================================================
# SUB-TEST 3: Post-phase guard with fake state in artifact dir
# ============================================================================
echo ""
echo "[SUBTEST 3] Post-phase with state.json in artifact dir (should FAIL)"

# Simulate a Playwright test output directory
FAKE_ARTIFACT_DIR="/tmp/pw_dash_diag_fake_test_$(date +%s)"
mkdir -p "$FAKE_ARTIFACT_DIR"

# Copy fake state.json into artifact dir (simulating a leak)
cp tests/playwright/.auth/state.json "$FAKE_ARTIFACT_DIR/state.json"

export FT_GUARD_PHASE="post"
test_assert "Post-phase detects state.json in artifact dir" 1 \
  "bash scripts/proof/guard_no_auth_state_leak.sh"

unset FT_GUARD_PHASE

# Clean up
rm -rf "$FAKE_ARTIFACT_DIR"

# ============================================================================
# SUB-TEST 4: Verify .gitignore has correct patterns
# ============================================================================
echo ""
echo "[SUBTEST 4] Verify .gitignore contains state.json patterns"

test_assert ".gitignore has tests/playwright/.auth/state.json" 0 \
  "grep -q 'tests/playwright/.auth/state.json' .gitignore"

test_assert ".gitignore has tests/playwright/.auth/*.json" 0 \
  "grep -q 'tests/playwright/.auth/\*\.json' .gitignore"

# ============================================================================
# SUB-TEST 5: Verify install_state_from_env.sh does NOT have set -x
# ============================================================================
echo ""
echo "[SUBTEST 5] Verify install_state_from_env.sh has fail-closed + no set -x"

test_assert "install_state_from_env.sh has set -euo pipefail" 0 \
  "grep -q 'set -euo pipefail' scripts/proof/install_state_from_env.sh"

test_assert "install_state_from_env.sh does NOT have set -x" 0 \
  "! grep -E '^set -x' scripts/proof/install_state_from_env.sh"

# ============================================================================
# SUB-TEST 6: Verify workflow does NOT echo secrets
# ============================================================================
echo ""
echo "[SUBTEST 6] Verify workflow YAML does NOT echo FT_AUTH_STATE_JSON_B64"

test_assert "Workflow does NOT echo FT_AUTH_STATE_JSON_B64" 0 \
  "! grep -E 'echo.*\\\$.*FT_AUTH_STATE_JSON_B64|echo.*FT_AUTH_STATE_JSON_B64' .github/workflows/pw_dashboard_state_only.yml"

# ============================================================================
# SUB-TEST 7: Clean up fake state.json
# ============================================================================
echo ""
echo "[SUBTEST 7] Clean up"

rm -f tests/playwright/.auth/state.json
test_assert "Fake state.json cleaned up" 0 \
  "[ ! -f tests/playwright/.auth/state.json ]"

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
