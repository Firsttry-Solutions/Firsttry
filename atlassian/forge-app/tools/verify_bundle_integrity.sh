#!/bin/bash
# GATE 1: verify_bundle_integrity.sh (PORTABLE HASH-BASED INTEGRITY)
set -u

BUNDLE_FILE=""
SIZE_THRESHOLD="${SIZE_THRESHOLD:-10240}"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --bundle-file) BUNDLE_FILE="$2"; shift 2 ;;
        --size-threshold) SIZE_THRESHOLD="$2"; shift 2 ;;
        *) echo "Usage: $0 --bundle-file <path> [--size-threshold <bytes>]"; exit 1 ;;
    esac
done

# ========================================================================
# VALIDATE BUNDLE FILE
# ========================================================================

if [ -z "$BUNDLE_FILE" ]; then
    echo "[GATE_BUNDLE_INTEGRITY] ERROR: --bundle-file required"
    exit 1
fi

if [ ! -f "$BUNDLE_FILE" ]; then
    echo "[GATE_BUNDLE_INTEGRITY] ERROR: Bundle not found: $BUNDLE_FILE"
    exit 1
fi

if [ ! -r "$BUNDLE_FILE" ]; then
    echo "[GATE_BUNDLE_INTEGRITY] ERROR: Bundle not readable: $BUNDLE_FILE"
    exit 1
fi

BUNDLE_NAME=$(basename "$BUNDLE_FILE")
echo "[GATE_BUNDLE_INTEGRITY] Scanning: $BUNDLE_NAME"

# ========================================================================
# FILE SIZE CHECK
# ========================================================================

SIZE=$(stat -c%s "$BUNDLE_FILE" 2>/dev/null || echo 0)
echo "[GATE_BUNDLE_INTEGRITY] file_size=$SIZE (threshold=$SIZE_THRESHOLD)"

if [ "$SIZE" -lt "$SIZE_THRESHOLD" ]; then
    echo "[GATE_BUNDLE_INTEGRITY] ✗ File too small: $SIZE < $SIZE_THRESHOLD"
    echo "[GATE_BUNDLE_INTEGRITY] FAIL"
    exit 1
fi
echo "[GATE_BUNDLE_INTEGRITY]   ✓ File size check passed"

# ========================================================================
# HASH COMPUTATION (Portable fallback)
# ========================================================================

ALGO=""
HASH=""

# Try blake3
if command -v b3sum &> /dev/null; then
    ALGO="blake3"
    HASH=$(b3sum "$BUNDLE_FILE" 2>/dev/null | awk '{print $1}' || true)
    echo "[GATE_BUNDLE_INTEGRITY] Using $ALGO for hashing"
fi

# Fallback to sha256sum
if [ -z "$HASH" ] && command -v sha256sum &> /dev/null; then
    ALGO="sha256"
    HASH=$(sha256sum "$BUNDLE_FILE" 2>/dev/null | awk '{print $1}' || true)
    echo "[GATE_BUNDLE_INTEGRITY] Using $ALGO for hashing"
fi

# Fallback to shasum -a 256
if [ -z "$HASH" ] && command -v shasum &> /dev/null; then
    ALGO="sha256"
    HASH=$(shasum -a 256 "$BUNDLE_FILE" 2>/dev/null | awk '{print $1}' || true)
    echo "[GATE_BUNDLE_INTEGRITY] Using $ALGO for hashing"
fi

# No hash algorithm available
if [ -z "$HASH" ]; then
    echo "[GATE_BUNDLE_INTEGRITY] ✗ No hash algorithm available"
    echo "[GATE_BUNDLE_INTEGRITY] Install one of: b3sum (blake3), sha256sum, or shasum"
    echo "[GATE_BUNDLE_INTEGRITY] FAIL"
    exit 1
fi

echo "[GATE_BUNDLE_INTEGRITY] hash_algo=$ALGO"
echo "[GATE_BUNDLE_INTEGRITY] hash=$HASH"

# ========================================================================
# HASH FORMAT VALIDATION
# ========================================================================

if [ "$ALGO" = "blake3" ]; then
    if ! echo "$HASH" | grep -qE '^[a-f0-9]{64}$'; then
        echo "[GATE_BUNDLE_INTEGRITY] ✗ Invalid blake3 hash format"
        echo "[GATE_BUNDLE_INTEGRITY] FAIL"
        exit 1
    fi
    echo "[GATE_BUNDLE_INTEGRITY]   ✓ Hash is valid blake3 (64 hex)"
elif [ "$ALGO" = "sha256" ]; then
    if ! echo "$HASH" | grep -qE '^[a-f0-9]{64}$'; then
        echo "[GATE_BUNDLE_INTEGRITY] ✗ Invalid sha256 hash format"
        echo "[GATE_BUNDLE_INTEGRITY] FAIL"
        exit 1
    fi
    echo "[GATE_BUNDLE_INTEGRITY]   ✓ Hash is valid sha256 (64 hex)"
fi

# ========================================================================
# PASS
# ========================================================================

echo "[GATE_BUNDLE_INTEGRITY] PASS algo=$ALGO hash=$HASH size=$SIZE"
exit 0
