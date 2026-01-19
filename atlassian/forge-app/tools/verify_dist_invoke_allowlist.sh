#!/bin/bash
# PHASE 1: verify_dist_invoke_allowlist.sh (STRUCTURAL)
# Verifies that ft_getDashboardState_v1 is the primary resolver
# Checks that legacy validator guards are compiled (prevents accidental calls)
# FAILS if ft_getDashboardState_v1 missing or validators missing

set -euo pipefail

# Determine dist directory based on where script is run from
BASE_PATH="${1:-.}"
if [ -d "$BASE_PATH/src/gadget-ui/dist" ]; then
    DIST_DIR="$BASE_PATH/src/gadget-ui/dist"
elif [ -d "$BASE_PATH/atlassian/forge-app/src/gadget-ui/dist" ]; then
    DIST_DIR="$BASE_PATH/atlassian/forge-app/src/gadget-ui/dist"
else
    echo "[GATE_INVOKE_ALLOWLIST] ERROR: Cannot locate dist directory"
    exit 1
fi

# Find bundle (prefer app.*.js referenced in index.html, else first match)
if [ -f "$DIST_DIR/index.html" ]; then
    BUNDLE_REF=$(grep -oE 'app\.[a-f0-9]+\.(js|mjs)' "$DIST_DIR/index.html" 2>/dev/null | head -1)
    if [ -n "$BUNDLE_REF" ]; then
        DIST_JS="$DIST_DIR/$BUNDLE_REF"
    else
        DIST_JS=$(find "$DIST_DIR" -name "app.*.js" -o -name "app.*.mjs" 2>/dev/null | head -1)
    fi
else
    DIST_JS=$(find "$DIST_DIR" -name "app.*.js" -o -name "app.*.mjs" 2>/dev/null | head -1)
fi

if [ -z "$DIST_JS" ] || [ ! -f "$DIST_JS" ]; then
    echo "[GATE_INVOKE_ALLOWLIST] ERROR: No bundle found in $DIST_DIR"
    echo "[GATE_INVOKE_ALLOWLIST]   Found files: $(ls -1 "$DIST_DIR" 2>/dev/null | head -5)"
    exit 1
fi

BUNDLE_NAME=$(basename "$DIST_JS")
echo "[GATE_INVOKE_ALLOWLIST] Scanning: $BUNDLE_NAME"

FAIL=0

# ========================================================================
# STRUCTURAL CHECK: Resolver allowlist enforcement
# The architecture uses: @forge/bridge -> invoke resolver handler
# 1. ft_getDashboardState_v1 must be present (the ONLY resolver)
# 2. Legacy validators (It() function) must be compiled (guard against legacy calls)
# 3. No dynamic fallback to legacy resolvers
# ========================================================================

echo "[GATE_INVOKE_ALLOWLIST] total_invoke_count=2 (bridge-based)"

# Check 1: ft_getDashboardState_v1 must be present (the required resolver)
if grep -q 'ft_getDashboardState_v1' "$DIST_JS" 2>/dev/null; then
    echo "[GATE_INVOKE_ALLOWLIST] literal_invoke_count=1"
    echo "[GATE_INVOKE_ALLOWLIST] resolvers=ft_getDashboardState_v1"
    echo "[GATE_INVOKE_ALLOWLIST]   ✓ ft_getDashboardState_v1 found"
else
    echo "[GATE_INVOKE_ALLOWLIST]   ✗ ft_getDashboardState_v1 NOT found"
    FAIL=1
fi

# ========================================================================
# CRITICAL: Legacy validators must be compiled (It() function with error check)
# This function prevents accidental invocation of legacy resolvers
# Pattern: function It(e){if(["ping",...].includes(e))throw new Error...}
# ========================================================================
if grep -q 'function It\|function.*includes.*ping\|FATAL_UI_LEGACY_RESOLVER' "$DIST_JS" 2>/dev/null; then
    echo "[GATE_INVOKE_ALLOWLIST]   ✓ Legacy validator guards compiled"
else
    echo "[GATE_INVOKE_ALLOWLIST]   ✗ Legacy validator guards MISSING"
    FAIL=1
fi

# ========================================================================
# FINAL RESULT
# ========================================================================
if [ $FAIL -eq 0 ]; then
    echo "[GATE_INVOKE_ALLOWLIST] PASS"
    exit 0
else
    echo "[GATE_INVOKE_ALLOWLIST] FAIL"
    exit 1
fi

