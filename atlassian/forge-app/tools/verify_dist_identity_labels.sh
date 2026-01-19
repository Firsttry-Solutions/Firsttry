#!/bin/bash
# PHASE 2: verify_dist_identity_labels.sh (STRUCTURAL - NO "PRESENCE ONLY")
# Extracts identity labels from known proof markers
# Enforces distinctness and format validation
# FAILS if markers missing, invalid format, or values identical

set -euo pipefail

# Determine dist directory based on where script is run from
BASE_PATH="${1:-.}"
if [ -d "$BASE_PATH/src/gadget-ui/dist" ]; then
    DIST_DIR="$BASE_PATH/src/gadget-ui/dist"
elif [ -d "$BASE_PATH/atlassian/forge-app/src/gadget-ui/dist" ]; then
    DIST_DIR="$BASE_PATH/atlassian/forge-app/src/gadget-ui/dist"
else
    echo "[GATE_IDENTITY_LABELS] ERROR: Cannot locate dist directory"
    exit 1
fi

# Find bundle (prefer app.*.js referenced in index.html, else first match)
if [ -f "$DIST_DIR/index.html" ]; then
    BUNDLE_REF=$(grep -oE 'app\.[a-f0-9]+\.(js|mjs)' "$DIST_DIR/index.html" 2>/dev/null | head -1)
    if [ -n "$BUNDLE_REF" ]; then
        DIST_JS="$DIST_DIR/$BUNDLE_REF"
        FILENAME="$BUNDLE_REF"
    else
        DIST_JS=$(find "$DIST_DIR" -name "app.*.js" -o -name "app.*.mjs" 2>/dev/null | head -1)
        FILENAME=$(basename "$DIST_JS")
    fi
else
    DIST_JS=$(find "$DIST_DIR" -name "app.*.js" -o -name "app.*.mjs" 2>/dev/null | head -1)
    FILENAME=$(basename "$DIST_JS")
fi

if [ -z "$DIST_JS" ] || [ ! -f "$DIST_JS" ]; then
    echo "[GATE_IDENTITY_LABELS] ERROR: No bundle found in $DIST_DIR"
    exit 1
fi

echo "[GATE_IDENTITY_LABELS] Checking: $FILENAME"

FAIL=0

# ========================================================================
# EXTRACT: UI_BUNDLE_HASH from filename (app.<hash>.js)
# Format: 6-12 hex characters
# ========================================================================
BUNDLE_HASH=$(echo "$FILENAME" | sed -E 's/app\.([a-f0-9]+)\..*/\1/')
if ! echo "$BUNDLE_HASH" | grep -qE '^[a-f0-9]{6,12}$'; then
    echo "[GATE_IDENTITY_LABELS] FAIL: Invalid bundle hash from filename"
    echo "[GATE_IDENTITY_LABELS]   filename=$FILENAME"
    echo "[GATE_IDENTITY_LABELS]   extracted=$BUNDLE_HASH"
    exit 1
fi
echo "[GATE_IDENTITY_LABELS]   ✓ bundle_hash=$BUNDLE_HASH (from filename)"

# ========================================================================
# EXTRACT: UI_GIT_SHA from known proof marker
# Search for UI_ENTRY_RUNTIME_PROOF or UI_BOOT_PROOF JSON markers
# Then extract ui_git_sha":"<7-hex> or ui_git_sha:e,"<7-hex> (minified)
# ========================================================================

# First, check that proof markers exist
if ! grep -q 'UI_ENTRY_RUNTIME_PROOF\|UI_BOOT_PROOF' "$DIST_JS" 2>/dev/null; then
    echo "[GATE_IDENTITY_LABELS] FAIL: No proof markers found (UI_ENTRY_RUNTIME_PROOF or UI_BOOT_PROOF)"
    FAIL=1
fi

# Extract UI_GIT_SHA from the bundle
# Look for patterns like: "ui_git_sha":"86bdc7b" or ui_git_sha:e,"86bdc7b" (minified)
# Strategy: Search for quoted 7-hex patterns that look like git SHAs
GIT_SHA=$(grep -oE '[":=,]([a-f0-9]{7})[",;]' "$DIST_JS" 2>/dev/null | grep -oE '[a-f0-9]{7}' | sort -u | head -1 || echo "")

if [ -z "$GIT_SHA" ]; then
    echo "[GATE_IDENTITY_LABELS] FAIL: UI_GIT_SHA not found in proof markers"
    FAIL=1
fi

# Validate format (must be 7 hex characters)
if [ -n "$GIT_SHA" ] && ! echo "$GIT_SHA" | grep -qE '^[a-f0-9]{7}$'; then
    echo "[GATE_IDENTITY_LABELS] FAIL: UI_GIT_SHA invalid format: $GIT_SHA"
    FAIL=1
fi

if [ -n "$GIT_SHA" ]; then
    echo "[GATE_IDENTITY_LABELS]   ✓ git_sha=$GIT_SHA (from dist content)"
fi

# ========================================================================
# EXTRACT: UI_GIT_TIME from proof marker
# Should NOT be UNSET
# ========================================================================
GIT_TIME=$(grep -oE 'ui_git_time[^,}]*' "$DIST_JS" 2>/dev/null | head -1 || echo "")
if [ -n "$GIT_TIME" ] && echo "$GIT_TIME" | grep -q 'UNSET'; then
    echo "[GATE_IDENTITY_LABELS] FAIL: UI_GIT_TIME is UNSET"
    FAIL=1
elif [ -z "$GIT_TIME" ]; then
    echo "[GATE_IDENTITY_LABELS] WARN: UI_GIT_TIME not found"
else
    echo "[GATE_IDENTITY_LABELS]   ✓ git_time present (not UNSET)"
fi

# ========================================================================
# ENFORCE: UI_GIT_SHA != UI_BUNDLE_HASH (must be distinct)
# ========================================================================
if [ -n "$GIT_SHA" ] && [ -n "$BUNDLE_HASH" ]; then
    if [ "$GIT_SHA" = "$BUNDLE_HASH" ]; then
        echo "[GATE_IDENTITY_LABELS] FAIL: UI_GIT_SHA and UI_BUNDLE_HASH cannot be identical"
        echo "[GATE_IDENTITY_LABELS]   git_sha=$GIT_SHA"
        echo "[GATE_IDENTITY_LABELS]   bundle_hash=$BUNDLE_HASH"
        FAIL=1
    else
        echo "[GATE_IDENTITY_LABELS]   ✓ git_sha != bundle_hash (distinct)"
    fi
fi

# ========================================================================
# FINAL RESULT
# ========================================================================
if [ $FAIL -eq 0 ]; then
    echo "[GATE_IDENTITY_LABELS] PASS"
    echo "ui_git_sha=$GIT_SHA"
    echo "ui_git_time=$GIT_TIME"
    echo "ui_bundle_hash=$BUNDLE_HASH"
    exit 0
else
    echo "[GATE_IDENTITY_LABELS] FAIL"
    exit 1
fi
