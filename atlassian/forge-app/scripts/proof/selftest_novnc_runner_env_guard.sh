#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# NoVNC Runner Environment Guard Self-Test (Fail-Closed)
# ============================================================================
# Tests that the noVNC runner enforces all required env vars for SSO mode
# without requiring sudo, apt, or display stack.
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../" && pwd)"

echo "[FT_SELFTEST] ════════════════════════════════════════════"
echo "[FT_SELFTEST] NoVNC Runner Env Guard Self-Test"
echo "[FT_SELFTEST] ════════════════════════════════════════════"
echo ""

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# ============================================================================
# Test A: Missing FT_AUTH_GENERATE_STATE
# ============================================================================
echo "[FT_SELFTEST] === TEST A: Missing FT_AUTH_GENERATE_STATE ==="

# Run with SELFTEST=1 to skip display stack, but NOT setting FT_AUTH_GENERATE_STATE
TEST_ENV=(
  "JIRA_BASE_URL=https://firsttry.atlassian.net"
  "JIRA_DASHBOARD_URL=https://firsttry.atlassian.net/jira/dashboards/10102"
  "FT_PLAYWRIGHT_MODE=headed"
  "FT_SELFTEST=1"
)

if env -i "${TEST_ENV[@]}" bash "$SCRIPT_DIR/run_playwright_with_novnc.sh" > /tmp/test_a.log 2>&1; then
  echo "[FT_SELFTEST] ❌ FAIL: Should have exited 1 (FT_AUTH_GENERATE_STATE missing)"
  TESTS_FAILED=$((TESTS_FAILED + 1))
else
  EXIT_CODE=$?
  if grep -q "FT_AUTH_GENERATE_STATE not set" /tmp/test_a.log; then
    echo "[FT_SELFTEST] ✓ PASS: Correctly rejected missing FT_AUTH_GENERATE_STATE"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    echo "[FT_SELFTEST] ❌ FAIL: Exited but with wrong reason (check /tmp/test_a.log)"
    TESTS_FAILED=$((TESTS_FAILED + 1))
  fi
fi
echo ""

# ============================================================================
# Test B: Missing FT_PLAYWRIGHT_MODE
# ============================================================================
echo "[FT_SELFTEST] === TEST B: Missing FT_PLAYWRIGHT_MODE ==="

TEST_ENV=(
  "JIRA_BASE_URL=https://firsttry.atlassian.net"
  "JIRA_DASHBOARD_URL=https://firsttry.atlassian.net/jira/dashboards/10102"
  "FT_AUTH_GENERATE_STATE=1"
  "FT_SELFTEST=1"
)

if env -i "${TEST_ENV[@]}" bash "$SCRIPT_DIR/run_playwright_with_novnc.sh" > /tmp/test_b.log 2>&1; then
  echo "[FT_SELFTEST] ❌ FAIL: Should have exited 1 (FT_PLAYWRIGHT_MODE missing)"
  TESTS_FAILED=$((TESTS_FAILED + 1))
else
  EXIT_CODE=$?
  if grep -q "FT_PLAYWRIGHT_MODE not set" /tmp/test_b.log; then
    echo "[FT_SELFTEST] ✓ PASS: Correctly rejected missing FT_PLAYWRIGHT_MODE"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    echo "[FT_SELFTEST] ❌ FAIL: Exited but with wrong reason (check /tmp/test_b.log)"
    TESTS_FAILED=$((TESTS_FAILED + 1))
  fi
fi
echo ""

# ============================================================================
# Test C: Invalid FT_AUTH_GENERATE_STATE value
# ============================================================================
echo "[FT_SELFTEST] === TEST C: Invalid FT_AUTH_GENERATE_STATE value ==="

TEST_ENV=(
  "JIRA_BASE_URL=https://firsttry.atlassian.net"
  "JIRA_DASHBOARD_URL=https://firsttry.atlassian.net/jira/dashboards/10102"
  "FT_AUTH_GENERATE_STATE=0"
  "FT_PLAYWRIGHT_MODE=headed"
  "FT_SELFTEST=1"
)

