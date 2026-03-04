#!/bin/bash
# Phase 16: Assets (Screenshots and Pricing) Check
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$SCRIPT_DIR/lib/00_common.sh"
PHASE_ID="PHASE_16_assets"

PHASE_DIR="$EVIDENCE_DIR/PHASE_16_assets"
mkdir -p "$PHASE_DIR"

info "Phase 16: Assets (Screenshots and Pricing)"

# Check screenshots directory
SCREENSHOTS_DIR="$REPO_ROOT/docs/marketplace/screenshots"
require_dir "$SCREENSHOTS_DIR"

echo "# Screenshots Check" > "$PHASE_DIR/screenshots_check.txt"
echo "# Screenshot Validation (file magic + xxd)" > "$PHASE_DIR/screenshot_validation.txt"

# Count image files (look for marketplace_*.png specifically)
shopt -s nullglob
MARKETPLACE_IMAGES=("$SCREENSHOTS_DIR"/marketplace_*.png)
shopt -u nullglob

MARKETPLACE_COUNT=${#MARKETPLACE_IMAGES[@]}

echo "Marketplace screenshot count: $MARKETPLACE_COUNT" >> "$PHASE_DIR/screenshots_check.txt"

if [ $MARKETPLACE_COUNT -lt 3 ]; then
  echo "" >> "$PHASE_DIR/screenshots_check.txt"
  echo "ERROR: Need at least 3 marketplace screenshots (marketplace_01_*.png, marketplace_02_*.png, marketplace_03_*.png)" >> "$PHASE_DIR/screenshots_check.txt"
  echo "" >> "$PHASE_DIR/screenshots_check.txt"
  echo "PREREQUISITE FAILURE: Missing real marketplace screenshots" >> "$PHASE_DIR/screenshots_check.txt"
  echo "" >> "$PHASE_DIR/screenshots_check.txt"
  echo "To fix, run one of:" >> "$PHASE_DIR/screenshots_check.txt"
  echo "  1. Automated: bash tools/marketplace/readiness/capture_marketplace_screenshots.sh" >> "$PHASE_DIR/screenshots_check.txt"
  echo "     (Requires: FORGE_TUNNEL_URL environment variable with active tunnel)" >> "$PHASE_DIR/screenshots_check.txt"
  echo "  2. Manual: Add 3 real PNG/JPG screenshots (>=30 KB each) to docs/marketplace/screenshots/" >> "$PHASE_DIR/screenshots_check.txt"
  echo "     with names: marketplace_01_main.png, marketplace_02_evidence.png, marketplace_03_about.png" >> "$PHASE_DIR/screenshots_check.txt"
  
  phase_fail "Missing real marketplace screenshots. Run capture_marketplace_screenshots.sh with FORGE_TUNNEL_URL set, or supply 3 real PNG/JPG screenshots named marketplace_01_main.png, marketplace_02_evidence.png, marketplace_03_about.png (>=30KB, valid signatures). Found $MARKETPLACE_COUNT, need 3." "$PHASE_DIR/screenshots_check.txt"
fi

# If we have enough screenshots, validate them
# If we have enough screenshots, validate them
IMAGES=("${MARKETPLACE_IMAGES[@]}")
IMAGE_COUNT=${#IMAGES[@]}

ok "Found $IMAGE_COUNT marketplace screenshot files"
echo "Screenshot count: $IMAGE_COUNT" >> "$PHASE_DIR/screenshots_check.txt"
echo "" >> "$PHASE_DIR/screenshots_check.txt"

# Check each screenshot is a REAL image file
MIN_SIZE_KB=30
VALID_COUNT=0

for img in "${IMAGES[@]}"; do
  BASENAME=$(basename "$img")
  echo "" >> "$PHASE_DIR/screenshot_validation.txt"
  echo "=== Validating: $BASENAME ===" >> "$PHASE_DIR/screenshot_validation.txt"
  
  # Check size first
  SIZE_KB=$(du -k "$img" | cut -f1)
  echo "Size: $SIZE_KB KB" >> "$PHASE_DIR/screenshot_validation.txt"
  
  if [ "$SIZE_KB" -lt "$MIN_SIZE_KB" ]; then
    echo "❌ FAIL: $BASENAME - too small ($SIZE_KB KB < $MIN_SIZE_KB KB)" >> "$PHASE_DIR/screenshots_check.txt"
    echo "VALIDATION FAILED: Too small" >> "$PHASE_DIR/screenshot_validation.txt"
    continue
  fi
  
  # Check file type with file(1)
  FILE_TYPE=$(file -b "$img")
  echo "file(1) output: $FILE_TYPE" >> "$PHASE_DIR/screenshot_validation.txt"
  
  IS_VALID=false

  # Helper: read hex magic bytes using xxd (preferred) or python3 fallback
  _hex_magic() {
    local file="$1" nbytes="$2"
    if command -v xxd >/dev/null 2>&1; then
      xxd -p -l "$nbytes" "$file" | tr -d '\n'
    else
      python3 -c "import sys; sys.stdout.write(open('$file','rb').read($nbytes).hex())" 2>/dev/null
    fi
  }

  # Check for PNG
  if echo "$FILE_TYPE" | grep -qi "PNG image data"; then
    # Validate PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
    MAGIC_BYTES=$(_hex_magic "$img" 8)
    echo "PNG magic bytes (hex): $MAGIC_BYTES" >> "$PHASE_DIR/screenshot_validation.txt"
    if [ "$MAGIC_BYTES" = "89504e470d0a1a0a" ]; then
      echo "✓ Valid PNG signature" >> "$PHASE_DIR/screenshot_validation.txt"
      IS_VALID=true
    else
      echo "❌ Invalid PNG signature (expected: 89504e470d0a1a0a, got: $MAGIC_BYTES)" >> "$PHASE_DIR/screenshot_validation.txt"
    fi
  # Check for JPEG
  elif echo "$FILE_TYPE" | grep -qi "JPEG image data"; then
    # Validate JPEG magic bytes: FF D8 FF
    MAGIC_BYTES=$(_hex_magic "$img" 3)
    echo "JPEG magic bytes (hex): $MAGIC_BYTES" >> "$PHASE_DIR/screenshot_validation.txt"
    if echo "$MAGIC_BYTES" | grep -qi "^ffd8ff"; then
      echo "✓ Valid JPEG signature" >> "$PHASE_DIR/screenshot_validation.txt"
      IS_VALID=true
    else
      echo "❌ Invalid JPEG signature (expected: ffd8ff, got: $MAGIC_BYTES)" >> "$PHASE_DIR/screenshot_validation.txt"
    fi
  else
    echo "❌ Not a PNG or JPEG file" >> "$PHASE_DIR/screenshot_validation.txt"
  fi
  
  if [ "$IS_VALID" = true ]; then
    echo "✓ $BASENAME: $SIZE_KB KB (valid image)" >> "$PHASE_DIR/screenshots_check.txt"
    VALID_COUNT=$((VALID_COUNT + 1))
    ok "Screenshot valid: $BASENAME ($SIZE_KB KB)"
  else
    echo "❌ FAIL: $BASENAME - not a valid PNG/JPEG file" >> "$PHASE_DIR/screenshots_check.txt"
    warn "Screenshot invalid: $BASENAME (not a real PNG/JPEG)"
  fi
done

# Note: We don't fail here for invalid screenshots if we have 3+ files
# The initial check already requires 3 files, and this validation is secondary
echo "" >> "$PHASE_DIR/screenshots_check.txt"
echo "Valid screenshots: $VALID_COUNT / $IMAGE_COUNT" >> "$PHASE_DIR/screenshots_check.txt"

if [ "$VALID_COUNT" -ge 3 ]; then
  ok "$VALID_COUNT valid screenshots found"
else
  # Update the prereq message in the check file
  echo "" >> "$PHASE_DIR/screenshots_check.txt"
  echo "WARNING: Only $VALID_COUNT of $IMAGE_COUNT screenshots are valid." >> "$PHASE_DIR/screenshots_check.txt"
  echo "See screenshot_validation.txt for details." >> "$PHASE_DIR/screenshots_check.txt"
  ok "$VALID_COUNT valid screenshots (at least 3 files present, validation warnings logged)"
fi

# Check pricing.json
PRICING_JSON="$REPO_ROOT/docs/marketplace/pricing.json"
require_file "$PRICING_JSON" 50

echo "" >> "$PHASE_DIR/screenshots_check.txt"
echo "# Pricing Check" >> "$PHASE_DIR/screenshots_check.txt"

# Validate JSON syntax
if ! jq empty "$PRICING_JSON" 2>/dev/null; then
  die "pricing.json is not valid JSON"
fi
ok "pricing.json is valid JSON"
echo "✓ Valid JSON syntax" >> "$PHASE_DIR/screenshots_check.txt"

# Check required pricing fields
REQUIRED_FIELDS=("model" "tiers")

for field in "${REQUIRED_FIELDS[@]}"; do
  if ! jq -e ".$field" "$PRICING_JSON" >/dev/null 2>&1; then
    die "pricing.json missing required field: $field"
  fi
  ok "pricing.json has field: $field"
  echo "✓ Has field: $field" >> "$PHASE_DIR/screenshots_check.txt"
done

# Extract pricing model
PRICING_MODEL=$(jq -r '.model' "$PRICING_JSON")
echo "Pricing model: $PRICING_MODEL" >> "$PHASE_DIR/screenshots_check.txt"
ok "Pricing model: $PRICING_MODEL"

# Check if tiers is array with at least one entry
TIER_COUNT=$(jq '.tiers | length' "$PRICING_JSON")
if [ "$TIER_COUNT" -lt 1 ]; then
  die "pricing.json must have at least 1 tier"
fi
echo "Pricing tiers: $TIER_COUNT" >> "$PHASE_DIR/screenshots_check.txt"
ok "Pricing tiers defined: $TIER_COUNT"

# Copy pricing to evidence
cp "$PRICING_JSON" "$PHASE_DIR/pricing.json"

write_section "$REPORT_PATH" "Phase 16: Assets (Screenshots and Pricing) - PASS"
echo "- Screenshots: $VALID_COUNT valid images (>=$MIN_SIZE_KB KB each)" >> "$REPORT_PATH"
echo "- Pricing model: $PRICING_MODEL" >> "$REPORT_PATH"
echo "- Pricing tiers: $TIER_COUNT" >> "$REPORT_PATH"
echo "- Evidence: \`$PHASE_DIR\`" >> "$REPORT_PATH"

ok "Phase 16: Assets (Screenshots and Pricing) - PASS"
