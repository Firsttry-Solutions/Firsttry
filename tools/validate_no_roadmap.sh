#!/usr/bin/env bash
# ============================================================================
# validate_no_roadmap.sh
# 
# CI Guard: Scans ONLY the shipping surface for roadmap/planned capability 
# terms. Archive and internal audit folders are excluded.
#
# SHIPPING SURFACE (CUSTOMER-FACING):
# - README.md (root)
# - docs/**/*.md and docs/**/*.html (but NOT docs/evidence/ or docs/audit_reports/)
# - atlassian/forge-app/src/** (all source files)
# - atlassian/forge-app/manifest.yml only (NOT docs/)
# - tools/**/*.sh, tools/**/*.js, tools/**/*.mjs
#
# EXCLUDED from scan (internal, not customer-facing):
# - docs/evidence/** (archived internal evidence)
# - docs/audit_reports/** (archived internal audits)
# - atlassian/forge-app/docs/** (internal engineering documentation)
# - This script itself (avoid self-match)
# ============================================================================

set -euo pipefail

# Forbidden terms in shipping surface (case-insensitive)
# NOTE: "In Progress" is Jira workflow state, so we do NOT flag it
# NOTE: "Planned" as standalone word is allowed (used in legitimate contexts)
#       We specifically forbid "Planned Capabilities" and similar commitment language
FORBIDDEN_TERMS=(
    "Planned Capabilities"
    "Roadmap"
    "Future release"
    "Future releases"
    "Upcoming"
    "Not active"
)

# Forbidden emojis in shipping surface
# Note: ⚠️ is allowed (used for legitimate warnings in code/docs)
#       📋 is allowed (used for checklists/tables)
FORBIDDEN_EMOJIS=(
    "⏳"
)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

VIOLATION_COUNT=0
VIOLATION_FILES=()

echo "========================================="
echo "🔒 CI Guard: No Roadmap (Shipping Surface)"
echo "========================================="
echo

# Build list of shipping-surface files
# INCLUDED:
#   - Root README.md
#   - docs/*.md, docs/*.html (but exclude evidence/, audit_reports/)
#   - atlassian/forge-app/src/** (source code)
#   - atlassian/forge-app/manifest.yml only (not docs/)
#   - tools/*.sh, tools/*.js, tools/*.mjs
# EXCLUDED:
#   - docs/evidence/**, docs/audit_reports/** (internal archives)
#   - atlassian/forge-app/docs/** (internal engineering docs)
#   - This script itself
SHIPPING_FILES=$(git ls-files | grep -E "(^README\.md|^docs/.*\.(md|html)|^atlassian/forge-app/src/|^atlassian/forge-app/manifest\.yml|^tools/.*\.(sh|js|mjs))" | grep -v -E "(^docs/evidence/|^docs/audit_reports/|^atlassian/forge-app/docs/|^tools/validate_no_roadmap\.sh|^tools/marketplace_push_and_deploy\.sh)" || true)

SHIPPING_COUNT=$(echo "$SHIPPING_FILES" | wc -l)
echo "Scanning $SHIPPING_COUNT shipping-surface files..."
echo

# Scan for forbidden terms
for term in "${FORBIDDEN_TERMS[@]}"; do
    echo "Checking: \"$term\""
    
    while IFS= read -r file; do
        if [ -z "$file" ]; then
            continue
        fi
        
        if [ ! -f "$file" ]; then
            continue
        fi
        
        # Case-insensitive match
        if grep -iq "$term" "$file"; then
            VIOLATION_COUNT=$((VIOLATION_COUNT + 1))
            if [[ ! " ${VIOLATION_FILES[@]} " =~ " ${file} " ]]; then
                VIOLATION_FILES+=("$file")
            fi
            echo "  ❌ $file"
            grep -in "$term" "$file" | head -2 | sed 's/^/     /'
        fi
    done <<< "$SHIPPING_FILES"
done

# Scan for forbidden emojis
for emoji in "${FORBIDDEN_EMOJIS[@]}"; do
    echo "Checking: $emoji emoji"
    
    while IFS= read -r file; do
        if [ -z "$file" ]; then
            continue
        fi
        
        if [ ! -f "$file" ]; then
            continue
        fi
        
        if grep -q "$emoji" "$file"; then
            VIOLATION_COUNT=$((VIOLATION_COUNT + 1))
            if [[ ! " ${VIOLATION_FILES[@]} " =~ " ${file} " ]]; then
                VIOLATION_FILES+=("$file")
            fi
            echo "  ❌ $file (contains $emoji)"
            grep -n "$emoji" "$file" | head -2 | sed 's/^/     /'
        fi
    done <<< "$SHIPPING_FILES"
done

echo
echo "========================================="

if [ $VIOLATION_COUNT -eq 0 ]; then
    echo -e "${GREEN}✅ PASS: Shipping surface clean${NC}"
    echo "No roadmap/planned terms found in product surface."
    exit 0
else
    echo -e "${RED}❌ FAIL: Found $VIOLATION_COUNT violations${NC}"
    echo "In ${#VIOLATION_FILES[@]} file(s):"
    echo
    for file in "${VIOLATION_FILES[@]}"; do
        echo "  - $file"
    done
    echo
    exit 1
fi
