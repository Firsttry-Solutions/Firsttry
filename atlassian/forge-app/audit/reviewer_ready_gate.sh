#!/bin/bash
# Reviewer Readiness Gate Script
# Non-bypassable checks to ensure marketplace compliance

set -e  # Exit on first error
export LC_ALL=C
export LANG=C

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

MISSING_CLAIMS=$(grep -E "\|\s*MISSING\s*\|" "$CLAIMS_LEDGER" || true)
if [[ -n "$MISSING_CLAIMS" ]]; then
    echo -e "${RED}Claims with MISSING status found:${NC}"
    echo "$MISSING_CLAIMS"
    echo -e "${RED}FAIL: CLAIMS_LEDGER_MISSING_PROOF${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Claims ledger verified (no MISSING statuses)${NC}"

# Check 3: Mandatory Freeze Lock (NO OVERRIDE ALLOWED)
echo ""
echo "========================================"
echo "CHECK 3: Freeze Lock Verification"
echo "========================================"

FREEZE_LOCK="$AUDIT_DIR/marketplace_submission/FREEZE_LOCK.json"
VERIFY_FREEZE="$AUDIT_DIR/verify_freeze_lock.sh"
GENERATE_FREEZE="$AUDIT_DIR/generate_freeze_lock.sh"

# HARDENED: Reject FIRSTTRY_ALLOW_NO_FREEZE entirely
if [[ "${FIRSTTRY_ALLOW_NO_FREEZE:-0}" == "1" ]]; then
    echo -e "${RED}FAIL: FREEZE_OVERRIDE_FORBIDDEN${NC}"
    echo -e "${RED}FIRSTTRY_ALLOW_NO_FREEZE is forbidden in proof/CI mode.${NC}"
    echo -e "${RED}Fix: Commit FREEZE_LOCK.json with: git add audit/marketplace_submission/FREEZE_LOCK.json && git commit -m 'chore: update freeze lock'${NC}"
    exit 1
fi

# Enforce freeze generator presence
if [[ ! -f "$GENERATE_FREEZE" ]] || [[ ! -x "$GENERATE_FREEZE" ]]; then
    echo -e "${RED}FAIL: FREEZE_GENERATOR_MISSING${NC}"
    echo -e "${RED}Required: audit/generate_freeze_lock.sh (executable)${NC}"
    exit 1
fi

# Check if FREEZE_LOCK exists
if [[ ! -f "$FREEZE_LOCK" ]]; then
    echo -e "${RED}FAIL: FREEZE_LOCK_MISSING${NC}"
    echo -e "${RED}Required: audit/marketplace_submission/FREEZE_LOCK.json${NC}"
    exit 1
fi

# HARDENED: Check if FREEZE_LOCK is dirty (modified or untracked)
if ! git diff --quiet --cached "$FREEZE_LOCK" 2>/dev/null || ! git diff --quiet "$FREEZE_LOCK" 2>/dev/null; then
    echo -e "${RED}FAIL: FREEZE_LOCK_DIRTY${NC}"
    echo -e "${RED}FREEZE_LOCK is dirty. Commit with:${NC}"
    echo -e "${RED}  git add $FREEZE_LOCK${NC}"
    echo -e "${RED}  git commit -m 'chore: update freeze lock'${NC}"
    exit 1
fi

if [[ ! -f "$VERIFY_FREEZE" ]]; then
    echo -e "${RED}FAIL: FREEZE_VERIFY_MISSING${NC}"
    echo -e "${RED}Required: audit/verify_freeze_lock.sh${NC}"
    exit 1
fi

# Run the verifier
echo -e "${YELLOW}Running freeze verification...${NC}"
VERIFY_OUTPUT=$(bash "$VERIFY_FREEZE" 2>&1) || {
    echo -e "${RED}FAIL: FREEZE_VERIFY_FAIL${NC}"
    exit 1
}

