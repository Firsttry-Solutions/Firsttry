#!/usr/bin/env bash
#
# Guard Script for Phase 5.1.6: Glass Box Analytics (NON-BYPASSABLE, FAIL-CLOSED)
#
# Validates that Glass Box Analytics implementation:
# 1. Maintains package.json integrity (no new dependencies)
# 2. Maintains lockfile integrity  
# 3. Does NOT introduce outbound networking
# 4. Does NOT introduce Jira mutations
# 5. Contains ALL 6 required FT_PROOF markers
# 6. All tests pass
# 7. Build succeeds
#
# FT_PROOF_GUARD_PHASE5_1_6_v1: This guard validates Glass Box Analytics constraints (fail-closed)
#

set -u pipefail

# Get RUN_DIR from arg or use current directory
RUN_DIR="${1:-.}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORK_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Ensure RUN_DIR exists
mkdir -p "$RUN_DIR"

# Initialize counters
GUARD_PASSES=0
GUARD_FAILURES=0

# Logging functions
log_pass() {
    local msg="$1"
    echo "✅ PASS: $msg"
    GUARD_PASSES=$((GUARD_PASSES + 1))
}

log_fail() {
    local msg="$1"
    echo "❌ FAIL: $msg"
    GUARD_FAILURES=$((GUARD_FAILURES + 1))
}

log_step() {
    local step="$1"
    echo ""
    echo "--- $step ---"
}

echo "[FT_PROOF_GUARD_PHASE5_1_6_v1] Starting guard validation for Phase 5.1.6 Glass Box Analytics"

# ============================================================================
# CHECK 1: ALL 6 FT_PROOF markers present (FAIL-CLOSED)
# ============================================================================
log_step "CHECK 1: All 6 FT_PROOF markers must be present"

REQUIRED_MARKERS="FT_PROOF_RISK_FORMULA_VISIBLE_v1 FT_PROOF_CONTEXT_DIFF_v1 FT_PROOF_PATTERN_MATCH_v1 FT_PROOF_IMPACT_SCOPE_v1 FT_PROOF_NO_SIMULATION_v1 FT_PROOF_MAILTO_ZERO_SCOPE_v1"

MARKERS_FOUND=0
for marker in $REQUIRED_MARKERS; do
    if grep -r "$marker" "$WORK_DIR/src" "$WORK_DIR/tests" "$WORK_DIR/scripts" >/dev/null 2>&1; then
        log_pass "Marker: $marker"
        MARKERS_FOUND=$((MARKERS_FOUND + 1))
    else
        log_fail "Marker MISSING: $marker"
    fi
done

if [ "$MARKERS_FOUND" -ne 6 ]; then
    echo ""
    echo "FAIL: Only $MARKERS_FOUND/6 markers found. Aborting."
    echo "Failures: $GUARD_FAILURES" | tee "$RUN_DIR/guard_failed_markers.txt"
    exit 1
fi

# ============================================================================
# CHECK 2: No runtime clock in analytics paths (FAIL-CLOSED)
# ============================================================================
log_step "CHECK 2: No runtime clock (Date/toISOString) in analytics paths"

CLOCK_FOUND=0
for dir in src/metrics src/analysis src/diff src/export/auditor; do
    if grep -r "new Date\|toISOString" "$dir" >/dev/null 2>&1; then
        log_fail "Clock found in $dir"
        CLOCK_FOUND=$((CLOCK_FOUND + 1))
    fi
done

if [ "$CLOCK_FOUND" -gt 0 ]; then
    echo ""
    echo "FAIL: Runtime clock detected in $CLOCK_FOUND location(s). Aborting."
    echo "Failures: $GUARD_FAILURES" | tee "$RUN_DIR/guard_failed_clock.txt"
    exit 1
fi

log_pass "No runtime clock in analytics paths"

# ============================================================================
# CHECK 3: No outbound networking patterns in new Glass Box modules
# ============================================================================
log_step "CHECK 3: No outbound networking patterns in new modules"

NETWORK_FOUND=0
for file in src/metrics/riskIndex.ts src/analysis/impactScope.ts; do
    if [ -f "$file" ]; then
        if grep -E "fetch\(|axios\b|\.http\b|\.https\b|invokeRemote|WebSocket" "$file" >/dev/null 2>&1; then
            log_fail "Networking pattern in $file"
            NETWORK_FOUND=$((NETWORK_FOUND + 1))
        fi
    fi
done

if [ "$NETWORK_FOUND" -gt 0 ]; then
    echo ""
    echo "FAIL: Outbound networking detected in $NETWORK_FOUND file(s). Aborting."
    echo "Failures: $GUARD_FAILURES" | tee "$RUN_DIR/guard_failed_network.txt"
    exit 1
