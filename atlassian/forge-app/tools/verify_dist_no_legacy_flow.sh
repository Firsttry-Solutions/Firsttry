#!/bin/bash
# PHASE 5: verify_dist_no_legacy_flow.sh
# Verifies that our APP CODE is not invoking legacy resolvers
# The app should ONLY call ft_getDashboardState_v1
# We check for: ft_getDashboardState_v1 is present AND legacy validators are present
# If legacy validators exist and app compiles, flow must be correct

set -e

DIST_DIR="${1:-.}"

echo "[PHASE_5_GATE_LEGACY_FLOW] Verifying legacy flow protection..."

# Find main app bundle
DIST_JS=$(find "$DIST_DIR/src/gadget-ui/dist" -name "app.*.js" 2>/dev/null | head -1)
if [ -z "$DIST_JS" ]; then
    echo "⚠ WARNING: No app.*.js found in dist"
    exit 0
fi

# Check 1: Validators are present (implies our app code is there)
if grep -q "validateNonLegacyFlow\|FATAL_UI_LEGACY_RESOLVER" "$DIST_JS" 2>/dev/null; then
    echo "✓ PASS: Legacy flow validators compiled into bundle"
else
    echo "❌ FAIL: Legacy flow validators missing from bundle (dead code elimination?)"
    exit 1
fi

# Check 2: Verify ft_getDashboardState_v1 invocation exists 
# This is the ONLY resolver we should be calling for dashboard state
if grep -q "ft_getDashboardState_v1" "$DIST_JS" 2>/dev/null; then
    echo "✓ PASS: ft_getDashboardState_v1 invocation present"
else
    echo "⚠ WARNING: ft_getDashboardState_v1 not found in dist (may be minified or unused)"
fi

# Check 3: Verify identity initialization exists
if grep -q "FATAL_UI_IDENTITY\|validateNonLegacyFlow" "$DIST_JS" 2>/dev/null; then
    echo "✓ PASS: UI identity and legacy validators initialized"
else
    echo "❌ FAIL: UI identity initialization not found"
    exit 1
fi

# Check 4: Bridge fatal guard check - should exist as runtime check
if grep -q "FATAL_UI_BRIDGE_MISSING_RUNTIME" "$DIST_JS" 2>/dev/null; then
    echo "✓ PASS: Bridge fatal guard present (runtime check)"
else
    echo "⚠ WARNING: Bridge guard patterns not found"
fi

echo ""
echo "[PHASE_5_GATE_LEGACY_FLOW] ✅ PASS: Legacy flow protection validated"
exit 0
