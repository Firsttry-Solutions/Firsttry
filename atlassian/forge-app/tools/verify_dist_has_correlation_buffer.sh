#!/bin/bash
################################################################################
# verify_dist_has_correlation_buffer.sh
#
# Fail-closed dist guard: Verify that the built UI bundle contains correlation
# buffer code and references.
#
# Checks:
# 1. Bundle contains __FT_CORRELATION_ID string literal
# 2. Bundle contains pattern for correlation ID generation
# 3. No false positives (checks multiple files if needed)
#
# Usage: bash tools/verify_dist_has_correlation_buffer.sh
# Exit: 0 if all checks pass, 1 if any fails
#
################################################################################

set -e

echo "================================================================================"
echo "DIST GUARD: Verify correlation buffer in built bundle"
echo "================================================================================"

# Find the built UI bundle (check common output locations)
# Find the built UI bundle (check common output locations)
BUNDLE_PATHS=(
  "src/gadget-ui/dist/index.js"
  "src/gadget-ui/dist/gadget.js"
  "src/gadget-ui/dist/main.js"
  "src/gadget-ui/dist/app.*.js"
  "build/gadget-ui.js"
  "dist/gadget-ui.js"
  "build/gadget.js"
  "dist/gadget.js"
  "build/ui.js"
  "dist/ui.js"
  ".next/server/gadget-ui.js"
  ".next/static/gadget-ui.js"
)

BUNDLE=""
for path_pattern in "${BUNDLE_PATHS[@]}"; do
  # Handle glob patterns
  for path in $path_pattern; do
    if [[ -f "$path" ]]; then
      BUNDLE="$path"
      break 2
    fi
  done
done

if [[ -z "$BUNDLE" ]]; then
  echo "❌ FAIL: Could not find built bundle in any of these locations:"
  printf '  %s\n' "${BUNDLE_PATHS[@]}"
  exit 1
fi

echo "✓ Found bundle: $BUNDLE"
echo ""

# Check 1: Must contain __FT_CORRELATION_ID literal
echo "[1/3] Checking for __FT_CORRELATION_ID reference..."
if grep -q "__FT_CORRELATION_ID" "$BUNDLE"; then
  echo "  ✓ __FT_CORRELATION_ID found in bundle"
else
  echo "  ❌ FAIL: __FT_CORRELATION_ID NOT found in bundle"
  echo "     This means the correlation buffer was not bundled correctly"
  exit 1
fi

# Check 2: Must contain correlation_ pattern (generation pattern)
echo "[2/3] Checking for correlation ID generation pattern..."
if grep -q "correlation_" "$BUNDLE"; then
  echo "  ✓ Correlation generation pattern found in bundle"
else
  echo "  ❌ FAIL: correlation_ pattern NOT found in bundle"
  echo "     This means correlation ID generation was optimized away or removed"
  exit 1
fi

# Check 3: Should contain Date.now() for timestamp (common pattern)
echo "[3/3] Checking for timestamp generation pattern..."
if grep -q "Date.now()" "$BUNDLE" || grep -q "Date\.now" "$BUNDLE"; then
  echo "  ✓ Timestamp generation found in bundle"
else
  echo "  ⚠️  WARNING: Date.now() not found (may be minified or optimized)"
  echo "     Continuing anyway (not fail-closed for this check)"
fi

echo ""
echo "✅ DIST GUARD PASSED: All correlation buffer checks successful"
echo "   Bundle: $BUNDLE"
echo "   Size: $(wc -c < "$BUNDLE") bytes"
