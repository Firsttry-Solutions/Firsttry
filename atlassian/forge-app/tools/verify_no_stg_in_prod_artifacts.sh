#!/bin/bash
# Verify that "STG" or "Staging" strings don't appear in production artifacts or manifest

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

echo "[VERIFY_NO_STG] Checking production artifacts and manifest for STG/Staging strings..."

# Check 1: manifest.yml for STG/Staging in module titles or names (case-insensitive)
if [ -f "$REPO_ROOT/manifest.yml" ]; then
  echo "[VERIFY_NO_STG] Scanning manifest.yml..."
  if grep -i "STG\|Staging" "$REPO_ROOT/manifest.yml" > /dev/null 2>&1; then
    echo "[VERIFY_NO_STG] ❌ FAIL: Found STG/Staging in manifest.yml"
    grep -in "STG\|Staging" "$REPO_ROOT/manifest.yml"
    exit 1
  else
    echo "[VERIFY_NO_STG] ✅ PASS: No STG/Staging in manifest.yml"
  fi
fi

# Check 2: Scan dist/build for STG in .js/.mjs files (case-insensitive)
echo "[VERIFY_NO_STG] Scanning dist/build for STG markers in .js/.mjs files..."

DIST_DIR="$REPO_ROOT/src/gadget-ui/dist"
if [ -d "$DIST_DIR" ]; then
  # Find .js and .mjs files, grep for STG (excluding legitimate words like "STORY", "STRONGEST", etc.)
  found=0
  while IFS= read -r file; do
    # Look for STG as a standalone word or badge marker
    if grep -i '\bSTG\b\|STG_BADGE\|staging_env\|STG-ENV' "$file" > /dev/null 2>&1; then
      echo "[VERIFY_NO_STG] ❌ Found STG in: $file"
      grep -in '\bSTG\b\|STG_BADGE\|staging_env\|STG-ENV' "$file" | head -3
      found=1
    fi
  done < <(find "$DIST_DIR" -name "*.js" -o -name "*.mjs")
  
  if [ "$found" -eq 1 ]; then
    echo "[VERIFY_NO_STG] ❌ FAIL: STG markers found in production build"
    exit 1
  else
    echo "[VERIFY_NO_STG] ✅ PASS: No STG markers in production build"
  fi
else
  echo "[VERIFY_NO_STG] ⚠️  WARN: dist directory not found at $DIST_DIR (build may not have run)"
fi

echo "[VERIFY_NO_STG] ✅ PASS: All checks passed - no STG in production artifacts"
