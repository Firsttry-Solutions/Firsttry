#!/bin/bash
# Atlassian Marketplace Readiness Audit Runner
# Fail-closed, zero-egress, read-only audit system
# Exit 0 = PASS, Exit 1 = FAIL

set -euo pipefail

# Determine repo root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Create timestamped evidence directory
EVIDENCE_TIMESTAMP=$(date -u +%Y%m%dT%H%M%SZ)
EVIDENCE_DIR="/tmp/ft_marketplace_readiness_${EVIDENCE_TIMESTAMP}"
mkdir -p "$EVIDENCE_DIR"

# Export for all phase scripts
export REPO_ROOT
export EVIDENCE_DIR
export REPORT_PATH="$EVIDENCE_DIR/MARKETPLACE_READINESS_REPORT.md"
export VERDICT_PATH="$EVIDENCE_DIR/FINAL_VERDICT.txt"
export FULL="${FULL:-0}"

# Create empty FAILURES.txt for FULL run mode
FAIL_LIST_FILE="$EVIDENCE_DIR/FAILURES.txt"
touch "$FAIL_LIST_FILE"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

info() {
  echo -e "${BLUE}ℹ${NC} $*"
}

ok() {
  echo -e "${GREEN}✓${NC} $*"
}

warn() {
  echo -e "${YELLOW}⚠${NC} $*"
}

die() {
  echo -e "${RED}✗${NC} $*" >&2
  finalize "FAIL" "$*"
  exit 1
}

finalize() {
  local verdict="$1"
  local reason="${2:-}"
  
  # Write final verdict
  {
    echo "VERDICT: $verdict"
    echo "Timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo "Evidence: $EVIDENCE_DIR"
    if [ -n "$reason" ]; then
      echo "Reason: $reason"
    fi
  } > "$VERDICT_PATH"
  
  # Append to report
  echo "" >> "$REPORT_PATH"
  echo "---" >> "$REPORT_PATH"
  echo "" >> "$REPORT_PATH"
  echo "## FINAL VERDICT: **$verdict**" >> "$REPORT_PATH"
  if [ -n "$reason" ]; then
    echo "" >> "$REPORT_PATH"
    echo "**Reason:** $reason" >> "$REPORT_PATH"
  fi
  echo "" >> "$REPORT_PATH"
  echo "**Evidence Directory:** \`$EVIDENCE_DIR\`" >> "$REPORT_PATH"
  echo "" >> "$REPORT_PATH"
  echo "**Timestamp:** $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$REPORT_PATH"
}

# Initialize report
cat > "$REPORT_PATH" <<EOF
# Atlassian Marketplace Readiness Audit Report

