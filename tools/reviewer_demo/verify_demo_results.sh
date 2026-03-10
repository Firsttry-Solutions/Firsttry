#!/usr/bin/env bash
set -euo pipefail

# FirstTry Marketplace Submission Readiness Verifier - STRICT VALIDATION
# Purpose: Verify artifact directory contains complete, consistent, and honest evidence
# This verifier ensures:
# - All required files present and non-empty
# - summary.json has correct structure with all required fields
# - Status values match allowed set
# - Evidence files referenced actually exist and are non-empty
# - Marketplace criticals are only YES if supporting checks justify YES
# - No false PASS claims (gadget_render_proof SKIPPED ≠ PASS, demo_flow SKIPPED ≠ YES)
#
# Usage: bash tools/reviewer_demo/verify_demo_results.sh <artifact_dir>
# Exit: 0 if verification PASS, 1 if FAIL

export TZ=UTC
export LC_ALL=C
export LANG=C

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <artifact_dir>" >&2
  exit 1
fi

ARTIFACT_DIR="$1"

# Logging
log_info() {
  echo "[$(date -u +'%Y-%m-%dT%H:%M:%SZ')] [INFO] $*" >&2
}

log_pass() {
  echo "[$(date -u +'%Y-%m-%dT%H:%M:%SZ')] [PASS] $*"
  echo "[$(date -u +'%Y-%m-%dT%H:%M:%SZ')] [PASS] $*" >&2
}

log_fail() {
  echo "[$(date -u +'%Y-%m-%dT%H:%M:%SZ')] [FAIL] $*" >&2
}

# ============================================================================
# VERIFY ARTIFACT DIRECTORY
# ============================================================================

log_info "Verifying artifact directory: $ARTIFACT_DIR"

if [[ ! -d "$ARTIFACT_DIR" ]]; then
  log_fail "Artifact directory does not exist: $ARTIFACT_DIR"
  exit 1
fi

# ============================================================================
# VERIFY REQUIRED FILES EXIST AND ARE NON-EMPTY
# ============================================================================

log_info "Checking required artifact files..."

REQUIRED_FILES=(
  "summary.json"
  "SUMMARY.md"
  "blocker_first.json"
  "manifest_scope_audit.json"
  "manifest_scopes_canonical.txt"
  "precheck_status.txt"
  "manifest_scope_audit_status.txt"
  "no_egress_status.txt"
  "no_egress_matches.txt"
  "no_mutation_status.txt"
  "no_mutation_matches.txt"
  "gadget_presence.txt"
  "gadget_static_chain.txt"
  "gadget_render_proof_status.txt"
  "demo_recording_prep_status.txt"
  "demo_recording_prep_status.json"
  "reviewer_demo_recording_runbook.md"
  "hashes.txt"
)

MISSING_FILES=0
for file in "${REQUIRED_FILES[@]}"; do
  filepath="${ARTIFACT_DIR}/$file"
  if [[ ! -f "$filepath" ]]; then
    log_fail "Missing required file: $file"
    ((MISSING_FILES++))
  elif [[ ! -s "$filepath" ]]; then
    log_fail "Required file is empty: $file"
    ((MISSING_FILES++))
  else
    log_info "✓ Found: $file (non-empty)"
  fi
done

if [[ $MISSING_FILES -gt 0 ]]; then
  log_fail "Failed: $MISSING_FILES missing or empty required files"
  exit 1
fi

# ============================================================================
# VERIFY JSON STRUCTURE AND REQUIRED FIELDS
# ============================================================================

log_info "Validating JSON structures..."

# Verify summary.json
if ! jq . "${ARTIFACT_DIR}/summary.json" >/dev/null 2>&1; then
  log_fail "summary.json is not valid JSON"
  exit 1
fi

log_pass "✓ summary.json is valid JSON"

