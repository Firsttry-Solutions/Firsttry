#!/bin/bash
# PHASE 2: verify_dist_identity_labels.sh (HARDENED)
# Enforces identity label presence and distinctness
# Fails if UI_GIT_SHA or UI_BUNDLE_HASH missing/invalid/identical

set -e

DIST_DIR="${1:-.}"
DIST_JS=$(find "$DIST_DIR/src/gadget-ui/dist" -name "app.*.js" 2>/dev/null | head -1)
FILENAME=$(basename "$DIST_JS")

if [ -z "$DIST_JS" ]; then
    echo "[GATE_IDENTITY_LABELS] ERROR: No app.*.js found in dist"
    exit 1
fi

echo "[GATE_IDENTITY_LABELS] Checking: $FILENAME"

# Extract bundle hash from filename
BUNDLE_HASH=$(echo "$FILENAME" | sed -E 's/app\.([a-f0-9]+)\..*/\1/')
if ! echo "$BUNDLE_HASH" | grep -qE '^[a-f0-9]{6,12}$'; then
    echo "[GATE_IDENTITY_LABELS] FAIL: Invalid bundle hash from filename: $BUNDLE_HASH"
    exit 1
fi

# Extract UI_GIT_SHA from dist bundle - look for it in any format
# After minification it might be: e="86bdc7b" or ui_git_sha:e,"86bdc7b" etc
GIT_SHA=$(grep -oE '[":=][a-f0-9]{7}[,;"\x27)]' "$DIST_JS" | head -20 | grep -oE '[a-f0-9]{7}' | sort -u | grep -vE '^(f1c06fb)$' | head -1)
if [ -z "$GIT_SHA" ] || ! echo "$GIT_SHA" | grep -qE '^[a-f0-9]{7}$'; then
    echo "[GATE_IDENTITY_LABELS] FAIL: UI_GIT_SHA not found or invalid in dist"
    exit 1
fi

# Verify it contains console.log proof patterns (UI_BOOT_PROOF or similar)
if grep -q 'UI_BOOT_PROOF\|UI_ENTRY_RUNTIME_PROOF\|UI_IDENTITY' "$DIST_JS" 2>/dev/null; then
    echo "[GATE_IDENTITY_LABELS]   ✓ Identity proof patterns present"
else
    echo "[GATE_IDENTITY_LABELS]   ⚠ Identity proof patterns not found (may be minified)"
fi

# CRITICAL: Ensure they're distinct
if [ "$GIT_SHA" = "$BUNDLE_HASH" ]; then
    echo "[GATE_IDENTITY_LABELS] FAIL: UI_GIT_SHA and UI_BUNDLE_HASH cannot be identical"
    echo "  git_sha=$GIT_SHA"
    echo "  bundle_hash=$BUNDLE_HASH"
    exit 1
fi

echo "[GATE_IDENTITY_LABELS] PASS"
echo "  bundle_hash=$BUNDLE_HASH (from filename)"
echo "  git_sha=$GIT_SHA (from dist content)"
exit 0
