#!/bin/bash
#==============================================================================
# Playwright Gate Semantics Selftest (Fast Unit-Style Tests)
#
# Tests the decision logic of CHECK-11 without running real Playwright.
# Covers:
#  1) skip mode with missing reason => PLAYWRIGHT_SKIP_REASON_MISSING
#  2) skip mode with reason => PLAYWRIGHT_SKIPPED_EXPLICIT
#  3) run mode with missing env => PLAYWRIGHT_ENV_MISSING_FAIL
#
# Returns: exit 0 + [FT_PROOF] PLAYWRIGHT_GATE_SEMANTICS_SELFTEST_PASS
#==============================================================================

set -euo pipefail

REPO_ROOT="/workspaces/Firsttry/atlassian/forge-app"
cd "$REPO_ROOT" || exit 1

SELFTEST_PASS=0
SELFTEST_FAIL=0

# =============================================================================
# Helper: Run an isolated CHECK-11 via FT_ONLY_CHECK=11
# =============================================================================
run_check11() {
    local test_name="$1"
    shift  # Consume test_name
    
    # All remaining args are env vars to set for this test
    local env_vars=("$@")
    
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "TEST: $test_name"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    local output
    local exit_code
    
    # Run gate with test-specific env vars
    if output=$( env -i PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" \
        REPO_ROOT="$REPO_ROOT" \
        FT_ONLY_CHECK=11 \
        "${env_vars[@]}" \
        bash scripts/proof/ship_phase2_gate.sh 2>&1 ); then
        exit_code=0
    else
        exit_code=$?
    fi
    
    echo "$output"
    echo "EXIT_CODE: $exit_code"
    echo ""
    
    echo "$output"  # Will be returned through stdout
}

# =============================================================================
# TEST 1: FT_PLAYWRIGHT_GATE=skip but FT_PLAYWRIGHT_SKIP_REASON missing
# Expected: FAIL with PLAYWRIGHT_SKIP_REASON_MISSING
# =============================================================================
echo ""
echo "╔═════════════════════════════════════════════════════════════════════╗"
echo "║ TEST 1: skip mode without reason (should FAIL)                      ║"
echo "╚═════════════════════════════════════════════════════════════════════╝"
echo ""

if output=$( env -i PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" \
    REPO_ROOT="$REPO_ROOT" \
    FT_ONLY_CHECK=11 \
    FT_PLAYWRIGHT_GATE=skip \
    bash scripts/proof/ship_phase2_gate.sh 2>&1 ); then
    exit_code=0
else
    exit_code=$?
fi

echo "$output"

if echo "$output" | grep -q "\[FT_PROOF\] PLAYWRIGHT_SKIP_REASON_MISSING"; then
    echo "✅ TEST 1 PASS: Correctly detected missing skip reason"
    ((SELFTEST_PASS++))
else
    echo "❌ TEST 1 FAIL: Did not detect missing skip reason"
    ((SELFTEST_FAIL++))
fi

if [[ $exit_code -ne 0 ]]; then
    echo "✅ TEST 1 PASS: Correctly exited non-zero"
    ((SELFTEST_PASS++))
else
    echo "❌ TEST 1 FAIL: Should have exited non-zero"
    ((SELFTEST_FAIL++))
fi

echo ""

# =============================================================================
# TEST 2: FT_PLAYWRIGHT_GATE=skip WITH FT_PLAYWRIGHT_SKIP_REASON
# Expected: PASS with PLAYWRIGHT_SKIPPED_EXPLICIT
# =============================================================================
echo ""
echo "╔═════════════════════════════════════════════════════════════════════╗"
echo "║ TEST 2: skip mode with reason (should PASS)                         ║"
echo "╚═════════════════════════════════════════════════════════════════════╝"
echo ""

if output=$( env -i PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" \
    REPO_ROOT="$REPO_ROOT" \
    FT_ONLY_CHECK=11 \
    FT_PLAYWRIGHT_GATE=skip \
    FT_PLAYWRIGHT_SKIP_REASON="CI/headless: interactive state generation requires display" \
    bash scripts/proof/ship_phase2_gate.sh 2>&1 ); then
    exit_code=0
else
    exit_code=$?
fi

echo "$output"

if echo "$output" | grep -q "\[FT_PROOF\] PLAYWRIGHT_SKIPPED_EXPLICIT"; then
    echo "✅ TEST 2 PASS: Correctly emitted skip marker"
    ((SELFTEST_PASS++))
else
    echo "❌ TEST 2 FAIL: Did not emit skip marker"
    ((SELFTEST_FAIL++))
fi

if [[ $exit_code -eq 0 ]]; then
    echo "✅ TEST 2 PASS: Correctly exited zero"
    ((SELFTEST_PASS++))
else
    echo "❌ TEST 2 FAIL: Should have exited zero (got $exit_code)"
    ((SELFTEST_FAIL++))
fi

echo ""

# =============================================================================
# TEST 3: FT_PLAYWRIGHT_GATE=run (default) with missing JIRA env
# Expected: FAIL with PLAYWRIGHT_ENV_MISSING_FAIL
# =============================================================================
echo ""
echo "╔═════════════════════════════════════════════════════════════════════╗"
echo "║ TEST 3: run mode with missing Jira env (should FAIL)                ║"
echo "╚═════════════════════════════════════════════════════════════════════╝"
echo ""

if output=$( env -i PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" \
    REPO_ROOT="$REPO_ROOT" \
    FT_ONLY_CHECK=11 \
    FT_PLAYWRIGHT_GATE=run \
    bash scripts/proof/ship_phase2_gate.sh 2>&1 ); then
    exit_code=0
else
    exit_code=$?
fi

echo "$output"

if echo "$output" | grep -q "\[FT_PROOF\] PLAYWRIGHT_ENV_MISSING_FAIL"; then
    echo "✅ TEST 3 PASS: Correctly detected missing env"
    ((SELFTEST_PASS++))
else
    echo "❌ TEST 3 FAIL: Did not detect missing env"
    ((SELFTEST_FAIL++))
fi

if [[ $exit_code -ne 0 ]]; then
    echo "✅ TEST 3 PASS: Correctly exited non-zero"
    ((SELFTEST_PASS++))
else
    echo "❌ TEST 3 FAIL: Should have exited non-zero"
    ((SELFTEST_FAIL++))
fi

echo ""

# =============================================================================
# FINAL RESULT
# =============================================================================
echo ""
echo "╔═════════════════════════════════════════════════════════════════════╗"
echo "║ SELFTEST SUMMARY                                                    ║"
echo "╚═════════════════════════════════════════════════════════════════════╝"
echo ""
echo "PASS: $SELFTEST_PASS / 6"
echo "FAIL: $SELFTEST_FAIL / 6"
echo ""

if [[ $SELFTEST_FAIL -eq 0 ]]; then
    echo "[FT_PROOF] PLAYWRIGHT_GATE_SEMANTICS_SELFTEST_PASS"
    exit 0
else
    echo "[FT_PROOF] PLAYWRIGHT_GATE_SEMANTICS_SELFTEST_FAIL"
    exit 1
fi
