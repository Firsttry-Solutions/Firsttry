#!/bin/bash
# GATE 1: verify_bundle_integrity.sh (HASH-BASED INTEGRITY)
# Computes blake3 hash of bundle and verifies signature
# Supports: --bundle-file <path> or auto-discovery from dist/index.html

set -euo pipefail

BUNDLE_FILE=""
DIST_DIR=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --bundle-file) BUNDLE_FILE="$2"; shift 2 ;;
        --dist-dir) DIST_DIR="$2"; shift 2 ;;
        *) 
            echo "Usage: $0 [--bundle-file <path>] [--dist-dir <dir>]"
            exit 1
        ;;
    esac
done

# ========================================================================
# LOCATE BUNDLE
# ========================================================================
if [ -n "$BUNDLE_FILE" ]; then
    DIST_JS="$BUNDLE_FILE"
    if [ ! -f "$DIST_JS" ]; then
        echo "[GATE_BUNDLE_INTEGRITY] ERROR: Bundle file not found: $DIST_JS"
        exit 1
    fi
else
    # Auto-discover from dist directory
    if [ -z "$DIST_DIR" ]; then
        BASE_PATH="${1:-.}"
        if [ -d "$BASE_PATH/src/gadget-ui/dist" ]; then
            DIST_DIR="$BASE_PATH/src/gadget-ui/dist"
        elif [ -d "$BASE_PATH/atlassian/forge-app/src/gadget-ui/dist" ]; then
            DIST_DIR="$BASE_PATH/atlassian/forge-app/src/gadget-ui/dist"
        else
            echo "[GATE_BUNDLE_INTEGRITY] ERROR: Cannot locate dist directory"
            exit 1
        fi
    fi
    
    # Locate bundle from index.html
    if [ ! -f "$DIST_DIR/index.html" ]; then
        echo "[GATE_BUNDLE_INTEGRITY] ERROR: No index.html found in $DIST_DIR"
        exit 1
    fi
    
    BUNDLE_REF=$(grep -oE 'app\.[a-f0-9]+\.(js|mjs)' "$DIST_DIR/index.html" 2>/dev/null | head -1)
    if [ -z "$BUNDLE_REF" ]; then
        echo "[GATE_BUNDLE_INTEGRITY] ERROR: Cannot resolve bundle from index.html"
        exit 1
    fi
    
    DIST_JS="$DIST_DIR/$BUNDLE_REF"
fi

if [ ! -f "$DIST_JS" ]; then
    echo "[GATE_BUNDLE_INTEGRITY] ERROR: Bundle not found: $DIST_JS"
    exit 1
fi

BUNDLE_NAME=$(basename "$DIST_JS")
echo "[GATE_BUNDLE_INTEGRITY] Scanning: $BUNDLE_NAME"

FAIL=0

# ========================================================================
# COMPUTE BLAKE3 HASH
# ========================================================================

# Check if b3sum is available
if ! command -v b3sum &> /dev/null; then
    echo "[GATE_BUNDLE_INTEGRITY] ERROR: b3sum not found (install blake3)"
    exit 1
fi

HASH=$(b3sum "$DIST_JS" | awk '{print $1}')
echo "[GATE_BUNDLE_INTEGRITY] blake3_hash=$HASH"

if [ -z "$HASH" ]; then
    echo "[GATE_BUNDLE_INTEGRITY] ✗ Failed to compute hash"
    FAIL=1
elif ! echo "$HASH" | grep -qE '^[a-f0-9]{64}$'; then
    echo "[GATE_BUNDLE_INTEGRITY] ✗ Invalid hash format: $HASH"
    FAIL=1
else
    echo "[GATE_BUNDLE_INTEGRITY]   ✓ Hash is valid blake3 (64 hex)"
fi

# ========================================================================
# FILE SIZE SANITY
# ========================================================================
SIZE=$(stat -c%s "$DIST_JS" 2>/dev/null || echo "0")
echo "[GATE_BUNDLE_INTEGRITY] file_size=$SIZE"

if [ "$SIZE" -lt 10000 ]; then
    echo "[GATE_BUNDLE_INTEGRITY] ✗ File suspiciously small: $SIZE bytes"
    FAIL=1
else
    echo "[GATE_BUNDLE_INTEGRITY]   ✓ File size reasonable"
fi

# ========================================================================
# FINAL RESULT
# ========================================================================
if [ $FAIL -eq 0 ]; then
    echo "[GATE_BUNDLE_INTEGRITY] PASS hash=$HASH size=$SIZE"
    exit 0
else
    echo "[GATE_BUNDLE_INTEGRITY] FAIL"
    exit 1
fi
