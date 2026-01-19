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

# Count occurrences of anchor DEFINITION (export const, not usage)
ANCHOR_DEFS=$(grep -r 'export const IDENTITY_ANCHOR_V1' "$SRC_DIR" 2>/dev/null | wc -l || echo 0)

echo "[GATE_SOURCE_ANCHOR_UNIQUE] anchor_definitions_found=$ANCHOR_DEFS"

if [ "$ANCHOR_DEFS" -eq 1 ]; then
    echo "[GATE_SOURCE_ANCHOR_UNIQUE]   ✓ Exactly 1 anchor definition in source"
    echo "[GATE_SOURCE_ANCHOR_UNIQUE] PASS"
    exit 0
else
    echo "[GATE_SOURCE_ANCHOR_UNIQUE] ✗ Expected exactly 1 anchor definition, found $ANCHOR_DEFS"
    echo "[GATE_SOURCE_ANCHOR_UNIQUE] Definitions:"
    grep -r 'export const IDENTITY_ANCHOR_V1' "$SRC_DIR" 2>/dev/null
    echo "[GATE_SOURCE_ANCHOR_UNIQUE] FAIL"
    exit 1
fi