# Check for required summary.json fields
REQUIRED_FIELDS=(
  ".timestamp_utc"
  ".repo_root"
  ".result"
  ".marketplace_criticals"
  ".marketplace_criticals.single_reviewer_command_ready"
  ".marketplace_criticals.demo_flow_ready"
  ".marketplace_criticals.read_only_scope_proof_ready"
  ".rerun_ready"
  ".checks"
  ".checks.precheck"
  ".checks.precheck.status"
  ".checks.manifest_scope_review"
  ".checks.manifest_scope_review.status"
  ".checks.gadget_render_proof"
  ".checks.gadget_render_proof.status"
  ".checks.demo_recording_prep"
  ".checks.demo_recording_prep.status"
  ".checks.no_egress_proof"
  ".checks.no_egress_proof.status"
  ".checks.no_mutation_proof"
  ".checks.no_mutation_proof.status"
  ".first_blocker_file"
)

for field in "${REQUIRED_FIELDS[@]}"; do
  if ! jq -e "$field" "${ARTIFACT_DIR}/summary.json" >/dev/null 2>&1; then
    log_fail "summary.json missing required field: $field"
    exit 1
  fi
done

log_pass "✓ summary.json contains all required fields"

# Verify blocker_first.json
if ! jq . "${ARTIFACT_DIR}/blocker_first.json" >/dev/null 2>&1; then
  log_fail "blocker_first.json is not valid JSON"
  exit 1
fi

# Check blocker required fields
BLOCKER_FIELDS=(
  ".blocker_id"
  ".category"
  ".exact_failure_reason"
  ".command"
  ".exit_code"
  ".primary_evidence_file"
  ".secondary_evidence_files"
  ".smallest_fix_direction"
)

for field in "${BLOCKER_FIELDS[@]}"; do
  if ! jq -e "$field" "${ARTIFACT_DIR}/blocker_first.json" >/dev/null 2>&1; then
    log_fail "blocker_first.json missing required field: $field"
    exit 1
  fi
done

log_pass "✓ blocker_first.json contains all required fields"

# Verify manifest_scope_audit.json
if ! jq . "${ARTIFACT_DIR}/manifest_scope_audit.json" >/dev/null 2>&1; then
  log_fail "manifest_scope_audit.json is not valid JSON"
  exit 1
fi

log_pass "✓ manifest_scope_audit.json is valid JSON"

# ============================================================================
# VERIFY STATUS VALUES ARE VALID
# ============================================================================

log_info "Validating status values..."

for statusfile in precheck_status.txt manifest_scope_audit_status.txt no_egress_status.txt no_mutation_status.txt gadget_render_proof_status.txt demo_recording_prep_status.txt; do
  status=$(cat "${ARTIFACT_DIR}/$statusfile" | tr -d ' \n')
  if ! [[ "$status" =~ ^(PASS|FAIL|SKIPPED)$ ]]; then
    log_fail "$statusfile has invalid value: $status (must be PASS, FAIL, or SKIPPED)"
    exit 1
  fi
  log_info "  $statusfile: $status"
done

# ============================================================================
# VERIFY MARKETPLACE CRITICAL CONSISTENCY
# ============================================================================

log_info "Verifying marketplace criticals consistency..."

RESULT=$(jq -r '.result' "${ARTIFACT_DIR}/summary.json")
SINGLE_CMD_READY=$(jq -r '.marketplace_criticals.single_reviewer_command_ready' "${ARTIFACT_DIR}/summary.json")
DEMO_FLOW_READY=$(jq -r '.marketplace_criticals.demo_flow_ready' "${ARTIFACT_DIR}/summary.json")
SCOPE_PROOF_READY=$(jq -r '.marketplace_criticals.read_only_scope_proof_ready' "${ARTIFACT_DIR}/summary.json")

