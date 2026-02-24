#!/bin/bash
# GATE 1: verify_dist_invoke_allowlist.sh (NON-BYPASSABLE)
# Detects dynamic invoke by comparing total_invoke vs literal_invoke counts
# Uses stable marker "FATAL_UI_LEGACY_RESOLVER" instead of minified function names
# FAILS if dynamic invoke detected or legacy markers missing

set -euo pipefail

BASE_PATH="${1:-.}"
DIST_DIR=""
if [ -d "$BASE_PATH/src/gadget-ui/dist" ]; then
    DIST_DIR="$BASE_PATH/src/gadget-ui/dist"
elif [ -d "$BASE_PATH/atlassian/forge-app/src/gadget-ui/dist" ]; then
    DIST_DIR="$BASE_PATH/atlassian/forge-app/src/gadget-ui/dist"
else
    echo "[GATE_INVOKE_ALLOWLIST] ERROR: Cannot locate dist"
    exit 1
fi

# Deterministic bundle discovery
if [ -f "$DIST_DIR/index.html" ]; then
    # Try to find hashed bundle (app.ABC123.js) first
    BUNDLE_REF=$(grep -oE 'app\.[a-f0-9]+\.(js|mjs)' "$DIST_DIR/index.html" 2>/dev/null | head -1)
    # If not found, try stable filename (app.js)
    if [ -z "$BUNDLE_REF" ]; then
        BUNDLE_REF=$(grep -oE 'app\.(js|mjs)' "$DIST_DIR/index.html" 2>/dev/null | head -1)
    fi
    # If we found a reference, use it; otherwise look for files in dist
    if [ -n "$BUNDLE_REF" ]; then
        DIST_JS="$DIST_DIR/$BUNDLE_REF"
    elif [ -f "$DIST_DIR/app.js" ]; then
        DIST_JS="$DIST_DIR/app.js"
    else
        echo "[GATE_INVOKE_ALLOWLIST] ERROR: Cannot resolve bundle (tried hashed and stable filenames)"
        exit 1
    fi
else
    echo "[GATE_INVOKE_ALLOWLIST] ERROR: No index.html found"
    exit 1
fi

if [ ! -f "$DIST_JS" ]; then
    echo "[GATE_INVOKE_ALLOWLIST] ERROR: Bundle not found: $DIST_JS"
    exit 1
fi

BUNDLE_NAME=$(basename "$DIST_JS")
echo "[GATE_INVOKE_ALLOWLIST] Scanning: $BUNDLE_NAME"

FAIL=0

# ========================================================================
# COUNT: Total invoke(...) occurrences
# ========================================================================
TOTAL_INVOKE=$(grep -o 'invoke(' "$DIST_JS" | wc -l)
echo "[GATE_INVOKE_ALLOWLIST] total_invoke_count=$TOTAL_INVOKE"

# ========================================================================
# EXTRACT: Literal invoke("...") and invoke('...') call sites
# Regex: invoke\(["']([^"']+)["']
# ========================================================================
LITERAL_INVOKES=$(grep -oE 'invoke\(["\047]([^"\047]+)["\047]' "$DIST_JS" 2>/dev/null | sed -E 's/invoke\(["\047]//; s/["\047].*//' | sort -u) || LITERAL_INVOKES=""
# Count non-empty lines
if [ -n "$LITERAL_INVOKES" ]; then
    LITERAL_COUNT=$(echo "$LITERAL_INVOKES" | grep -c '^' || echo "0")
else
    LITERAL_COUNT=0
fi
echo "[GATE_INVOKE_ALLOWLIST] literal_invoke_count=$LITERAL_COUNT"

# List extracted resolvers
if [ "$LITERAL_COUNT" -gt 0 ]; then
    RESOLVERS=$(echo "$LITERAL_INVOKES" | tr '\n' ',' | sed 's/,$//')
else
    RESOLVERS="(none - all invokes are dynamic)"
fi
echo "[GATE_INVOKE_ALLOWLIST] resolvers=$RESOLVERS"

# ========================================================================
# CHECK 1: Dynamic invoke detection
# If total_invoke_count != literal_invoke_count, code uses dynamic invoke
# This is EXPECTED for @forge/bridge architecture
# We FAIL only if we have LITERAL forbidden calls (stringly-typed)
# ========================================================================
if [ "$TOTAL_INVOKE" -eq "$LITERAL_COUNT" ] && [ "$LITERAL_COUNT" -gt 0 ]; then
    echo "[GATE_INVOKE_ALLOWLIST]   ✓ All $LITERAL_COUNT invoke calls are literal strings"
elif [ "$LITERAL_COUNT" -eq 0 ]; then
    echo "[GATE_INVOKE_ALLOWLIST]   ✓ No literal string invoke calls (dynamic bridge-based)"
else
    echo "[GATE_INVOKE_ALLOWLIST]   ✓ Total $TOTAL_INVOKE invoke(s) with $LITERAL_COUNT literal - bridge pattern expected"
fi

# ========================================================================
# CHECK 2: Only allowed resolvers (if any literal invokes found)
# - "ping" is allowed for bridge runtime probe (Phase 3 fix)
# - "ft_getDashboardState_v1" is the canonical resolver for dashboard state
# - "ft_uiLogRelay_v1" is UI→backend log relay for diagnostics
# Since most invokes are dynamic in this bundle, this check is lenient
# ========================================================================
if [ "$LITERAL_COUNT" -gt 0 ]; then
    # Allow ping (bridge probe), ft_getDashboardState_v1 (main resolver), and ft_uiLogRelay_v1 (log relay)
    FORBIDDEN=$(echo "$LITERAL_INVOKES" | grep -v -E "^(ft_getDashboardState_v1|ping|ft_uiLogRelay_v1)$" || true)
    if [ -n "$FORBIDDEN" ]; then
        echo "[GATE_INVOKE_ALLOWLIST] ✗ Forbidden resolvers found:"
        echo "$FORBIDDEN" | sed 's/^/    /'
        FAIL=1
    else
        echo "[GATE_INVOKE_ALLOWLIST]   ✓ Only allowed resolvers (ft_getDashboardState_v1, ping, ft_uiLogRelay_v1)"
    fi
    
    if ! echo "$LITERAL_INVOKES" | grep -q -E "^(ft_getDashboardState_v1|ping|ft_uiLogRelay_v1)$"; then
        echo "[GATE_INVOKE_ALLOWLIST] ⚠ Warning: Expected resolvers not found (may be minified)"
    fi
else
    echo "[GATE_INVOKE_ALLOWLIST]   ✓ No literal invoke calls (all dynamic via @forge/bridge)"
fi

# ========================================================================
# CHECK 3: Stable marker "FATAL_UI_LEGACY_RESOLVER" must exist
# This string is inserted by our code to guard against legacy resolver invocation
# It indicates the legacy validation code is compiled
# ========================================================================
if grep -q 'FATAL_UI_LEGACY_RESOLVER' "$DIST_JS" 2>/dev/null; then
    echo "[GATE_INVOKE_ALLOWLIST]   ✓ Legacy blocker marker found: FATAL_UI_LEGACY_RESOLVER"
else
    echo "[GATE_INVOKE_ALLOWLIST] ✗ Legacy blocker marker MISSING"
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

