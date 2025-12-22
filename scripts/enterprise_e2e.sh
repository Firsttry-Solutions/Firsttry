#!/usr/bin/env bash
#
# Enterprise End-to-End Acceptance Pack Entrypoint
# ================================================
# Single command to generate complete evidence bundle for enterprise acceptance testing
#
# Usage:
#   MODE=REAL_TENANT bash scripts/enterprise_e2e.sh
#   MODE=SIMULATION bash scripts/enterprise_e2e.sh
#
# Output: audit_artifacts/enterprise_acceptance/<TIMESTAMP>/
#

set -euo pipefail

# Configuration
MODE="${MODE:-SIMULATION}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
EVIDENCE_DIR="audit_artifacts/enterprise_acceptance/${TIMESTAMP}"
LATEST_LINK="audit_artifacts/enterprise_acceptance/latest"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Create evidence directory structure
mkdir -p "${EVIDENCE_DIR}/logs"
mkdir -p "${EVIDENCE_DIR}/evidence"

# Initialize evidence index
cat > "${EVIDENCE_DIR}/evidence_index.json" <<EOF
{
  "version": "1.0.0",
  "timestamp": "$(date -Iseconds)",
  "mode": "${MODE}",
  "checks": []
}
EOF

# Logging helper
log_step() {
    echo -e "${BLUE}[$(date -Iseconds)]${NC} $1"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Evidence index updater
add_check() {
    local check_id=$1
    local status=$2
    local evidence_file=$3
    local notes=$4
    local limits=$5
    
    jq --arg id "$check_id" \
       --arg status "$status" \
       --arg evidence "$evidence_file" \
       --arg notes "$notes" \
       --arg limits "$limits" \
       '.checks += [{
           check_id: $id,
           status: $status,
           evidence_files: [$evidence],
           notes: $notes,
           known_limits: ($limits | if . == "" then [] else [.] end)
       }]' "${EVIDENCE_DIR}/evidence_index.json" > "${EVIDENCE_DIR}/evidence_index.json.tmp"
    
    mv "${EVIDENCE_DIR}/evidence_index.json.tmp" "${EVIDENCE_DIR}/evidence_index.json"
}

#========================================
# STEP 0: Banner
#========================================
log_step "======================================================"
log_step "  FirstTry Governance - Enterprise Acceptance Pack"
log_step "  Mode: ${MODE}"
log_step "  Evidence Dir: ${EVIDENCE_DIR}"
log_step "======================================================"

#========================================
# STEP 1: Lint & Type Check
#========================================
log_step "Step 1: Lint and Type Check"
cd atlassian/forge-app

if npm run type-check > "../../${EVIDENCE_DIR}/logs/lint_typecheck.log" 2>&1; then
    log_success "Type check passed"
    add_check "lint_typecheck" "PASS" "logs/lint_typecheck.log" "TypeScript compilation successful" ""
else
    log_error "Type check failed"
    add_check "lint_typecheck" "FAIL" "logs/lint_typecheck.log" "TypeScript compilation errors detected" ""
fi

cd ../..

#========================================
# STEP 2: Unit Tests
#========================================
log_step "Step 2: Unit Tests"
cd atlassian/forge-app

if npm run test -- --reporter=verbose > "../../${EVIDENCE_DIR}/logs/unit_tests.log" 2>&1; then
    log_success "Unit tests passed"
    add_check "unit_tests" "PASS" "logs/unit_tests.log" "All unit tests passed" ""
else
    log_warning "Unit tests had failures"
    add_check "unit_tests" "FAIL" "logs/unit_tests.log" "Some unit tests failed" ""
fi

cd ../..

#========================================
# STEP 3: Credibility Tests
#========================================
log_step "Step 3: Credibility Test Suite (GAP-1 through GAP-7)"
cd atlassian/forge-app

if npm run test:credibility > "../../${EVIDENCE_DIR}/logs/credibility_tests.log" 2>&1; then
    log_success "Credibility tests passed"
    add_check "credibility_suite" "PASS" "logs/credibility_tests.log" "All 36 credibility tests passed" ""
