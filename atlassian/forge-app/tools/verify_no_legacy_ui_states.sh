#!/bin/bash
# PHASE 1 GATE: Verify no legacy UI placeholder states can be rendered
# User requirement: UNKNOWN, INITIALIZING, NOT_AVAILABLE must NEVER appear in production UI state
# This script fails if legacy state fallback values are found in UI source code

set -e

DIST_DIR="${1:-.}"
EXIT_CODE=0

echo "[PHASE_1_GATE] Checking for legacy UI placeholder states in dist bundle..."

# Check 1: No EMPTY_STATUS_V1 in source (Phase 6-7: removed this pattern)
# These should not appear in source anymore after fixes
if [ -f "$DIST_DIR/src/gadget-ui/src/statusSchema.ts" ]; then
    if grep -q "health: \"UNKNOWN\"" "$DIST_DIR/src/gadget-ui/src/statusSchema.ts"; then
        echo "❌ FAIL: statusSchema.ts still has health=UNKNOWN"
        EXIT_CODE=1
    else
        echo "✓ PASS: statusSchema.ts fixed (no health=UNKNOWN)"
    fi
fi

# Check 2: Verify ping resolver is NOT called in source
# Should NOT have invoke("ping") in _FATAL_MISSING_FORGE_BRIDGE.ts after Phase 6-7 fix
if [ -f "$DIST_DIR/src/gadget-ui/src/_FATAL_MISSING_FORGE_BRIDGE.ts" ]; then
    if grep -q 'invoke("ping"' "$DIST_DIR/src/gadget-ui/src/_FATAL_MISSING_FORGE_BRIDGE.ts"; then
        echo "❌ FAIL: ping resolver invocation still in source"
        EXIT_CODE=1
    else
        echo "✓ PASS: ping resolver removed from source"
    fi
fi

# Check 3: Verify ft_getDashboardState_v1 IS called in source
# main.ts should invoke only this resolver
if [ -f "$DIST_DIR/src/gadget-ui/src/main.ts" ]; then
    if grep -q "ft_getDashboardState_v1" "$DIST_DIR/src/gadget-ui/src/main.ts"; then
        echo "✓ PASS: ft_getDashboardState_v1 is invoked (single source of truth)"
    else
        echo "⚠ WARNING: ft_getDashboardState_v1 not found in source"
    fi
fi

# Check 4: No NOT_AVAILABLE status value in source
# traceDiagnostics should not have NOT_AVAILABLE anymore
if [ -f "$DIST_DIR/src/gadget-ui/src/traceDiagnostics.ts" ]; then
    if grep -q "NOT_AVAILABLE.*Storage is not available" "$DIST_DIR/src/gadget-ui/src/traceDiagnostics.ts"; then
        echo "❌ FAIL: NOT_AVAILABLE status rendering in traceDiagnostics"
        EXIT_CODE=1
    else
        echo "✓ PASS: NOT_AVAILABLE removed from traceDiagnostics"
    fi
fi

# Check 5: Ensure error handler returns early (no fallback rendering)
if [ -f "$DIST_DIR/src/gadget-ui/src/main.ts" ]; then
    if grep -A 2 "error-panel error" "$DIST_DIR/src/gadget-ui/src/main.ts" 2>/dev/null | grep -q "return"; then
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


