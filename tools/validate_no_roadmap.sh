#!/usr/bin/env bash
# ============================================================================
# validate_no_roadmap.sh
# 
# CI Guard: Fails hard if ANY forbidden roadmap/planned capability terms 
# appear in tracked files. This script runs on every commit/PR and prevents
# roadmap language from leaking into the repository.
#
# Permitted exception: "📋 Scope Boundaries & Explicit Non-Goals" heading
# Permitted exception: ⚠️ emoji (used for warnings throughout codebase)
# ============================================================================

set -euo pipefail

# Forbidden terms (must not appear in tracked files)
# NOTE: These are the ROADMAP-SPECIFIC terms only
# General warning emojis (⚠️) are allowed for legitimate warnings
FORBIDDEN_TERMS=(
    "Planned Capabilities"
    "Roadmap"
    "Future release"
    "Future releases"
    "In Progress"
    "Not active"
    "Upcoming"
    "⏳"  # Hourglass (roadmap/planned emoji)
)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

VIOLATION_COUNT=0
VIOLATION_FILES=()

echo "========================================="
echo "🔒 CI Guard: No Roadmap Validator"
echo "========================================="
echo

# Get list of tracked files from git
TRACKED_FILES=$(git ls-files)

for term in "${FORBIDDEN_TERMS[@]}"; do
    echo "Scanning for: \"$term\""
    
    while IFS= read -r file; do
        if [ -z "$file" ]; then
            continue
        fi
        
        # Skip if file doesn't exist
        if [ ! -f "$file" ]; then
            continue
        fi
        
        # For ⏳ emoji, forbid completely (it's specific to roadmap)
        if [ "$term" = "⏳" ]; then
            if grep -q "⏳" "$file"; then
                VIOLATION_COUNT=$((VIOLATION_COUNT + 1))
                if [[ ! " ${VIOLATION_FILES[@]} " =~ " ${file} " ]]; then
                    VIOLATION_FILES+=("$file")
                fi
                echo "  ❌ $file"
                grep -n "⏳" "$file" | head -3 | sed 's/^/     /'
            fi
        else
            # For all other terms, forbid completely
            if grep -iq "$term" "$file"; then
                VIOLATION_COUNT=$((VIOLATION_COUNT + 1))
                if [[ ! " ${VIOLATION_FILES[@]} " =~ " ${file} " ]]; then
                    VIOLATION_FILES+=("$file")
                fi
                echo "  ❌ $file"
                grep -in "$term" "$file" | head -3 | sed 's/^/     /'
            fi
        fi
    done <<< "$TRACKED_FILES"
done

# Special check: 📋 emoji allowed ONLY in the exact permitted heading
echo "Scanning for: 📋 (allowed only in non-goals heading)"
while IFS= read -r file; do
    if [ -z "$file" ]; then
        continue
    fi
    
    if [ ! -f "$file" ]; then
        continue
    fi
    
    if grep -q "📋" "$file"; then
        # Check if it's in the permitted heading
        if ! grep -q "📋 Scope Boundaries & Explicit Non-Goals" "$file"; then
            # Found 📋 but NOT in the permitted heading - violation!
            VIOLATION_COUNT=$((VIOLATION_COUNT + 1))
            if [[ ! " ${VIOLATION_FILES[@]} " =~ " ${file} " ]]; then
                VIOLATION_FILES+=("$file")
            fi
            echo "  ❌ $file"
            grep -n "📋" "$file" | head -3 | sed 's/^/     /'
        fi
    fi
done <<< "$TRACKED_FILES"

echo
echo "========================================="

if [ $VIOLATION_COUNT -eq 0 ]; then
    echo -e "${GREEN}✅ PASS: No forbidden roadmap terms found${NC}"
    echo "Repository is clean for roadmap/planned capability language."
    exit 0
else
    echo -e "${RED}❌ FAIL: Found $VIOLATION_COUNT violations${NC}"
    echo "Forbidden terms detected in ${#VIOLATION_FILES[@]} file(s):"
    echo
    for file in "${VIOLATION_FILES[@]}"; do
        echo "  - $file"
    done
    echo
    echo "Action required:"
    echo "  1. Remove all instances of forbidden terms"
    echo "  2. Ensure 📋 emoji appears ONLY in: '📋 Scope Boundaries & Explicit Non-Goals'"
    echo "  3. Re-run this script to verify"
    echo
    exit 1
fi
