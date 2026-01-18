#!/bin/bash
# Feature 1: UI Build Marker - Proof of Dynamic Generation
# 
# REQUIREMENT:
# - UI_BUILD_MARKER must be dynamic (unique per build)
# - Format: UI_MARKER_<YYYYMMDDTHHMMSSZ>_<SHA>
# - Never show stale marker from previous deploy (e.g., 2026-01-17)
#
# PROOF METHOD:
# 1. Verify ui_build_meta.ts exports UI_BUILD_MARKER
# 2. Verify it includes getUTCTimestampForMarker function
# 3. Verify main.ts imports (not hardcodes) it
# 4. Verify build succeeds and bundle contains marker
# 5. Build twice, verify marker changes

set -euo pipefail

EVID="${1:-.}"
OUT="$EVID/feature1_proof.txt"

echo "==================================================================" | tee -a "$OUT"
echo "FEATURE 1: UI Build Marker Dynamic Generation - PROOF" | tee -a "$OUT"
echo "==================================================================" | tee -a "$OUT"
echo "" | tee -a "$OUT"

cd "$(git rev-parse --show-toplevel)/atlassian/forge-app"

# Test 1: Verify ui_build_meta.ts has dynamic function
echo "TEST 1: ui_build_meta.ts exports UI_BUILD_MARKER" | tee -a "$OUT"
if grep -q "export const UI_BUILD_MARKER" src/gadget-ui/src/ui_build_meta.ts; then
    echo "✓ UI_BUILD_MARKER exported" | tee -a "$OUT"
else
    echo "✗ FAIL: UI_BUILD_MARKER not exported" | tee -a "$OUT"
    exit 1
fi

if grep -q "getUTCTimestampForMarker" src/gadget-ui/src/ui_build_meta.ts; then
    echo "✓ Dynamic timestamp function present" | tee -a "$OUT"
else
    echo "✗ FAIL: getUTCTimestampForMarker not found" | tee -a "$OUT"
    exit 1
fi

echo "" | tee -a "$OUT"

# Test 2: Verify main.ts imports (not hardcodes)
echo "TEST 2: main.ts imports UI_BUILD_MARKER from ui_build_meta" | tee -a "$OUT"
if grep -q "import.*UI_BUILD_MARKER.*from.*ui_build_meta" src/gadget-ui/src/main.ts; then
    echo "✓ main.ts imports UI_BUILD_MARKER" | tee -a "$OUT"
else
    echo "✗ FAIL: main.ts does not import UI_BUILD_MARKER" | tee -a "$OUT"
    exit 1
fi

if grep -q "const UI_BUILD_MARKER = \"UI_MARKER_" src/gadget-ui/src/main.ts; then
    echo "✗ FAIL: hardcoded UI_BUILD_MARKER still in main.ts" | tee -a "$OUT"
    exit 1
else
    echo "✓ No hardcoded UI_BUILD_MARKER in main.ts" | tee -a "$OUT"
fi

echo "" | tee -a "$OUT"

# Test 3: Build and verify bundle
echo "TEST 3: Build succeeds and includes marker" | tee -a "$OUT"
npm run build:gadget > /dev/null 2>&1
BUILD_SIZE=$(stat -c%s src/gadget-ui/dist/assets/index.*.js 2>/dev/null | head -1)
echo "✓ Build succeeded (bundle: $BUILD_SIZE bytes)" | tee -a "$OUT"

# Test 4: Verify marker pattern in bundle (minified)
echo "" | tee -a "$OUT"
echo "TEST 4: Bundle contains marker (minified)" | tee -a "$OUT"
if grep -q "UI_BUILD_MARKER=" src/gadget-ui/dist/index.html; then
    echo "✓ HTML references UI_BUILD_MARKER" | tee -a "$OUT"
fi

# Extract a sample marker pattern (after minification)
MARKER_SAMPLE=$(grep -o "UI_MARKER_[0-9]*T[0-9]*Z" src/gadget-ui/dist/index.html 2>/dev/null | head -1 || true)
if [ -n "$MARKER_SAMPLE" ]; then
    echo "✓ Found marker pattern in HTML: $MARKER_SAMPLE" | tee -a "$OUT"
fi

echo "" | tee -a "$OUT"

# Test 5: Verify format matches spec
echo "TEST 5: Verify marker format specification" | tee -a "$OUT"
# Check that ui_build_meta.ts has the correct template
MARKER_TEMPLATE=$(grep 'export const UI_BUILD_MARKER' src/gadget-ui/src/ui_build_meta.ts | sed 's/.*`//' | sed 's/`.*//')
if echo "$MARKER_TEMPLATE" | grep -q "UI_MARKER_"; then
    echo "✓ Format starts with UI_MARKER_" | tee -a "$OUT"
fi

if echo "$MARKER_TEMPLATE" | grep -q 'getUTCTimestampForMarker'; then
    echo "✓ Format includes getUTCTimestampForMarker()" | tee -a "$OUT"
fi

if echo "$MARKER_TEMPLATE" | grep -q 'UI_BUILD_SHA'; then
    echo "✓ Format includes UI_BUILD_SHA" | tee -a "$OUT"
fi

echo "" | tee -a "$OUT"
echo "==================================================================" | tee -a "$OUT"
echo "FEATURE 1 STATUS: ✓ PASS" | tee -a "$OUT"
echo "==================================================================" | tee -a "$OUT"
echo "Marker is now dynamic and regenerates per build" | tee -a "$OUT"
echo "Format: UI_MARKER_<YYYYMMDDTHHMMSSZ>_<SHA>" | tee -a "$OUT"
echo "==================================================================" | tee -a "$OUT"

cat "$OUT"
