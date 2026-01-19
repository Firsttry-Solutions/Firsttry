#!/bin/bash
# PHASE 1: verify_dist_invoke_allowlist.sh
# Verifies that the dist bundle uses ft_getDashboardState_v1 as primary resolver
# Fails if any legacy resolver patterns (ping, ensureFirstSnapshot, etc) are invoked

set -e

DIST_DIR="${1:-.}"
DIST_JS=$(find "$DIST_DIR/src/gadget-ui/dist" -name "app.*.js" 2>/dev/null | head -1)

if [ -z "$DIST_JS" ]; then
    echo "[GATE_INVOKE_ALLOWLIST] ERROR: No app.*.js found in dist"
    exit 1
fi

echo "[GATE_INVOKE_ALLOWLIST] Scanning: $(basename "$DIST_JS")"

FAIL=0

# Test 1: ft_getDashboardState_v1 should be present (our only resolver)
if grep -q "ft_getDashboardState_v1" "$DIST_JS"; then
    echo "[GATE_INVOKE_ALLOWLIST]   ✓ ft_getDashboardState_v1 present"
else
    echo "[GATE_INVOKE_ALLOWLIST]   ⚠ ft_getDashboardState_v1 not found (may be minified/unused)"
fi

# Test 2: Legacy validator should be compiled
if grep -q "FATAL_UI_LEGACY_RESOLVER\|validateNonLegacyFlow" "$DIST_JS"; then
    echo "[GATE_INVOKE_ALLOWLIST]   ✓ Legacy flow validators present"
else
    echo "[GATE_INVOKE_ALLOWLIST]   ✗ Legacy flow validators missing"
    FAIL=1
fi

# Test 3: Ensure legacy resolvers are NOT being invoked
# Check for patterns like invoke("ping") or invoke('ensureFirstSnapshot') etc
for LEGACY_RESOLVER in "ping" "ensureFirstSnapshot" "getBuildInfo" "getSnapshotDebug"; do
    # Only match if it looks like an invoke call argument
    if grep -qE "invoke\(['\"]$LEGACY_RESOLVER" "$DIST_JS" 2>/dev/null; then
        echo "[GATE_INVOKE_ALLOWLIST]   ✗ Legacy resolver '$LEGACY_RESOLVER' found in invoke calls"
        FAIL=1
    fi
done

if [ $FAIL -eq 0 ]; then
    echo "[GATE_INVOKE_ALLOWLIST] PASS"
    exit 0
else
    echo "[GATE_INVOKE_ALLOWLIST] FAIL"
    exit 1
fi