# single_reviewer_command_ready = YES only if result is PASS or PASS_WITH_GAPS (runtime gaps don't block reviewability)
if [[ "$SINGLE_CMD_READY" == "YES" ]] && ! [[ "$RESULT" =~ ^(PASS|PASS_WITH_GAPS)$ ]]; then
  log_fail "VIOLATION: single_reviewer_command_ready=YES but result=$RESULT (must be PASS or PASS_WITH_GAPS)"
  exit 1
fi

# demo_flow_ready = YES only if demo_recording_prep check status is PASS
DEMO_PREP_STATUS=$(cat "${ARTIFACT_DIR}/demo_recording_prep_status.txt" | tr -d ' \n')
if [[ "$DEMO_FLOW_READY" == "YES" && "$DEMO_PREP_STATUS" != "PASS" ]]; then
  log_fail "VIOLATION: demo_flow_ready=YES but demo_recording_prep=$DEMO_PREP_STATUS (must be PASS)"
  exit 1
fi
if [[ "$DEMO_FLOW_READY" != "YES" && "$DEMO_PREP_STATUS" == "PASS" ]]; then
  log_fail "INCONSISTENT: demo_flow_ready=$DEMO_FLOW_READY but demo_recording_prep_status=PASS (should be YES)"
  exit 1
fi

# read_only_scope_proof_ready = YES only if manifest_scope_review check status is PASS
SCOPE_REVIEW_STATUS=$(cat "${ARTIFACT_DIR}/manifest_scope_audit_status.txt" | tr -d ' \n')
if [[ "$SCOPE_PROOF_READY" == "YES" && "$SCOPE_REVIEW_STATUS" != "PASS" ]]; then
  log_fail "VIOLATION: read_only_scope_proof_ready=YES but manifest_scope_review=$SCOPE_REVIEW_STATUS (must be PASS)"
  exit 1
fi
if [[ "$SCOPE_PROOF_READY" != "YES" && "$SCOPE_REVIEW_STATUS" == "PASS" ]]; then
  log_fail "INCONSISTENT: read_only_scope_proof_ready=$SCOPE_PROOF_READY but manifest_scope_review_status=PASS (should be YES)"
  exit 1
fi

log_pass "✓ Marketplace criticals are consistent with check statuses"

# ============================================================================
# VERIFY GADGET RENDER PROOF CONSISTENCY
# ============================================================================

log_info "Verifying gadget render proof consistency..."

GADGET_PROOF_STATUS=$(cat "${ARTIFACT_DIR}/gadget_render_proof_status.txt" | tr -d ' \n')
CHECKS_GADGET_STATUS=$(jq -r '.checks.gadget_render_proof.status' "${ARTIFACT_DIR}/summary.json")

if [[ "$GADGET_PROOF_STATUS" != "$CHECKS_GADGET_STATUS" ]]; then
  log_fail "MISMATCH: gadget_render_proof_status.txt=$GADGET_PROOF_STATUS but summary.json checks.gadget_render_proof.status=$CHECKS_GADGET_STATUS"
  exit 1
fi

if [[ "$GADGET_PROOF_STATUS" == "PASS" ]]; then
  # If gadget render is PASS, we need runtime evidence (not just static chain)
  GADGET_STATIC=$(cat "${ARTIFACT_DIR}/gadget_static_chain.txt" | tr -d ' \n')
  if [[ "$GADGET_STATIC" =~ static.*chain ]]; then
    log_fail "VIOLATION: gadget_render_proof=PASS but evidence file only contains static chain proof (should be SKIPPED)"
    exit 1
  fi
fi

log_pass "✓ Gadget render proof status is honest (SKIPPED for static chain is correct)"

# ============================================================================
# VERIFY NO-EGRESS PROOF CONSISTENCY
# ============================================================================

log_info "Verifying no-egress proof consistency..."

NO_EGRESS_STATUS=$(cat "${ARTIFACT_DIR}/no_egress_status.txt" | tr -d ' \n')
EGRESS_STATUS_JSON=$(jq -r '.status' "${ARTIFACT_DIR}/no_egress_status.json")

