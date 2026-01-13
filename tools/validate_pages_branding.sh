#!/bin/bash
set -euo pipefail

# Pages-specific branding validator
# Blocks ONLY old product names that represent branding violations
# "Forge context" and "Governance" are legitimate technical terms in FirstTry product

FORBIDDEN_PRODUCT_NAMES=(
  "Jira Governance"   # Old product name variant (never used in current codebase)
)

DOCS_DIR="./docs"
ERRORS=0

echo "=== Pages Branding Validator ==="
echo "Checking: $DOCS_DIR"
echo "Enforcing: No old product name variants"
echo ""

# Check forbidden product names
for pattern in "${FORBIDDEN_PRODUCT_NAMES[@]}"; do
  if grep -r "$pattern" "$DOCS_DIR" --include="*.md" --include="*.html" 2>/dev/null | grep -qv "^Binary"; then
    echo "❌ FORBIDDEN: '$pattern' found in docs/**"
    grep -r "$pattern" "$DOCS_DIR" --include="*.md" --include="*.html" 2>/dev/null | head -5
    ((ERRORS++))
  else
    echo "✓ FORBIDDEN: '$pattern' NOT found"
  fi
done

echo ""

# Check required canonical in index
if [ -f "$DOCS_DIR/index.md" ] || [ -f "$DOCS_DIR/index.html" ]; then
  for idx in "$DOCS_DIR/index.md" "$DOCS_DIR/index.html"; do
    if [ -f "$idx" ]; then
      if grep -q "FirstTry" "$idx"; then
        echo "✓ REQUIRED: Canonical 'FirstTry' in $(basename $idx)"
      else
        echo "❌ REQUIRED: Canonical 'FirstTry' MISSING in $(basename $idx)"
        ((ERRORS++))
      fi
    fi
  done
fi

echo ""
if [ $ERRORS -eq 0 ]; then
  echo "✅ PAGES BRANDING VALIDATION PASSED"
  exit 0
else
  echo "❌ PAGES BRANDING VALIDATION FAILED ($ERRORS errors)"
  exit 1
fi
