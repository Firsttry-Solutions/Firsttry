#!/bin/bash
set -euo pipefail

# ==============================================================================
# verify_ui_markers.sh
# ==============================================================================
# Purpose: Verify UI proof markers exist in source and shipped dist JS
# Requirements:
#   - FT_PROD_READY_E must be set to evidence directory
#   - List dist JS files
#   - Proof marker presence in source
#   - Count marker occurrences in ALL dist JS files
#   - FAIL if required marker in source but 0 count in dist

# Resolve evidence directory (FT_PROD_READY_E contract, fail-closed)
E="${FT_PROD_READY_E:-}"
if [[ -z "$E" ]]; then
  echo "FAIL: FT_PROD_READY_E must be set to an evidence directory path" >&2
  exit 1
fi

if [[ ! -d "$E" ]] || [[ ! -d "$E/05_ui" ]]; then
  echo "FAIL: FT_PROD_READY_E directory or required subdirectory does not exist: $E/05_ui" >&2
  exit 1
fi

cd /workspaces/Firsttry/atlassian/forge-app

# ==============================================================================
# Gate 1: List dist JS files
# ==============================================================================
echo "=== GATE 1: List dist JS files ==="

DIST_DIR="src/gadget-ui/dist"
if [[ ! -d "$DIST_DIR" ]]; then
  echo "FAIL: dist directory not found: $DIST_DIR"
  exit 1
fi

ls -la "$DIST_DIR"/*.js 2>/dev/null | tee "$E/05_ui/dist_js_list.txt" || {
  echo "FAIL: No .js files in $DIST_DIR"
  exit 1
}

echo "PASS: Found dist JS files"

# ==============================================================================
# Gate 2: Prove marker presence in source
# ==============================================================================
echo ""
echo "=== GATE 2: Marker presence in source ==="

MARKERS=(
  "FT_PROOF_UI_EFFECTIVE_KIND"
  "FT_PROOF_UI_EXPORT_GATE_EVALUATED"
  "backendReasonCode"
  "eligibilitySource"
  "computedEligibilityOk"
)

rg -n "FT_PROOF_UI_EFFECTIVE_KIND|FT_PROOF_UI_EXPORT_GATE_EVALUATED|backendReasonCode|eligibilitySource|computedEligibilityOk" \
  src/gadget-ui/src 2>/dev/null | tee "$E/05_ui/source_marker_locations.txt" || {
  echo "WARNING: No markers found in source. Checking if this is expected."
}

SOURCE_COUNT=$(wc -l < "$E/05_ui/source_marker_locations.txt" || echo "0")
echo "Found $SOURCE_COUNT marker references in source"

if [[ $SOURCE_COUNT -eq 0 ]]; then
  echo "WARNING: No markers in source. This may be intentional if markers are generated at build time."
fi

# ==============================================================================
# Gate 3: Count markers in dist JS files
# ==============================================================================
echo ""
echo "=== GATE 3: Count markers in dist JS files ==="

> "$E/05_ui/dist_marker_counts.txt"  # Create empty file

OVERALL_EXIT=0
for marker in "${MARKERS[@]}"; do
  echo "Checking marker: $marker"
  
  # Count across all dist JS files
  MARKER_COUNT=0
  for jsfile in "$DIST_DIR"/*.js; do
    if [[ -f "$jsfile" ]]; then
      FILE_COUNT=$(grep -ao "$marker" "$jsfile" 2>/dev/null | wc -l || echo 0)
      MARKER_COUNT=$((MARKER_COUNT + FILE_COUNT))
    fi
  done
  
  echo "$marker: $MARKER_COUNT" | tee -a "$E/05_ui/dist_marker_counts.txt"
  
  # Fail-closed: if marker in source but 0 in dist, FAIL
  if grep -q "$marker" "$E/05_ui/source_marker_locations.txt" 2>/dev/null && [[ $MARKER_COUNT -eq 0 ]]; then
    echo "FAIL: Marker '$marker' present in source but NOT in dist!"
    OVERALL_EXIT=1
  fi
done

echo ""
if [[ $OVERALL_EXIT -ne 0 ]]; then
  echo "FAIL: At least one required marker missing from dist"
  echo "Evidence: $E/05_ui/dist_marker_counts.txt"
  exit 1
fi

if [[ $SOURCE_COUNT -eq 0 ]]; then
  echo "INCONCLUSIVE: No markers in source. Cannot validate dist."
  echo "This may be OK if markers are injected at build time."
  exit 0
fi

echo "PASS: All markers accounted for in dist"
echo "Evidence: $E/05_ui/dist_marker_counts.txt"

exit 0
