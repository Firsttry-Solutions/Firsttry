#!/bin/bash
# GATE 2: verify_dist_identity_labels.sh
set -u
BUNDLE_FILE=""
while [[ $# -gt 0 ]]; do
    case $1 in
        --bundle-file) BUNDLE_FILE="$2"; shift 2 ;;
        *) echo "Usage: $0 --bundle-file <path>"; exit 1 ;;
    esac
done
[ -n "$BUNDLE_FILE" ] || { echo "[GATE_IDENTITY_LABELS] ERROR: No bundle file"; exit 1; }
[ -f "$BUNDLE_FILE" ] || { echo "[GATE_IDENTITY_LABELS] ERROR: Bundle not found"; exit 1; }
BUNDLE_NAME=$(basename "$BUNDLE_FILE")
echo "[GATE_IDENTITY_LABELS] Scanning: $BUNDLE_NAME"
FAIL=0
ANCHOR_COUNT=$(grep -c 'FT_IDENTITY_ANCHOR_V1|git=' "$BUNDLE_FILE" 2>/dev/null || echo 0)
echo "[GATE_IDENTITY_LABELS] identity_anchors_count=$ANCHOR_COUNT"
if [ "$ANCHOR_COUNT" -ne 1 ]; then
    echo "[GATE_IDENTITY_LABELS] ✗ Must have exactly 1 anchor"
    FAIL=1
else
    echo "[GATE_IDENTITY_LABELS]   ✓ Exactly 1 anchor"
fi
ANCHOR_LINE=$(grep -oE 'FT_IDENTITY_ANCHOR_V1\|git=[a-f0-9]{7}\|bundle=[a-f0-9]{6,12}\|time=[^|"]+' "$BUNDLE_FILE" 2>/dev/null || true)
if [ -z "$ANCHOR_LINE" ]; then
    echo "[GATE_IDENTITY_LABELS] ✗ Anchor not found or malformed"
    FAIL=1
fi
if [ -n "$ANCHOR_LINE" ]; then
    GIT_SHA=$(echo "$ANCHOR_LINE" | grep -oE 'git=[a-f0-9]{7}' | sed 's/git=//' || true)
    BUNDLE_HASH=$(echo "$ANCHOR_LINE" | grep -oE 'bundle=[a-f0-9]{6,12}' | sed 's/bundle=//' || true)
    TIME=$(echo "$ANCHOR_LINE" | sed -E 's/.*time=([^ |"]+).*/\1/' || true)
    echo "[GATE_IDENTITY_LABELS] git_sha=$GIT_SHA"
    echo "[GATE_IDENTITY_LABELS] bundle_hash=$BUNDLE_HASH"
    echo "[GATE_IDENTITY_LABELS] build_time=$TIME"
    if [ -z "$GIT_SHA" ]; then
        echo "[GATE_IDENTITY_LABELS] ✗ git_sha NOT FOUND"
        FAIL=1
    else
        echo "[GATE_IDENTITY_LABELS]   ✓ git_sha valid"
    fi
    if [ -z "$BUNDLE_HASH" ]; then
        echo "[GATE_IDENTITY_LABELS] ✗ bundle_hash NOT FOUND"
        FAIL=1
    else
        echo "[GATE_IDENTITY_LABELS]   ✓ bundle_hash valid"
    fi
    if [ -z "$TIME" ] || [ "$TIME" = "UNSET" ]; then
        echo "[GATE_IDENTITY_LABELS] ✗ build_time invalid"
        FAIL=1
    else
        echo "[GATE_IDENTITY_LABELS]   ✓ build_time valid"
    fi
    if [ -n "$GIT_SHA" ] && [ -n "$BUNDLE_HASH" ] && [ "$GIT_SHA" = "$BUNDLE_HASH" ]; then
        echo "[GATE_IDENTITY_LABELS] ✗ DISTINCTNESS FAILED"
        FAIL=1
    else
        echo "[GATE_IDENTITY_LABELS]   ✓ git_sha != bundle_hash"
    fi
fi
if [ $FAIL -eq 0 ]; then
    echo "[GATE_IDENTITY_LABELS] PASS git=$GIT_SHA bundle=$BUNDLE_HASH time=$TIME"
    exit 0
else
    echo "[GATE_IDENTITY_LABELS] FAIL"
    exit 1
fi