if env -i "${TEST_ENV[@]}" bash "$SCRIPT_DIR/run_playwright_with_novnc.sh" > /tmp/test_c.log 2>&1; then
  echo "[FT_SELFTEST] ❌ FAIL: Should have exited 1 (invalid FT_AUTH_GENERATE_STATE)"
  TESTS_FAILED=$((TESTS_FAILED + 1))
else
  EXIT_CODE=$?
  if grep -q "FT_AUTH_GENERATE_STATE must equal '1'" /tmp/test_c.log; then
    echo "[FT_SELFTEST] ✓ PASS: Correctly rejected invalid FT_AUTH_GENERATE_STATE"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    echo "[FT_SELFTEST] ❌ FAIL: Exited but with wrong reason (check /tmp/test_c.log)"
    TESTS_FAILED=$((TESTS_FAILED + 1))
  fi
fi
echo ""

# ============================================================================
# Test D: Invalid FT_PLAYWRIGHT_MODE value
# ============================================================================
echo "[FT_SELFTEST] === TEST D: Invalid FT_PLAYWRIGHT_MODE value ==="

TEST_ENV=(
  "JIRA_BASE_URL=https://firsttry.atlassian.net"
  "JIRA_DASHBOARD_URL=https://firsttry.atlassian.net/jira/dashboards/10102"
  "FT_AUTH_GENERATE_STATE=1"
  "FT_PLAYWRIGHT_MODE=headless"
  "FT_SELFTEST=1"
)

if env -i "${TEST_ENV[@]}" bash "$SCRIPT_DIR/run_playwright_with_novnc.sh" > /tmp/test_d.log 2>&1; then
  echo "[FT_SELFTEST] ❌ FAIL: Should have exited 1 (invalid FT_PLAYWRIGHT_MODE)"
  TESTS_FAILED=$((TESTS_FAILED + 1))
else
  EXIT_CODE=$?
  if grep -q "FT_PLAYWRIGHT_MODE must equal 'headed'" /tmp/test_d.log; then
    echo "[FT_SELFTEST] ✓ PASS: Correctly rejected invalid FT_PLAYWRIGHT_MODE"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    echo "[FT_SELFTEST] ❌ FAIL: Exited but with wrong reason (check /tmp/test_d.log)"
    TESTS_FAILED=$((TESTS_FAILED + 1))
  fi
fi
echo ""

# ============================================================================
# Test E: All required vars set correctly (should pass env check)
# ============================================================================
echo "[FT_SELFTEST] === TEST E: All required vars set (env check only) ==="

TEST_ENV=(
  "JIRA_BASE_URL=https://firsttry.atlassian.net"
  "JIRA_DASHBOARD_URL=https://firsttry.atlassian.net/jira/dashboards/10102"
  "FT_AUTH_GENERATE_STATE=1"
  "FT_PLAYWRIGHT_MODE=headed"
  "FT_SELFTEST=1"
)

if env -i "${TEST_ENV[@]}" bash "$SCRIPT_DIR/run_playwright_with_novnc.sh" > /tmp/test_e.log 2>&1; then
  if grep -q "Env validation passed" /tmp/test_e.log; then
    echo "[FT_SELFTEST] ✓ PASS: All env vars accepted (SELFTEST=1 exits before display)"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    echo "[FT_SELFTEST] ❌ FAIL: Accepted but wrong message (check /tmp/test_e.log)"
    TESTS_FAILED=$((TESTS_FAILED + 1))
  fi
else
  echo "[FT_SELFTEST] ❌ FAIL: Should have passed env check with all vars (check /tmp/test_e.log)"
  TESTS_FAILED=$((TESTS_FAILED + 1))
fi
echo ""

# ============================================================================
# Summary
# ============================================================================
echo "[FT_SELFTEST] ════════════════════════════════════════════"
echo "[FT_SELFTEST] Summary"
echo "[FT_SELFTEST] ════════════════════════════════════════════"
echo "[FT_SELFTEST] Tests passed: $TESTS_PASSED"
echo "[FT_SELFTEST] Tests failed: $TESTS_FAILED"
echo ""

if [[ $TESTS_FAILED -eq 0 ]]; then
  echo "[FT_SELFTEST] ✅ All tests PASSED"
  exit 0
else
  echo "[FT_SELFTEST] ❌ Some tests FAILED"
  exit 1
fi
