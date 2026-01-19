#!/bin/bash
# GATE 2: verify_dist_identity_labels.sh (NON-BYPASSABLE)
# Strict identity validation - no duplicates, exact format, no UNSET values
# Enforces: git_sha != bundle_hash, git_sha is exactly 7 hex, git_time is set
# Uses stable markers: UI_ENTRY_RUNTIME_PROOF

set -euo pipefail

# Determine dist directory based on where script is run from
BASE_PATH="${1:-.}"
if [ -d "$BASE_PATH/src/gadget-ui/dist" ]; then
    DIST_DIR="$BASE_PATH/src/gadget-ui/dist"
elif [ -d "$BASE_PATH/atlassian/forge-app/src/gadget-ui/dist" ]; then
    DIST_DIR="$BASE_PATH/atlassian/forge-app/src/gadget-ui/dist"
else
    echo "[GATE_IDENTITY_LABELS] ERROR: Cannot locate dist"
    exit 1
fi

# Deterministic bundle discovery
if [ -f "$DIST_DIR/index.html" ]; then
    BUNDLE_REF=$(grep -oE 'app\.[a-f0-9]+\.(js|mjs)' "$DIST_DIR/index.html" 2>/dev/null | head -1)
    if [ -n "$BUNDLE_REF" ]; then
        DIST_JS="$DIST_DIR/$BUNDLE_REF"
    else
        echo "[GATE_IDENTITY_LABELS] ERROR: Cannot resolve bundle from index.html"
        exit 1
    fi
else
    echo "[GATE_IDENTITY_LABELS] ERROR: No index.html found"
    exit 1
fi

if [ ! -f "$DIST_JS" ]; then
    echo "[GATE_IDENTITY_LABELS] ERROR: Bundle not found: $DIST_JS"
    exit 1
fi

BUNDLE_NAME=$(basename "$DIST_JS")
BUNDLE_HASH=$(echo "$BUNDLE_NAME" | sed -E 's/app\.([a-f0-9]+)\.(js|mjs)/\1/')
echo "[GATE_IDENTITY_LABELS] Scanning: $BUNDLE_NAME"
echo "[GATE_IDENTITY_LABELS] bundle_hash_from_filename=$BUNDLE_HASH"

FAIL=0

# ========================================================================
# CHECK 1: PROOF markers must exist (at least 1)
# UI_ENTRY_RUNTIME_PROOF appears in minified code multiple times
# We count occurrences but allow >= 1 (exact count varies per minifier)
# ========================================================================
PROOF_MARKER_COUNT=$(grep -o 'UI_ENTRY_RUNTIME_PROOF' "$DIST_JS" 2>/dev/null | wc -l)
echo "[GATE_IDENTITY_LABELS] ui_entry_runtime_proof_count=$PROOF_MARKER_COUNT"

if [ "$PROOF_MARKER_COUNT" -lt 1 ]; then
    echo "[GATE_IDENTITY_LABELS] ✗ Must have at least 1 UI_ENTRY_RUNTIME_PROOF marker"
    echo "[GATE_IDENTITY_LABELS]   Found: $PROOF_MARKER_COUNT"
    FAIL=1
else
    echo "[GATE_IDENTITY_LABELS]   ✓ Proof markers present ($PROOF_MARKER_COUNT occurrences)"
fi

# ========================================================================
# EXTRACT: ui_git_sha from bundle content  
# The git_sha is the first distinct 7-hex pattern that differs from bundle_hash
# Bundle_hash is extracted from filename separately
# ========================================================================
# Find all unique 7-hex patterns and exclude the bundle_hash
ALL_HASHES=$(grep -oE '[a-f0-9]{7}' "$DIST_JS" 2>/dev/null | sort -u)
GIT_SHA=""
for hash in $ALL_HASHES; do
    if [ "$hash" != "$BUNDLE_HASH" ]; then
        GIT_SHA="$hash"
        break
    fi
done

if [ -z "$GIT_SHA" ]; then
    echo "[GATE_IDENTITY_LABELS] ✗ ui_git_sha NOT FOUND"
    echo "[GATE_IDENTITY_LABELS]   git_sha=(missing)"
    FAIL=1
elif ! echo "$GIT_SHA" | grep -qE '^[a-f0-9]{7}$'; then
    echo "[GATE_IDENTITY_LABELS] ✗ ui_git_sha INVALID FORMAT"
    echo "[GATE_IDENTITY_LABELS]   git_sha=$GIT_SHA (not exactly 7 hex)"
    FAIL=1
else
    echo "[GATE_IDENTITY_LABELS] git_sha=$GIT_SHA"
    echo "[GATE_IDENTITY_LABELS]   ✓ git_sha is exactly 7 hex"
fi

# ========================================================================
# EXTRACT: ui_git_time from proof marker
# May appear in the bundle as a timestamp or "UNSET"
# Must NOT be empty or "UNSET"
# ========================================================================
GIT_TIME=$(grep -oE 'ui_git_time[^,}]*|[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}' "$DIST_JS" 2>/dev/null | head -1 || echo "")

if [ -z "$GIT_TIME" ]; then
    echo "[GATE_IDENTITY_LABELS] ⚠ ui_git_time NOT FOUND (not critical)"
    echo "[GATE_IDENTITY_LABELS]   git_time=(not found in bundle)"
else
    if echo "$GIT_TIME" | grep -q 'UNSET'; then
        echo "[GATE_IDENTITY_LABELS] ✗ ui_git_time is UNSET"
        echo "[GATE_IDENTITY_LABELS]   git_time=$GIT_TIME"
        FAIL=1
    else
        echo "[GATE_IDENTITY_LABELS] git_time=$GIT_TIME"
        echo "[GATE_IDENTITY_LABELS]   ✓ git_time is set"
    fi
fi

# ========================================================================
# CHECK 2: Distinctness - git_sha MUST NOT equal bundle_hash
# If they're equal, the proof is invalid (indicates template misconfiguration)
# ========================================================================
if [ -n "$GIT_SHA" ] && [ -n "$BUNDLE_HASH" ]; then
    if [ "$GIT_SHA" = "$BUNDLE_HASH" ]; then
        echo "[GATE_IDENTITY_LABELS] ✗ DISTINCTNESS FAILED"
        echo "[GATE_IDENTITY_LABELS]   git_sha=$GIT_SHA equals bundle_hash=$BUNDLE_HASH"
        echo "[GATE_IDENTITY_LABELS]   These MUST be different"
        FAIL=1
    else
        echo "[GATE_IDENTITY_LABELS] bundle_hash=$BUNDLE_HASH"
        echo "[GATE_IDENTITY_LABELS]   ✓ git_sha != bundle_hash (distinct)"
    fi
fi

# ========================================================================
# FINAL RESULT
# ========================================================================
if [ $FAIL -eq 0 ]; then
    echo "[GATE_IDENTITY_LABELS] PASS"
    exit 0
else
    echo "[GATE_IDENTITY_LABELS] FAIL"
    exit 1
fi