# Validate machine-readable proof output
if ! echo "$VERIFY_OUTPUT" | grep -q "COMPUTED_FROZEN_SHA="; then
    echo -e "${RED}FAIL: FREEZE_PROOF_MISSING_COMPUTED${NC}"
    exit 1
fi
if ! echo "$VERIFY_OUTPUT" | grep -q "LOCKED_FROZEN_SHA="; then
    echo -e "${RED}FAIL: FREEZE_PROOF_MISSING_LOCKED${NC}"
    exit 1
fi

echo "$VERIFY_OUTPUT"
echo -e "${GREEN}✓ Freeze verification passed${NC}"

# Check 3B: Manifest write-scope ban
echo ""
echo "========================================"
echo "CHECK 3B: Write-Scope Ban"
echo "========================================"

MANIFEST_FILE="$REPO_ROOT/manifest.yml"
if [[ -f "$MANIFEST_FILE" ]]; then
    WRITE_SCOPES=$(grep -E "^\s+(write|manage|admin|delete|update|transition):" "$MANIFEST_FILE" 2>/dev/null || true)
    if [[ -n "$WRITE_SCOPES" ]]; then
        echo -e "${RED}FAIL: WRITE_SCOPE_DETECTED${NC}"
        echo "Forbidden scopes found in manifest.yml:"
        echo "$WRITE_SCOPES"
        exit 1
    fi
    echo -e "${GREEN}✓ No write/manage/admin/delete/update/transition scopes${NC}"
else
    echo -e "${RED}FAIL: MANIFEST_NOT_FOUND${NC}"
    exit 1
fi

# Check 3C: Write-surface ban
echo ""
echo "========================================"
echo "CHECK 3C: Write-Surface Ban"
echo "========================================"

WRITE_PATTERNS=$(find "$REPO_ROOT" -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) ! -path "*/tests/*" ! -path "*/__tests__/*" ! -path "*/node_modules/*" ! -path "*/dist/*" -exec grep -l "requestJira.*POST\|requestJira.*PUT\|requestJira.*PATCH\|requestJira.*DELETE\|createIssue\|updateIssue\|deleteIssue" {} \; 2>/dev/null || true)
if [[ -n "$WRITE_PATTERNS" ]]; then
    echo -e "${RED}FAIL: WRITE_SURFACE_DETECTED${NC}"
    echo "Files with write APIs found:"
    echo "$WRITE_PATTERNS"
    exit 1
fi
echo -e "${GREEN}✓ No write APIs detected outside tests${NC}"

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

echo ""
echo "========================================"
echo "CHECK 4C: CSP Regression Gate"
echo "========================================"

if ! npm test -- CSP_NoInlineStyleAttributes; then
    echo -e "${RED}FAIL: CSP_VIOLATION_DETECTED${NC}"
    exit 1
fi

echo -e "${GREEN}✓ CHECK CSP: No inline styles detected${NC}"

# Check 5: Run npm audit (check for HIGH or CRITICAL without waiver)
echo ""
echo "========================================"
echo "CHECK 5: NPM Audit"
echo "========================================"

AUDIT_JSON=$(npm audit --json 2>/dev/null || echo "{}")

# Structural jq-based parsing - ensure numeric output with fallback to 0
HIGH_COUNT=$(echo "$AUDIT_JSON" | jq -r '[.. | objects | select(.severity? == "high")] | length' 2>/dev/null || echo "0")
HIGH_COUNT=${HIGH_COUNT:-0}
CRITICAL_COUNT=$(echo "$AUDIT_JSON" | jq -r '[.. | objects | select(.severity? == "critical")] | length' 2>/dev/null || echo "0")
CRITICAL_COUNT=${CRITICAL_COUNT:-0}

# Ensure values are numeric
if ! [[ "$HIGH_COUNT" =~ ^[0-9]+$ ]]; then HIGH_COUNT=0; fi
if ! [[ "$CRITICAL_COUNT" =~ ^[0-9]+$ ]]; then CRITICAL_COUNT=0; fi

if (( HIGH_COUNT + CRITICAL_COUNT > 0 )); then
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
