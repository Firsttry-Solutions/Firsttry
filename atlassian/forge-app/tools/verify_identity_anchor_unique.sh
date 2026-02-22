#!/bin/bash
#
# verify_identity_anchor_unique.sh
#
# BACKBONE GATE: Verify FT_IDENTITY_ANCHOR_V1 appears EXACTLY ONCE in dist bundle
#
# This ensures:
# 1. The anchor is present (proves build included it)
# 2. No duplicates exist (proves we use single canonical source)
#
# Exit codes:
#   0 = success (anchor present exactly once)
#   1 = violations (missing, duplicated, or too many occurrences)
#

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GADGET_DIST_DIR="$PROJECT_ROOT/src/gadget-ui/dist"

if [ ! -d "$GADGET_DIST_DIR" ]; then
  echo "[GATE_IDENTITY_ANCHOR] ERROR: Gadget dist directory not found: $GADGET_DIST_DIR" >&2
  exit 1
fi

# Find the dist bundle
BUNDLE_FILE=$(ls "$GADGET_DIST_DIR"/app.js 2>/dev/null | head -1)

if [ -z "$BUNDLE_FILE" ]; then
  echo "[GATE_IDENTITY_ANCHOR] ERROR: No app.js bundle found in $GADGET_DIST_DIR" >&2
  exit 1
fi

echo "[GATE_IDENTITY_ANCHOR] Scanning bundle: $(basename "$BUNDLE_FILE")"

# Count occurrences of the anchor marker (the prefix that should appear exactly once)
# We search for "FT_IDENTITY_ANCHOR_V1|git=" (the dynamic part) to find real anchors
ANCHOR_COUNT=$(grep -o "FT_IDENTITY_ANCHOR_V1|git=[0-9a-f]\{7\}" "$BUNDLE_FILE" | wc -l)

echo "[GATE_IDENTITY_ANCHOR] Found $ANCHOR_COUNT occurrence(s) of identity anchor"

if [ "$ANCHOR_COUNT" -eq 0 ]; then
  echo "[GATE_IDENTITY_ANCHOR] FAIL: Anchor not found in bundle" >&2
  echo "  Expected: FT_IDENTITY_ANCHOR_V1|git=<7hex chars>|bundle=..." >&2
  exit 1
fi

if [ "$ANCHOR_COUNT" -gt 1 ]; then
  echo "[GATE_IDENTITY_ANCHOR] FAIL: Anchor appears $ANCHOR_COUNT times (expected 1)" >&2
  echo "  This indicates duplicate/stale identity anchor definitions in source" >&2
  echo "  Fix: Ensure only ONE source defines the anchor (use buildIdentityAnchor() from ui_identity.ts)" >&2
  exit 1
fi

echo "[GATE_IDENTITY_ANCHOR] PASS: Anchor present exactly once"
exit 0
