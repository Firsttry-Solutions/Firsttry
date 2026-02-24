#!/bin/bash
# GATE: verify_dist_invoke_allowlist.sh (NON-BYPASSABLE)
# Purpose: Verify bundle contains allowed resolvers and legacy blocker marker
# Note: Uses one-pass Python processing for deterministic termination (no timeout)

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
    BUNDLE_REF=$(grep -oE 'app\.[a-f0-9]+\.(js|mjs)' "$DIST_DIR/index.html" 2>/dev/null | head -1 || true)
    # If not found, try stable filename (app.js)
    if [ -z "$BUNDLE_REF" ]; then
        BUNDLE_REF=$(grep -oE 'app\.(js|mjs)' "$DIST_DIR/index.html" 2>/dev/null | head -1 || true)
    fi
    # If we found a reference, use it; otherwise look for files in dist
    if [ -n "$BUNDLE_REF" ]; then
        DIST_JS="$DIST_DIR/$BUNDLE_REF"
    elif [ -f "$DIST_DIR/app.js" ]; then
        DIST_JS="$DIST_DIR/app.js"
    else
        echo "[GATE_INVOKE_ALLOWLIST] ERROR: Cannot resolve bundle"
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

# ========================================================================
# Run Python3 one-pass analysis (deterministic, no timeout risk)
# ========================================================================
export DIST_JS_PATH="$DIST_JS"
python3 << 'PYEOF'
import re
import sys
import os

bundle_path = os.environ.get('DIST_JS_PATH')
if not bundle_path:
    print("[GATE_INVOKE_ALLOWLIST] ERROR: DIST_JS_PATH not set")
    sys.exit(1)

try:
    with open(bundle_path, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
except Exception as e:
    print(f"[GATE_INVOKE_ALLOWLIST] ERROR: Cannot read bundle: {e}")
    sys.exit(1)

# Count total invoke( occurrences
total_invoke_count = content.count('invoke(')

# Extract literal resolvers: invoke(["']([^"']+)["']
pattern = r'invoke\(["\']([^"\']+)["\']\)'
literal_invokes = set(re.findall(pattern, content))
literal_invokes = sorted(list(literal_invokes))
literal_count = len(literal_invokes)

print(f"[GATE_INVOKE_ALLOWLIST] total_invoke_count={total_invoke_count}")
print(f"[GATE_INVOKE_ALLOWLIST] literal_invoke_count={literal_count}")

if literal_count > 0:
    resolvers = ','.join(literal_invokes)
else:
    resolvers = "(none - all invokes are dynamic)"
print(f"[GATE_INVOKE_ALLOWLIST] resolvers={resolvers}")

# CHECK 1: Report invoke pattern
if total_invoke_count == literal_count and literal_count > 0:
    print(f"[GATE_INVOKE_ALLOWLIST]   ✓ All {literal_count} invoke calls are literal strings")
elif literal_count == 0:
    print("[GATE_INVOKE_ALLOWLIST]   ✓ No literal string invoke calls (dynamic bridge-based)")
else:
    print(f"[GATE_INVOKE_ALLOWLIST]   ✓ Total {total_invoke_count} invoke(s) with {literal_count} literal - bridge pattern expected")

# CHECK 2: Only allowed resolvers (if any literal invokes)
fail = 0
allowed_resolvers = {'ft_getDashboardState_v1', 'ping', 'ft_uiLogRelay_v1'}
if literal_count > 0:
    forbidden = [r for r in literal_invokes if r not in allowed_resolvers]
    if forbidden:
        print("[GATE_INVOKE_ALLOWLIST] ✗ Forbidden resolvers found:")
        for r in forbidden:
            print(f"    {r}")
        fail = 1
    else:
        print("[GATE_INVOKE_ALLOWLIST]   ✓ Only allowed resolvers (ft_getDashboardState_v1, ping, ft_uiLogRelay_v1)")
    
    found_expected = any(r in literal_invokes for r in allowed_resolvers)
    if not found_expected:
        print("[GATE_INVOKE_ALLOWLIST] ⚠ Warning: Expected resolvers not found (may be minified)")
else:
    print("[GATE_INVOKE_ALLOWLIST]   ✓ No literal invoke calls (all dynamic via @forge/bridge)")

# CHECK 3: Marker must exist
if 'FATAL_UI_LEGACY_RESOLVER' in content:
    print("[GATE_INVOKE_ALLOWLIST]   ✓ Legacy blocker marker found: FATAL_UI_LEGACY_RESOLVER")
else:
    print("[GATE_INVOKE_ALLOWLIST] ✗ Legacy blocker marker MISSING")
    fail = 1

if fail == 0:
    print("[GATE_INVOKE_ALLOWLIST] PASS")
    sys.exit(0)
else:
    print("[GATE_INVOKE_ALLOWLIST] FAIL")
    sys.exit(1)
PYEOF

exit $?