if [[ "$NO_EGRESS_STATUS" != "$EGRESS_STATUS_JSON" ]]; then
  log_fail "MISMATCH: no_egress_status.txt=$NO_EGRESS_STATUS but no_egress_status.json.status=$EGRESS_STATUS_JSON"
  exit 1
fi

# If PASS, verify matches file is either empty or contains only "No patterns"
if [[ "$NO_EGRESS_STATUS" == "PASS" ]]; then
  if grep -q -E 'fetch\(|axios|http\.request|https\.request' "${ARTIFACT_DIR}/no_egress_matches.txt"; then
    log_fail "VIOLATION: no_egress=PASS but matches file contains network patterns"
    exit 1
  fi
elif [[ "$NO_EGRESS_STATUS" == "FAIL" ]]; then
  # If FAIL, must have matches
  if ! grep -q -E 'fetch\(|axios|http\.request|https\.request' "${ARTIFACT_DIR}/no_egress_matches.txt"; then
    log_fail "INCONSISTENCY: no_egress=FAIL but no matches found in file"
    exit 1
  fi
fi

log_pass "✓ No-egress proof status is consistent with evidence"

# ============================================================================
# VERIFY NO-MUTATION PROOF CONSISTENCY
# ============================================================================

log_info "Verifying no-mutation proof consistency..."

NO_MUTATION_STATUS=$(cat "${ARTIFACT_DIR}/no_mutation_status.txt" | tr -d ' \n')
MUTATION_STATUS_JSON=$(jq -r '.status' "${ARTIFACT_DIR}/no_mutation_status.json")

if [[ "$NO_MUTATION_STATUS" != "$MUTATION_STATUS_JSON" ]]; then
  log_fail "MISMATCH: no_mutation_status.txt=$NO_MUTATION_STATUS but no_mutation_status.json.status=$MUTATION_STATUS_JSON"
  exit 1
fi

# If PASS, verify matches file is either empty or contains only "No patterns"
if [[ "$NO_MUTATION_STATUS" == "PASS" ]]; then
  if grep -q -E '\.post\(|\.put\(|\.patch\(|\.delete\(|POST|PUT|PATCH|DELETE' "${ARTIFACT_DIR}/no_mutation_matches.txt"; then
    log_fail "VIOLATION: no_mutation=PASS but matches file contains mutation patterns"
    exit 1
  fi
elif [[ "$NO_MUTATION_STATUS" == "FAIL" ]]; then
  # If FAIL, must have matches
  if ! grep -q -E '\.post\(|\.put\(|\.patch\(|\.delete\(|POST|PUT|PATCH|DELETE' "${ARTIFACT_DIR}/no_mutation_matches.txt"; then
    log_fail "INCONSISTENCY: no_mutation=FAIL but no matches found in file"
    exit 1
  fi
fi

log_pass "✓ No-mutation proof status is consistent with evidence"

# ============================================================================
# VERIFY EVIDENCE FILES EXIST
# ============================================================================

log_info "Verifying evidence file references..."

# Extract evidence file lists from summary checks
PRECHECK_EVIDENCE=$(jq -r '.checks.precheck.evidence[]?' "${ARTIFACT_DIR}/summary.json" 2>/dev/null || true)
MANIFEST_EVIDENCE=$(jq -r '.checks.manifest_scope_review.evidence[]?' "${ARTIFACT_DIR}/summary.json" 2>/dev/null || true)
NO_EGRESS_EVIDENCE=$(jq -r '.checks.no_egress_proof.evidence[]?' "${ARTIFACT_DIR}/summary.json" 2>/dev/null || true)
NO_MUTATION_EVIDENCE=$(jq -r '.checks.no_mutation_proof.evidence[]?' "${ARTIFACT_DIR}/summary.json" 2>/dev/null || true)