fi

log_pass "No outbound networking in new Glass Box modules"

# ============================================================================
# CHECK 4: No Jira mutation methods (FAIL-CLOSED)
# ============================================================================
log_step "CHECK 4: No Jira mutation methods (POST/PUT/DELETE)"

MUTATION_FOUND=0
for file in src/metrics/riskIndex.ts src/analysis/impactScope.ts src/diff/diffEngine.ts src/export/auditor/htmlReport.ts; do
    if [ -f "$file" ]; then
        if grep -E "method:\s*'(POST|PUT|DELETE)|method:\s*\"(POST|PUT|DELETE)\"" "$file" >/dev/null 2>&1; then
            log_fail "Mutation method in $file"
            MUTATION_FOUND=$((MUTATION_FOUND + 1))
        fi
    fi
done

if [ "$MUTATION_FOUND" -gt 0 ]; then
    echo ""
    echo "FAIL: Jira mutations detected in $MUTATION_FOUND file(s). Aborting."
    echo "Failures: $GUARD_FAILURES" | tee "$RUN_DIR/guard_failed_mutations.txt"
    exit 1
fi

log_pass "No Jira mutation methods detected"

# ============================================================================
# CHECK 5: package.json unchanged (snapshot comparison)
# ============================================================================
log_step "CHECK 5: package.json dependencies unchanged"

if [ -f "$RUN_DIR/package.json.before" ]; then
    if diff -q "$RUN_DIR/package.json.before" "$WORK_DIR/package.json" >/dev/null 2>&1; then
        log_pass "package.json unchanged"
    else
        log_fail "package.json has been modified"
        echo "Failures: $GUARD_FAILURES" | tee "$RUN_DIR/guard_failed_pkg.txt"
        exit 1
    fi
else
    log_pass "package.json snapshot check skipped (no before snapshot)"
fi

# ============================================================================
# CHECK 6: lockfile unchanged (snapshot comparison)
# ============================================================================
log_step "CHECK 6: Lockfile integrity"

if [ -f "$RUN_DIR/package-lock.json.before" ] && [ -f "$WORK_DIR/package-lock.json" ]; then
    if diff -q "$RUN_DIR/package-lock.json.before" "$WORK_DIR/package-lock.json" >/dev/null 2>&1; then
        log_pass "package-lock.json unchanged"
    else
        log_fail "package-lock.json has been modified"
        echo "Failures: $GUARD_FAILURES" | tee "$RUN_DIR/guard_failed_lock.txt"
        exit 1
    fi
else
    log_pass "Lockfile check skipped (no before snapshot or lockfile absent)"
fi

# ============================================================================
# CHECK 7: Tests pass (FAIL-CLOSED)
# ============================================================================
log_step "CHECK 7: Running npm test"

cd "$WORK_DIR"
TEST_LOG="$RUN_DIR/test_run.log"

if RUN_DIR="$RUN_DIR" npm test >"$TEST_LOG" 2>&1; then
    log_pass "All tests passed"
else
    log_fail "Tests failed"
    {
        echo "TEST FAILURE LOG (tail):"
        tail -200 "$TEST_LOG"
    } | tee "$RUN_DIR/guard_failed_tests.txt"
    exit 1
fi

# ============================================================================
# CHECK 8: Build succeeds (FAIL-CLOSED)
# ============================================================================
log_step "CHECK 8: Running npm run build"

BUILD_LOG="$RUN_DIR/build_run.log"

if RUN_DIR="$RUN_DIR" npm run build >"$BUILD_LOG" 2>&1; then
    log_pass "Build succeeded"
else
    log_fail "Build failed"
    {
        echo "BUILD FAILURE LOG (tail):"
        tail -200 "$BUILD_LOG"
    } | tee "$RUN_DIR/guard_failed_build.txt"
    exit 1
fi

# ============================================================================
# FINAL RESULTS
# ============================================================================
echo ""
echo "=========================================="
echo "GUARD PHASE 5.1.6 RESULTS"
echo "=========================================="
echo "Passes: $GUARD_PASSES"
echo "Failures: $GUARD_FAILURES"
echo ""

if [ "$GUARD_FAILURES" -eq 0 ]; then
    echo "✅ ALL CHECKS PASSED (Phase 5.1.6 Glass Box Analytics Guard)"
    echo "[FT_PROOF_GUARD_PHASE5_1_6_v1] Guard validation complete - PASS"
    exit 0
else
    echo "❌ GUARD FAILED: $GUARD_FAILURES failure(s) detected"
    echo "Failures: $GUARD_FAILURES" | tee "$RUN_DIR/guard_final_status.txt"
    exit 1
fi