**Generated:** $(date -u +%Y-%m-%dT%H:%M:%SZ)  
**Evidence Directory:** \`$EVIDENCE_DIR\`  
**Repository:** \`$REPO_ROOT\`

---

## Audit Overview

This audit validates marketplace submission readiness with hostile scrutiny from a new vendor perspective.

**Policies:**
- Fail-closed: Any failure blocks marketplace submission
- Zero-egress: No external HTTP calls allowed
- Read-only Jira: No POST/PUT/PATCH/DELETE operations
- No console.log in production code
- No disallowed APIs (child_process, eval, etc.)
- No HIGH/CRITICAL vulnerabilities

**Phases:** 17 comprehensive validation checks

---

## Phase Results

EOF

info "Starting Atlassian Marketplace Readiness Audit"
info "Evidence directory: $EVIDENCE_DIR"
info "Repository: $REPO_ROOT"
if [ "${FULL}" = "1" ]; then
  info "Mode: FULL RUN (collect all failures)"
else
  info "Mode: STOP ON FIRST FAIL"
fi
echo ""

# Array of all phase scripts
PHASES=(
  "01_check_repo_integrity.sh"
  "02_check_manifest_and_modules.sh"
  "03_check_scopes_and_justification.sh"
  "04_check_security_boundaries_zero_egress.sh"
  "05_check_storage_and_data_flow.sh"
  "06_check_uninstall_and_data_deletion.sh"
  "07_check_logging_and_pii.sh"
  "08_check_runtime_safety_disallowed_apis.sh"
  "09_check_dependencies_security.sh"
  "10_check_build_and_tests.sh"
  "11_check_ci_integrity.sh"
  "12_check_docs_listing_artifacts.sh"
  "13_check_versioning_changelog_release.sh"
  "14_check_license_eula_consistency.sh"
  "15_check_feature_claims_no_overreach.sh"
  "16_check_assets_screenshots_pricing.sh"
  "17_check_reviewer_simulation_checklist.sh"
)

# Run all phases
PHASE_NUM=1
TOTAL_PHASES=${#PHASES[@]}
RUNNER_FAIL_COUNT=0

for phase in "${PHASES[@]}"; do
  info "[$PHASE_NUM/$TOTAL_PHASES] Running: $phase"
  
  PHASE_SCRIPT="$SCRIPT_DIR/lib/$phase"
  
  if [ ! -f "$PHASE_SCRIPT" ]; then
    die "Phase script not found: $PHASE_SCRIPT"
  fi
  
  # Run phase and capture exit code
  rc=0
  ( bash "$PHASE_SCRIPT" ) || rc=$?
  
  if [ $rc -ne 0 ]; then
    if [ "${FULL:-0}" = "1" ]; then
      # FULL run mode: record failure and continue
      PHASE_EVIDENCE_DIR="$EVIDENCE_DIR/PHASE_$(printf "%02d" "$PHASE_NUM")_${phase%.sh}"
      echo "PHASE=RUNNER :: Phase script exited non-zero: $phase (rc=$rc) :: EVIDENCE=$PHASE_EVIDENCE_DIR" >> "$FAIL_LIST_FILE"
      RUNNER_FAIL_COUNT=$((RUNNER_FAIL_COUNT + 1))
      warn "Phase $phase FAILED (continuing in FULL mode)"
    else
      # Stop on first fail (default behavior)
      die "Phase $PHASE_NUM failed: $phase"
    fi
  fi
  
  echo ""
  PHASE_NUM=$((PHASE_NUM + 1))
done

# Check final status
if [ "${FULL:-0}" = "1" ]; then
  # In FULL mode, check if any failures were recorded
  if [ -s "$FAIL_LIST_FILE" ] || [ $RUNNER_FAIL_COUNT -gt 0 ]; then
    # Failures found
    TOTAL_FAILS=$(wc -l < "$FAIL_LIST_FILE")
    warn "FULL RUN COMPLETE: $TOTAL_FAILS failure(s) recorded"
    
    # Append failures summary to report
    echo "" >> "$REPORT_PATH"
    echo "---" >> "$REPORT_PATH"
    echo "" >> "$REPORT_PATH"
    echo "## FAILURES SUMMARY" >> "$REPORT_PATH"
    echo "" >> "$REPORT_PATH"
    echo "**Total Failures:** $TOTAL_FAILS" >> "$REPORT_PATH"
    echo "" >> "$REPORT_PATH"
    echo "\`\`\`" >> "$REPORT_PATH"
    cat "$FAIL_LIST_FILE" >> "$REPORT_PATH"
    echo "\`\`\`" >> "$REPORT_PATH"
    
    finalize "FAIL" "Multiple failures found (see FAILURES.txt)"
    
    echo ""
    info "═══════════════════════════════════════════════════════════"
    echo -e "${RED}✗${NC} MARKETPLACE READINESS AUDIT: FAIL"
    info "═══════════════════════════════════════════════════════════"
    echo ""
    info "Evidence directory: $EVIDENCE_DIR"
    info "Failures list: $FAIL_LIST_FILE"
    info "Full report: $REPORT_PATH"
    echo ""
    
    exit 1
  fi
fi

# All phases passed
ok "All $TOTAL_PHASES phases PASSED"
echo ""

finalize "PASS"

echo ""
info "═══════════════════════════════════════════════════════════"
ok "MARKETPLACE READINESS AUDIT: PASS"
info "═══════════════════════════════════════════════════════════"
echo ""
info "Evidence directory: $EVIDENCE_DIR"
info "Final verdict: $VERDICT_PATH"
info "Full report: $REPORT_PATH"
echo ""

exit 0