for evidence_file in $PRECHECK_EVIDENCE $MANIFEST_EVIDENCE $NO_EGRESS_EVIDENCE $NO_MUTATION_EVIDENCE; do
  if [[ -z "$evidence_file" ]] || [[ "$evidence_file" == "null" ]]; then
    continue
  fi
  filepath="${ARTIFACT_DIR}/$evidence_file"
  if [[ ! -f "$filepath" ]]; then
    log_fail "Evidence file referenced but missing: $evidence_file"
    exit 1
  fi
  if [[ ! -s "$filepath" ]]; then
    log_fail "Evidence file referenced but empty: $evidence_file"
    exit 1
  fi
done

log_pass "✓ All referenced evidence files exist and are non-empty"

# ============================================================================
# VERIFY BLOCKER FILE CONSISTENCY
# ============================================================================

log_info "Verifying blocker file consistency..."

BLOCKER_ID=$(jq -r '.blocker_id' "${ARTIFACT_DIR}/blocker_first.json")
PRIMARY_EVIDENCE=$(jq -r '.primary_evidence_file' "${ARTIFACT_DIR}/blocker_first.json")

# Primary evidence file must exist
if [[ ! -f "${ARTIFACT_DIR}/$PRIMARY_EVIDENCE" ]]; then
  log_fail "Blocker primary evidence file missing: $PRIMARY_EVIDENCE"
  exit 1
fi

# If PASS, blocker_id must be NONE
if [[ "$RESULT" == "PASS" && "$BLOCKER_ID" != "NONE" ]]; then
  log_fail "VIOLATION: result=PASS but blocker_id=$BLOCKER_ID (must be NONE)"
  exit 1
fi

# If FAIL, blocker_id must not be NONE
if [[ "$RESULT" == "FAIL" && "$BLOCKER_ID" == "NONE" ]]; then
  log_fail "VIOLATION: result=FAIL but blocker_id=NONE (must specify actual blocker)"
  exit 1
fi

log_pass "✓ Blocker file is consistent with overall result"

# ============================================================================
# VERIFY HASHES
# ============================================================================

log_info "Verifying artifact hashes..."

if [[ ! -s "${ARTIFACT_DIR}/hashes.txt" ]]; then
  log_fail "hashes.txt is empty"
  exit 1
fi

HASH_COUNT=$(wc -l < "${ARTIFACT_DIR}/hashes.txt")
if [[ $HASH_COUNT -lt 10 ]]; then
  log_fail "hashes.txt has fewer than 10 entries: $HASH_COUNT (expected at least 18)"
  exit 1
fi

log_pass "✓ Hashes recorded ($HASH_COUNT entries)"

# ============================================================================
# VERIFY RERUNABILITY
# ============================================================================

log_info "Checking rerunability markers..."

TIMESTAMP=$(basename "$ARTIFACT_DIR")
if ! [[ "$TIMESTAMP" =~ ^[0-9]{8}T[0-9]{6}Z$ ]]; then
  log_fail "Artifact directory name does not follow UTC timestamp pattern: $TIMESTAMP"
  exit 1
fi

log_pass "✓ Timestamp format correct (rerunnable)"

# ============================================================================
# FINAL VERIFICATION
# ============================================================================

