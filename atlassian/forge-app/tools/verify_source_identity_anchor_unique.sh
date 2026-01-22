#!/bin/bash
# GATE 3: verify_source_identity_anchor_unique.sh (SOURCE-LEVEL ANCHOR UNIQUENESS)
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_DIR="$SCRIPT_DIR/../src/gadget-ui/src"

if [ ! -d "$SRC_DIR" ]; then
    echo "[GATE_SOURCE_ANCHOR_UNIQUE] ERROR: Source directory not found: $SRC_DIR"
    echo "[GATE_SOURCE_ANCHOR_UNIQUE] FAIL"
    exit 1
fi

echo "[GATE_SOURCE_ANCHOR_UNIQUE] Checking source code for anchor uniqueness"
echo "[GATE_SOURCE_ANCHOR_UNIQUE] Source directory: $SRC_DIR"

# Check for createIdentityAnchor function definition (should exist exactly once)
# Also check for stale static exports (should not exist)
ANCHOR_FUNC=$(grep -r 'export function createIdentityAnchor' "$SRC_DIR" 2>/dev/null | wc -l || echo 0)
STALE_EXPORTS=$(grep -r 'export const IDENTITY_ANCHOR_V1' "$SRC_DIR" 2>/dev/null | wc -l || echo 0)

echo "[GATE_SOURCE_ANCHOR_UNIQUE] createIdentityAnchor_functions=$ANCHOR_FUNC"
echo "[GATE_SOURCE_ANCHOR_UNIQUE] stale_IDENTITY_ANCHOR_V1_exports=$STALE_EXPORTS"

FAIL=0

if [ "$ANCHOR_FUNC" -ne 1 ]; then
    echo "[GATE_SOURCE_ANCHOR_UNIQUE] ✗ Expected exactly 1 createIdentityAnchor function, found $ANCHOR_FUNC"
    FAIL=1
else
    echo "[GATE_SOURCE_ANCHOR_UNIQUE]   ✓ Exactly 1 createIdentityAnchor function"
fi

if [ "$STALE_EXPORTS" -gt 0 ]; then
    echo "[GATE_SOURCE_ANCHOR_UNIQUE] ✗ Found stale IDENTITY_ANCHOR_V1 static exports (should be 0):"
    grep -r 'export const IDENTITY_ANCHOR_V1' "$SRC_DIR" 2>/dev/null
    FAIL=1
else
    echo "[GATE_SOURCE_ANCHOR_UNIQUE]   ✓ No stale static IDENTITY_ANCHOR_V1 exports"
fi

if [ $FAIL -eq 0 ]; then
    echo "[GATE_SOURCE_ANCHOR_UNIQUE] PASS"
    exit 0
else
    echo "[GATE_SOURCE_ANCHOR_UNIQUE] FAIL"
    exit 1
fi
