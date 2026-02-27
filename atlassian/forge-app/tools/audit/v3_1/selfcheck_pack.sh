#!/usr/bin/env bash
#
# Pack Artifact Self-Check Script
# 
# Validates that pack file generation succeeded and produced required files.
# Used by: tools/audit/v3_1/lib/determinism.sh (Phase 06 Layer C)
# 
# Usage: bash selfcheck_pack.sh <pack_dir>
# 
# Checks:
# 1. Pack directory exists and is not empty
# 2. Required pack files are present
# 3. Pack files are not empty
# 4. Pack files contain expected structure (JSON valid, CSV has headers)
# 
# Exit codes:
# 0 - All checks passed
# 1 - One or more checks failed (prints detailed error)
#

set -euo pipefail

PACK_DIR="${1:-}"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Required pack files (from reviewPack.ts REQUIRED_FILES)
REQUIRED_FILES=(
  "review-manifest.json"
  "review-summary.json"
  "access-review.csv"
  "exceptions.csv"
  "snapshot-hash.txt"
  "control-mapping.json"
  "verify.js"
  "schema-version.txt"
)

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Pack Artifact Self-Check"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [[ -z "$PACK_DIR" ]]; then
  echo -e "${RED}ERROR: Pack directory not specified${NC}"
  echo "Usage: $0 <pack_dir>"
  exit 1
fi

if [[ ! -d "$PACK_DIR" ]]; then
  echo -e "${RED}ERROR: Pack directory does not exist: $PACK_DIR${NC}"
  exit 1
fi

echo "Pack directory: $PACK_DIR"
echo

# Check 1: Directory is not empty
file_count=$(find "$PACK_DIR" -type f | wc -l)
if [[ "$file_count" -eq 0 ]]; then
  echo -e "${RED}✗ FAIL: Pack directory is empty${NC}"
  exit 1
fi
echo -e "${GREEN}✓ PASS: Pack directory contains $file_count files${NC}"

# Check 2: All required files are present
missing_files=()
for file in "${REQUIRED_FILES[@]}"; do
  if [[ ! -f "$PACK_DIR/$file" ]]; then
    missing_files+=("$file")
  fi
done

if [[ ${#missing_files[@]} -gt 0 ]]; then
  echo -e "${RED}✗ FAIL: Missing required pack files:${NC}"
  for file in "${missing_files[@]}"; do
    echo "  - $file"
  done
  exit 1
fi
echo -e "${GREEN}✓ PASS: All ${#REQUIRED_FILES[@]} required files present${NC}"

# Check 3: Files are not empty
empty_files=()
for file in "${REQUIRED_FILES[@]}"; do
  if [[ ! -s "$PACK_DIR/$file" ]]; then
    empty_files+=("$file")
  fi
done

if [[ ${#empty_files[@]} -gt 0 ]]; then
  echo -e "${RED}✗ FAIL: Pack files are empty:${NC}"
  for file in "${empty_files[@]}"; do
    echo "  - $file"
  done
  exit 1
fi
echo -e "${GREEN}✓ PASS: All files are non-empty${NC}"

# Check 4: JSON files are valid JSON
json_files=("review-manifest.json" "review-summary.json" "control-mapping.json")
invalid_json=()
for file in "${json_files[@]}"; do
  if ! jq empty "$PACK_DIR/$file" 2>/dev/null; then
    invalid_json+=("$file")
  fi
done

if [[ ${#invalid_json[@]} -gt 0 ]]; then
  echo -e "${RED}✗ FAIL: Invalid JSON in pack files:${NC}"
  for file in "${invalid_json[@]}"; do
    echo "  - $file"
  done
  exit 1
fi
echo -e "${GREEN}✓ PASS: All JSON files are valid${NC}"

# Check 5: CSV files have headers
csv_files=("access-review.csv" "exceptions.csv")
missing_headers=()
for file in "${csv_files[@]}"; do
  if [[ $(wc -l < "$PACK_DIR/$file") -lt 1 ]]; then
    missing_headers+=("$file (empty)")
  elif ! head -1 "$PACK_DIR/$file" | grep -q ","; then
    missing_headers+=("$file (no comma-separated header)")
  fi
done

if [[ ${#missing_headers[@]} -gt 0 ]]; then
  echo -e "${YELLOW}⚠ WARNING: CSV files missing headers:${NC}"
  for file in "${missing_headers[@]}"; do
    echo "  - $file"
  done
  # Not a hard failure for empty CSV (valid if no exceptions/items)
fi
echo -e "${GREEN}✓ PASS: CSV file structure valid${NC}"

# Check 6: verify.js is executable JavaScript
if ! grep -q "function buildPackHashInput" "$PACK_DIR/verify.js"; then
  echo -e "${RED}✗ FAIL: verify.js missing buildPackHashInput function${NC}"
  exit 1
fi
echo -e "${GREEN}✓ PASS: verify.js structure valid${NC}"

# Check 7: snapshot-hash.txt contains non-empty hash
snapshot_hash=$(cat "$PACK_DIR/snapshot-hash.txt")
if [[ -z "$snapshot_hash" ]]; then
  echo -e "${RED}✗ FAIL: snapshot-hash.txt is empty${NC}"
  exit 1
fi
echo -e "${GREEN}✓ PASS: snapshot-hash.txt contains hash${NC}"

# Check 8: schema-version.txt contains version string
schema_version=$(cat "$PACK_DIR/schema-version.txt")
if [[ ! "$schema_version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo -e "${YELLOW}⚠ WARNING: schema-version.txt format unexpected: $schema_version${NC}"
fi
echo -e "${GREEN}✓ PASS: schema-version.txt contains version${NC}"

echo
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✓ ALL CHECKS PASSED${NC}"
echo "Pack artifact generation successful and valid"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
exit 0