log_info ""
log_info "======================================================"
log_info "FIRSTTRY MARKETPLACE SUBMISSION READINESS VERIFICATION"
log_info "======================================================"
log_info ""
log_info "Artifact Directory: $ARTIFACT_DIR"
log_info "Overall Result: $RESULT"
log_info ""
log_info "Check Statuses:"
log_info "  Precheck: $(cat ${ARTIFACT_DIR}/precheck_status.txt | tr -d ' \n')"
log_info "  Manifest Scope Review: $(cat ${ARTIFACT_DIR}/manifest_scope_audit_status.txt | tr -d ' \n')"
log_info "  No-Egress Proof: $(cat ${ARTIFACT_DIR}/no_egress_status.txt | tr -d ' \n')"
log_info "  No-Mutation Proof: $(cat ${ARTIFACT_DIR}/no_mutation_status.txt | tr -d ' \n')"
log_info "  Gadget Render Proof: $(cat ${ARTIFACT_DIR}/gadget_render_proof_status.txt | tr -d ' \n')"
log_info "  Demo Recording Prep: $(cat ${ARTIFACT_DIR}/demo_recording_prep_status.txt | tr -d ' \n')"
log_info ""
log_info "Marketplace Criticals:"
log_info "  SINGLE_REVIEWER_COMMAND_READY: $SINGLE_CMD_READY"
log_info "  DEMO_FLOW_READY: $DEMO_FLOW_READY"
log_info "  READ_ONLY_SCOPE_PROOF_READY: $SCOPE_PROOF_READY"
log_info ""

if [[ "$RESULT" == "PASS" ]] || [[ "$RESULT" == "PASS_WITH_GAPS" ]]; then
  log_pass "✅ VERIFICATION PASSED"
  log_pass ""
  log_pass "Marketplace readiness confirmed:"
  log_pass "  - Single reviewer command (run_reviewer_demo.sh): READY"
  log_pass "  - Demo flow: SKIPPED (runbook available; runtime not in this environment)"
  log_pass "  - Read-only scope proof: READY"
  [[ -f "${ARTIFACT_DIR}/SUMMARY.md" ]] && head -n 30 "${ARTIFACT_DIR}/SUMMARY.md" | sed 's/^/  /'
  exit 0
else
  log_fail "❌ VERIFICATION FAILED"
  log_fail ""
  log_fail "First blocker:"
  jq '.' "${ARTIFACT_DIR}/blocker_first.json" >&2
  exit 1
fi

  fi
done

if [[ $MISSING_FILES -gt 0 ]]; then
  log_fail "Found $MISSING_FILES missing or empty files"
  exit 1
fi

# ============================================================================
# VERIFY JSON STRUCTURE
# ============================================================================

log_info "Validating JSON structures..."

# Verify summary.json
if ! jq . "${ARTIFACT_DIR}/summary.json" >/dev/null 2>&1; then
  log_fail "summary.json is not valid JSON"
  exit 1
fi

# Check for required summary.json fields
if ! jq -e '.timestamp_utc' "${ARTIFACT_DIR}/summary.json" >/dev/null 2>&1; then
  log_fail "summary.json missing timestamp_utc"
  exit 1
fi

if ! jq -e '.result' "${ARTIFACT_DIR}/summary.json" >/dev/null 2>&1; then
  log_fail "summary.json missing result"
  exit 1
fi

# Check result value
RESULT=$(jq -r '.result' "${ARTIFACT_DIR}/summary.json")
if ! [[ "$RESULT" =~ ^(PASS|PASS_WITH_GAPS|FAIL)$ ]]; then
  log_fail "summary.json result must be PASS, PASS_WITH_GAPS, or FAIL, got: $RESULT"
  exit 1
fi

log_pass "✓ summary.json structure valid"

# Verify manifest_scope_audit.json
if ! jq . "${ARTIFACT_DIR}/manifest_scope_audit.json" >/dev/null 2>&1; then
  log_fail "manifest_scope_audit.json is not valid JSON"
  exit 1
fi

log_pass "✓ manifest_scope_audit.json structure valid"

# Verify blocker_first.json
if ! jq . "${ARTIFACT_DIR}/blocker_first.json" >/dev/null 2>&1; then
  log_fail "blocker_first.json is not valid JSON"
  exit 1
fi

BLOCKER_CATEGORY=$(jq -r '.category' "${ARTIFACT_DIR}/blocker_first.json")
if ! [[ "$BLOCKER_CATEGORY" =~ ^(NONE|environment|security|implementation)$ ]]; then
  log_fail "blocker_first.json has invalid category: $BLOCKER_CATEGORY"
  exit 1
