#!/bin/bash

# DOCS_GATE: Non-Bypassable Documentation Validator
# Fast check for Marketplace compliance standards

set -o pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOCS_DIR="${REPO_ROOT}/docs"
PASSED=0
FAILED=0

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo "=== DOCS_GATE v1.1 ==="
echo ""

#######################################
# GATE 1: Required Docs
#######################################
echo "GATE 1: Required Documentation"
for doc in SCOPES.md README.md SECURITY.md PRIVACY.md SUPPORT_POLICY.md CHANGE_MANAGEMENT.md ROADMAP.md ENTERPRISE_ONE_PAGER.md COMPLIANCE.md DATA_RETENTION.md DATA_INVENTORY.md claims_proof_catalog.md; do
    if test -f "${DOCS_DIR}/${doc}"; then
        echo -e "${GREEN}✅${NC} docs/${doc}"
        ((PASSED++))
    else
        echo -e "${RED}❌${NC} docs/${doc} MISSING"
        ((FAILED++))
    fi
done

#######################################
# GATE 2: Index Quality
#######################################
echo ""
echo "GATE 2: Documentation Index"
if test -f "${DOCS_DIR}/README.md"; then
    LINKS=$(grep -c '\[' "${DOCS_DIR}/README.md" || echo 0)
    if test "$LINKS" -ge 20; then
        echo -e "${GREEN}✅${NC} docs/README.md has $LINKS links"
        ((PASSED++))
    else
        echo -e "${RED}❌${NC} docs/README.md insufficient links ($LINKS)"
        ((FAILED++))
    fi
fi

#######################################
# GATE 3: Scopes Documentation
#######################################
echo ""
echo "GATE 3: API Scopes"
if test -f "${DOCS_DIR}/SCOPES.md"; then
    if grep -q "storage:app\|read:jira-work" "${DOCS_DIR}/SCOPES.md"; then
        echo -e "${GREEN}✅${NC} SCOPES.md documents required scopes"
        ((PASSED++))
    else
        echo -e "${RED}❌${NC} SCOPES.md missing scope definitions"
        ((FAILED++))
    fi
fi

#######################################
# GATE 4: No Placeholders in Critical Docs
#######################################
echo ""
echo "GATE 4: Placeholder Terms"
CRITICAL="SECURITY.md PRIVACY.md SCOPES.md"
for doc in $CRITICAL; do
    if test -f "${DOCS_DIR}/${doc}"; then
        if grep -qi "TBD\|TODO\|coming soon\|lorem ipsum" "${DOCS_DIR}/${doc}"; then
            echo -e "${RED}❌${NC} ${doc} contains placeholder text"
            ((FAILED++))
        else
            echo -e "${GREEN}✅${NC} ${doc} no placeholders"
            ((PASSED++))
        fi
    fi
done

#######################################
# SUMMARY
#######################################
echo ""
echo "======================================="
TOTAL=$((PASSED + FAILED))
echo "Results: ${GREEN}${PASSED}/${TOTAL} passed${NC}"
if test "$FAILED" -eq 0; then
    echo -e "${GREEN}✅ DOCS_GATE PASSED${NC}"
    echo ""
    exit 0
else
    echo -e "${RED}${FAILED} failures${NC}"
    echo -e "${RED}❌ DOCS_GATE FAILED${NC}"
    echo ""
    exit 1
fi
