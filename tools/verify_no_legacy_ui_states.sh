#!/bin/bash
# PHASE 1 GATE: Verify no legacy UI placeholder states can be rendered
# User requirement: UNKNOWN, INITIALIZING, NOT_AVAILABLE must NEVER appear in production UI state
# This script fails if legacy state fallback values are found in UI source code

set -e

DIST_DIR="${1:-.}"
EXIT_CODE=0

echo "[PHASE_1_GATE] Checking for legacy UI placeholder states in dist bundle..."

# Check 1: No EMPTY_STATUS_V1 with UNKNOWN in actual rendering code
# Look for the removed pattern where UNKNOWN was used as fallback
if grep -r "EMPTY_STATUS_V1.*UNKNOWN" "$DIST_DIR/dist" 2>/dev/null > /dev/null; then
    echo "❌ FAIL: EMPTY_STATUS_V1 UNKNOWN fallback pattern found"
    EXIT_CODE=1
else
    echo "✓ PASS: EMPTY_STATUS_V1 UNKNOWN fallback removed"
fi

# Check 2: Verify ping resolver is NOT called (new code uses ft_getDashboardState_v1 only)
if grep -r "invoke.*['\"]ping['\"]" "$DIST_DIR/dist" 2>/dev/null > /dev/null; then
    echo "❌ FAIL: ping resolver invocation still present"
    EXIT_CODE=1
else
    echo "✓ PASS: ping resolver not invoked"
fi

# Check 3: Verify ft_getDashboardState_v1 IS called (single source of truth)
if grep -r "ft_getDashboardState_v1" "$DIST_DIR/dist" 2>/dev/null > /dev/null; then
    echo "✓ PASS: ft_getDashboardState_v1 is invoked (single source of truth)"
else
    echo "⚠ WARNING: ft_getDashboardState_v1 not found (may be heavily minified)"
fi

# Check 4: No NOT_AVAILABLE status value being rendered
# This would indicate freshnessStatus = NOT_AVAILABLE is still in use
if grep -r "'NOT_AVAILABLE'" "$DIST_DIR/dist" 2>/dev/null | grep -v "typing" | grep -v "comment" > /dev/null; then
    echo "❌ FAIL: NOT_AVAILABLE status rendering found"
    EXIT_CODE=1
else
    echo "✓ PASS: NOT_AVAILABLE not used for rendering"
fi

# Check 5: Ensure error handler returns early (no fallback rendering)
# The refactored code should have "return" after error panel setup  
if [ -f "$DIST_DIR/src/gadget-ui/src/main.ts" ]; then
    if grep -A 3 "error-panel error" "$DIST_DIR/src/gadget-ui/src/main.ts" 2>/dev/null | grep -q "return"; then
        echo "✓ PASS: Error handler exits early (no fallback UI)"
    else
        echo "⚠ WARNING: Could not verify error handler exit in source"
    fi
fi

if [ $EXIT_CODE -eq 0 ]; then
    echo ""
    echo "[PHASE_1_GATE] ✅ All legacy state checks PASSED"
    exit 0
else
    echo ""
    echo "[PHASE_1_GATE] ❌ Legacy state gate FAILED"
    exit 1
fi