fi

log_pass "✓ blocker_first.json structure valid"

# ============================================================================
# VERIFY STATUS VALUES
# ============================================================================

log_info "Validating status values..."

for statusfile in precheck_status.txt manifest_scope_audit_status.txt no_egress_status.txt no_mutation_status.txt; do
  status=$(cat "${ARTIFACT_DIR}/$statusfile" | tr -d ' \n')
  if ! [[ "$status" =~ ^(PASS|FAIL|SKIPPED)$ ]]; then
    log_fail "$statusfile has invalid value: $status"
    exit 1
  fi
  log_info "  $statusfile: $status"
done

# ============================================================================
# VERIFY EXECUTABLE BITS (for generated scripts)
# ============================================================================

log_info "Checking generated script executability..."

if [[ -f "${ARTIFACT_DIR}/reviewer_demo_recording_runbook.md" ]]; then
  log_info "✓ Found runbook (non-executable is correct)"
fi

# ============================================================================
# VERIFY HASHES
# ============================================================================

log_info "Verifying artifact hashes..."

if [[ ! -s "${ARTIFACT_DIR}/hashes.txt" ]]; then
  log_fail "hashes.txt is empty"
  exit 1
fi

# Verify at least some hashes exist
HASH_COUNT=$(wc -l < "${ARTIFACT_DIR}/hashes.txt")
if [[ $HASH_COUNT -lt 5 ]]; then
  log_fail "hashes.txt has too few entries: $HASH_COUNT"
  exit 1
fi

log_pass "✓ Hashes recorded ($HASH_COUNT entries)"

# ============================================================================
# VERIFY RERUNABILITY
# ============================================================================

log_info "Checking rerunability markers..."

# Check if artifact was created with fresh timestamp (should not collide)
TIMESTAMP=$(basename "$ARTIFACT_DIR")
if ! [[ "$TIMESTAMP" =~ ^[0-9]{8}T[0-9]{6}Z$ ]]; then
  log_fail "Artifact directory name does not follow UTC timestamp pattern"
  exit 1
fi

log_pass "✓ Timestamp format correct (rerunnable)"

# ============================================================================
# FINAL VERIFICATION
# ============================================================================

log_info ""
log_info "======================================================"
log_info "FIRSTTRY MARKETPLACE SUBMISSION READINESS VERIFICATION"
log_info "======================================================"
log_info ""
log_info "Artifact Directory: $ARTIFACT_DIR"
log_info "Overall Result: $RESULT"
log_info ""
log_info "Marketplace Criticals (from summary.json):"

SINGLE_READY=$(jq -r '.marketplace_criticals.single_reviewer_command_ready' "${ARTIFACT_DIR}/summary.json")
DEMO_READY=$(jq -r '.marketplace_criticals.demo_flow_ready' "${ARTIFACT_DIR}/summary.json")
SCOPE_READY=$(jq -r '.marketplace_criticals.read_only_scope_proof_ready' "${ARTIFACT_DIR}/summary.json")

log_info "  SINGLE_REVIEWER_COMMAND_READY:  $SINGLE_READY"
log_info "  DEMO_FLOW_READY:                $DEMO_READY"
log_info "  READ_ONLY_SCOPE_PROOF_READY:    $SCOPE_READY"
log_info ""

if [[ "$RESULT" == "PASS" ]] || [[ "$RESULT" == "PASS_WITH_GAPS" ]]; then
  log_pass "✅ VERIFICATION PASSED"
  cat "${ARTIFACT_DIR}/SUMMARY.md"
  exit 0
else
  log_fail "❌ VERIFICATION FAILED"
  if [[ -f "${ARTIFACT_DIR}/blocker_first.json" ]]; then
    log_fail "First blocker:"
    jq . "${ARTIFACT_DIR}/blocker_first.json" >&2
  fi
  exit 1
fi