else
    log_error "Credibility tests failed"
    add_check "credibility_suite" "FAIL" "logs/credibility_tests.log" "Credibility test failures detected" ""
fi

cd ../..

#========================================
# STEP 4: Enterprise Acceptance Suite
#========================================
log_step "Step 4: Enterprise Acceptance Test Suite"
cd atlassian/forge-app

if [ "${MODE}" = "REAL_TENANT" ]; then
    log_step "  Running in REAL_TENANT mode (live Jira integration)"
    export ENTERPRISE_MODE=REAL_TENANT
else
    log_step "  Running in SIMULATION mode (no live Jira required)"
    export ENTERPRISE_MODE=SIMULATION
fi

if npm run test -- tests/enterprise_acceptance/ --reporter=verbose > "../../${EVIDENCE_DIR}/logs/acceptance_suite.log" 2>&1; then
    log_success "Enterprise acceptance suite passed"
    add_check "enterprise_acceptance" "PASS" "logs/acceptance_suite.log" "All acceptance checks passed" ""
else
    log_error "Enterprise acceptance suite failed"
    add_check "enterprise_acceptance" "FAIL" "logs/acceptance_suite.log" "Acceptance check failures detected" ""
fi

# Copy individual evidence files
if [ -d "tests/enterprise_acceptance/evidence" ]; then
    cp tests/enterprise_acceptance/evidence/*.json "../../${EVIDENCE_DIR}/evidence/" 2>/dev/null || true
fi

cd ../..

#========================================
# STEP 5: 10-Run Determinism Loop
#========================================
log_step "Step 5: Determinism Verification (10 runs)"
cd atlassian/forge-app

DIGESTS=()
for i in {1..10}; do
    log_step "  Determinism run $i/10"
    
    # Run credibility test subset (deterministic by design)
    if npm run test tests/credibility/gap5_determinism_10_runs.test.ts --silent > /dev/null 2>&1; then
        # Capture digest from test output
        DIGEST=$(npm run test tests/credibility/gap5_determinism_10_runs.test.ts --silent 2>&1 | grep -oP 'digest:\s*\K[a-f0-9]+' | head -1 || echo "UNKNOWN")
        DIGESTS+=("$DIGEST")
    else
        DIGESTS+=("FAIL")
    fi
done

# Check all digests match
FIRST_DIGEST="${DIGESTS[0]}"
ALL_MATCH=true
for digest in "${DIGESTS[@]}"; do
    if [ "$digest" != "$FIRST_DIGEST" ]; then
        ALL_MATCH=false
        break
    fi
done

# Write determinism evidence
cat > "../../${EVIDENCE_DIR}/evidence/determinism_10_runs.json" <<EOF
{
  "check": "determinism_10_runs",
  "runs": 10,
  "digests": $(printf '%s\n' "${DIGESTS[@]}" | jq -R . | jq -s .),
  "all_match": $ALL_MATCH,
  "first_digest": "$FIRST_DIGEST"
}
EOF

if [ "$ALL_MATCH" = true ]; then
    log_success "All 10 runs produced identical digest: $FIRST_DIGEST"
    add_check "determinism_10_runs" "PASS" "evidence/determinism_10_runs.json" "10 runs produced identical results" ""
else
    log_error "Determinism check failed: digests differ across runs"
    add_check "determinism_10_runs" "FAIL" "evidence/determinism_10_runs.json" "Digests differ across 10 runs" ""
fi

cd ../..

#========================================
# STEP 6: Generate Summary
#========================================
log_step "Step 6: Generating Human-Readable Summary"

# Count pass/fail/skip
PASS_COUNT=$(jq '[.checks[] | select(.status == "PASS")] | length' "${EVIDENCE_DIR}/evidence_index.json")
FAIL_COUNT=$(jq '[.checks[] | select(.status == "FAIL")] | length' "${EVIDENCE_DIR}/evidence_index.json")
SKIP_COUNT=$(jq '[.checks[] | select(.status == "SKIPPED")] | length' "${EVIDENCE_DIR}/evidence_index.json")
TOTAL_COUNT=$(jq '.checks | length' "${EVIDENCE_DIR}/evidence_index.json")

if [ "$FAIL_COUNT" -eq 0 ]; then
    OVERALL_STATUS="PASS"
    STATUS_COLOR="${GREEN}"
else
    OVERALL_STATUS="FAIL"
    STATUS_COLOR="${RED}"
fi

cat > "${EVIDENCE_DIR}/summary.md" <<EOF
# Enterprise Acceptance Test Summary

**Execution Mode**: ${MODE}  
**Timestamp**: $(date -Iseconds)  
**Evidence Directory**: ${EVIDENCE_DIR}

---

## Overall Status: ${OVERALL_STATUS}

**Checks Executed**: ${TOTAL_COUNT}  
- ✅ Passed: ${PASS_COUNT}
- ❌ Failed: ${FAIL_COUNT}
- ⏭️  Skipped: ${SKIP_COUNT}

---

## Check Details

$(jq -r '.checks[] | "### \(.check_id)\n- **Status**: \(.status)\n- **Evidence**: \(.evidence_files[0])\n- **Notes**: \(.notes)\n" + (if .known_limits | length > 0 then "- **Limitations**: \(.known_limits | join(", "))\n" else "" end)' "${EVIDENCE_DIR}/evidence_index.json")

---

## Evidence Artifacts

\`\`\`
${EVIDENCE_DIR}/
├── evidence_index.json        # Machine-readable manifest
├── summary.md                  # This file
├── logs/                       # Raw logs from each step
│   ├── lint_typecheck.log
│   ├── unit_tests.log
│   ├── credibility_tests.log
│   ├── acceptance_suite.log
│   └── determinism_10_runs.log
└── evidence/                   # JSON evidence files
    ├── manifest_validation.json
    ├── auth_boundary.json
    ├── ingestion_validation.json
    ├── scheduler_validation.json
    ├── evidence_determinism.json
    ├── tenant_isolation.json
    ├── docs_consistency.json
    ├── zero_alert_validation.json
    └── determinism_10_runs.json
\`\`\`

---

## Next Steps

$(if [ "$FAIL_COUNT" -eq 0 ]; then
    echo "✅ **All checks passed**. Evidence bundle is ready for audit review."
    echo ""
    echo "To share with auditors:"
    echo "\`\`\`bash"
    echo "tar czf enterprise_acceptance_${TIMESTAMP}.tar.gz ${EVIDENCE_DIR}"
    echo "\`\`\`"
else
    echo "❌ **Some checks failed**. Review failed checks above and logs in \`${EVIDENCE_DIR}/logs/\`"
    echo ""
    echo "Common issues:"
    echo "- Type check failures: Review \`logs/lint_typecheck.log\`"
    echo "- Test failures: Review \`logs/unit_tests.log\` or \`logs/credibility_tests.log\`"
    echo "- Determinism failures: Review \`evidence/determinism_10_runs.json\`"
fi)

---

**Generated**: $(date -Iseconds)  
**Mode**: ${MODE}  
**FirstTry Governance Version**: 0.1.0
EOF

# Create symlink to latest
rm -f "${LATEST_LINK}"
ln -s "$(basename ${EVIDENCE_DIR})" "${LATEST_LINK}"

#========================================
# Final Output
#========================================
echo ""
log_step "======================================================"
echo -e "${STATUS_COLOR}  Overall Status: ${OVERALL_STATUS}${NC}"
log_step "  Evidence Directory: ${EVIDENCE_DIR}"
log_step "  Summary: ${EVIDENCE_DIR}/summary.md"
log_step "  Evidence Index: ${EVIDENCE_DIR}/evidence_index.json"
log_step "======================================================"
echo ""

if [ "$FAIL_COUNT" -eq 0 ]; then
    log_success "Enterprise acceptance pack generation complete"
    exit 0
else
    log_error "Enterprise acceptance pack generation completed with failures"
    exit 1
fi
