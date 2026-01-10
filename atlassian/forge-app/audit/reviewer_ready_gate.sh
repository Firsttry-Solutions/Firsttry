#!/bin/bash
# Reviewer Readiness Gate Script
# Non-bypassable checks to ensure marketplace compliance

set -e  # Exit on first error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
AUDIT_DIR="$SCRIPT_DIR"

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check 1: Verify every file listed in audit/REQUIRED_FILES.txt exists
echo "========================================"
echo "CHECK 1: Required Files"
echo "========================================"

REQUIRED_FILES="$AUDIT_DIR/REQUIRED_FILES.txt"
if [[ ! -f "$REQUIRED_FILES" ]]; then
    echo -e "${RED}FAIL: MISSING_REQUIRED_FILE: $REQUIRED_FILES${NC}"
    exit 1
fi

MISSING_FILES=()
while IFS= read -r file; do
    file=$(echo "$file" | xargs)  # trim whitespace
    [[ -z "$file" ]] && continue
    
    # Support both formats:
    # 1. Relative to forge-app: docs/SECURITY_AND_PRIVACY.md
    # 2. Full path: atlassian/forge-app/docs/SECURITY_AND_PRIVACY.md
    local_path="$file"
    if [[ "$file" == atlassian/forge-app/* ]]; then
        # Strip the atlassian/forge-app/ prefix
        local_path="${file#atlassian/forge-app/}"
    fi
    
    full_path="$REPO_ROOT/$local_path"
    
    if [[ ! -f "$full_path" ]]; then
        MISSING_FILES+=("$file")
        echo -e "${RED}  ✗ MISSING: $file${NC}"
    else
        echo -e "${GREEN}  ✓ Found: $file${NC}"
    fi
done < "$REQUIRED_FILES"

if [[ ${#MISSING_FILES[@]} -gt 0 ]]; then
    echo -e "${RED}FAIL: MISSING_REQUIRED_FILE: ${MISSING_FILES[0]}${NC}"
    exit 1
fi

echo -e "${GREEN}✓ All required files present${NC}"

# Check 2: Verify CLAIMS_LEDGER.md exists and has no MISSING statuses
echo ""
echo "========================================"
echo "CHECK 2: Claims Ledger"
echo "========================================"

CLAIMS_LEDGER="$AUDIT_DIR/CLAIMS_LEDGER.md"
if [[ ! -f "$CLAIMS_LEDGER" ]]; then
    echo -e "${RED}FAIL: CLAIMS_LEDGER_MISSING${NC}"
    exit 1
fi

MISSING_CLAIMS=$(grep -n "MISSING" "$CLAIMS_LEDGER" || true)
if [[ -n "$MISSING_CLAIMS" ]]; then
    echo -e "${RED}Claims with MISSING status found:${NC}"
    echo "$MISSING_CLAIMS"
    echo -e "${RED}FAIL: CLAIMS_LEDGER_MISSING_PROOF${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Claims ledger verified (no MISSING statuses)${NC}"

# Check 3: Optional Freeze Lock (skip if not required)
echo ""
echo "========================================"
echo "CHECK 3: Freeze Lock (Optional)"
echo "========================================"

FREEZE_LOCK="$AUDIT_DIR/marketplace_submission/FREEZE_LOCK.json"
VERIFY_FREEZE="$AUDIT_DIR/verify_freeze_lock.sh"

if [[ -f "$FREEZE_LOCK" ]]; then
    if [[ ! -f "$VERIFY_FREEZE" ]]; then
        echo -e "${YELLOW}⚠ Freeze lock present but verifier missing${NC}"
    else
        echo -e "${YELLOW}Running freeze verification...${NC}"
        if ! bash "$VERIFY_FREEZE"; then
            echo -e "${RED}FAIL: FREEZE_VERIFY_FAIL${NC}"
            exit 1
        fi
        echo -e "${GREEN}✓ Freeze verification passed${NC}"
    fi
else
    echo -e "${YELLOW}⚠ Freeze lock not yet created (OK for development)${NC}"
fi

# Check 4: Run tests
echo ""
echo "========================================"
echo "CHECK 4: Run Tests (Normal Mode)"
echo "========================================"

cd "$REPO_ROOT"
if ! npm test; then
    echo -e "${RED}FAIL: TESTS_FAIL${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Normal tests passed${NC}"

echo ""
echo "========================================"
echo "CHECK 4B: Run Tests (Deterministic Mode)"
echo "========================================"

if ! FIRSTTRY_DETERMINISTIC=1 npm test; then
    echo -e "${RED}FAIL: TESTS_FAIL${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Deterministic tests passed${NC}"

# Check 5: Run npm audit (check for HIGH or CRITICAL without waiver)
echo ""
echo "========================================"
echo "CHECK 5: NPM Audit"
echo "========================================"

AUDIT_JSON=$(npm audit --json 2>/dev/null || echo "{}")
HIGH_COUNT=$(echo "$AUDIT_JSON" | grep -o '"severity":"high"' | wc -l || echo 0)
CRITICAL_COUNT=$(echo "$AUDIT_JSON" | grep -o '"severity":"critical"' | wc -l || echo 0)

if [[ $HIGH_COUNT -gt 0 ]] || [[ $CRITICAL_COUNT -gt 0 ]]; then
    WAIVER="$AUDIT_DIR/NPM_AUDIT_WAIVER.md"
    if [[ ! -f "$WAIVER" ]]; then
        echo -e "${RED}FAIL: AUDIT_FAIL_NEEDS_WAIVER${NC}"
        exit 1
    fi
    echo -e "${YELLOW}⚠ HIGH/CRITICAL vulnerabilities present but waiver exists${NC}"
else
    echo -e "${GREEN}✓ No HIGH/CRITICAL vulnerabilities${NC}"
fi

# All checks passed
echo ""
echo "========================================"
echo -e "${GREEN}GATE_PASS${NC}"
echo "========================================"
exit 0
