#!/bin/bash

##############################################################################
# PHASE 3 v3.2.4 - PRODUCTION TRUTH GATE (Production Only)
# TRUTH FIX: NO SKIPPED_OK. Requires FORGE_ENV=production.
# Fail-closed: any failure stops execution
##############################################################################

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

source "$SCRIPT_DIR/_lib_proof.sh"

MASTER_EVIDENCE_DIR=$(mk_evidence_dir "ft_prod_truth_gate")
GATE_LOG="$MASTER_EVIDENCE_DIR/prod-truth-gate.log"

export MASTER_EVIDENCE_DIR

exec > >(tee -a "$GATE_LOG")
exec 2> >(tee -a "$GATE_LOG" >&2)

##############################################################################
# Main Gate
##############################################################################

run_gate() {
  log_info "==================================================================="
  log_info "PHASE 3 v3.2.4 PRODUCTION TRUTH GATE"
  log_info "NO SKIPPED_OK. Requires FORGE_ENV=production."
  log_info "Fail-closed: any failure stops execution"
  log_info "==================================================================="
  log_info "Evidence directory: $MASTER_EVIDENCE_DIR"
  log_info ""

  # ========================================================================
  # GATE 1: REQUIRE PRODUCTION ENVIRONMENT
  # ========================================================================
  log_info "GATE 1/6: Checking production environment..."
  if [[ -z "${FORGE_ENV:-}" ]]; then
    log_fail "PROD_ENV_REQUIRED - FORGE_ENV not set"
    log_info "Usage: FORGE_ENV=production bash $0"
    return 1
  fi

  if [[ "$FORGE_ENV" != "production" ]]; then
    log_fail "PROD_ENV_REQUIRED - FORGE_ENV must be 'production', got '$FORGE_ENV'"
    return 1
  fi

  log_pass "FORGE_ENV=production confirmed"
  log_marker "[FT_PROOF_PROD_ENV_SET]"

  # ========================================================================
  # GATE 2: FORGE AUTHENTICATION
  # ========================================================================
  log_info ""
  log_info "GATE 2/6: Verifying Forge authentication..."
  if ! command -v forge &> /dev/null; then
    log_fail "FORGE_CLI_NOT_FOUND - Forge CLI required for production gate"
    return 1
  fi

  if ! forge whoami > "$MASTER_EVIDENCE_DIR/forge-whoami.txt" 2>&1; then
    log_fail "FORGE_AUTH_FAILED - forge whoami failed (not authenticated)"
    cat "$MASTER_EVIDENCE_DIR/forge-whoami.txt"
    return 1
  fi

  log_pass "Forge authenticated"
  log_marker "[FT_PROOF_FORGE_AUTH_OK]"

  # ========================================================================
  # GATE 3: FORGE VERSION LIST
  # ========================================================================
  log_info ""
  log_info "GATE 3/6: Checking Forge version in production..."
  if ! forge version list -e production > "$MASTER_EVIDENCE_DIR/forge-version.txt" 2>&1; then
    log_fail "FORGE_VERSION_FAILED - could not retrieve version from production"
    cat "$MASTER_EVIDENCE_DIR/forge-version.txt"
    return 1
  fi

  log_pass "Forge version list retrieved"
  log_marker "[FT_PROOF_FORGE_VERSION_OK]"

  # ========================================================================
  # GATE 4: FETCH PRODUCTION LOGS
  # ========================================================================
  log_info ""
  log_info "GATE 4/6: Fetching production logs..."
  if ! forge logs -e production --tail 400 > "$MASTER_EVIDENCE_DIR/prod-logs.txt" 2>&1; then
    log_fail "PROD_LOGS_FAILED - could not fetch production logs"
    cat "$MASTER_EVIDENCE_DIR/prod-logs.txt"
    return 1
  fi

  if [[ ! -s "$MASTER_EVIDENCE_DIR/prod-logs.txt" ]]; then
    log_fail "PROD_LOGS_EMPTY - no production logs available"
    return 1
  fi

  log_pass "Production logs fetched"
  log_marker "[FT_PROOF_PROD_LOGS_FETCHED]"

  # ========================================================================
  # GATE 5: VERIFY REQUIRED MARKERS IN LOGS
  # ========================================================================
  log_info ""
  log_info "GATE 5/6: Verifying required markers in production logs..."

  local required_markers=(
    "FT_PROOF_PHASE32_BORING_RELIABILITY_PASS"
    "FT_REVIEW_EXPORT_COMPLETE"
  )

  local missing_markers=0

  for marker in "${required_markers[@]}"; do
    if grep -q "$marker" "$MASTER_EVIDENCE_DIR/prod-logs.txt" 2>/dev/null; then
      log_pass "Marker found: $marker"
    else
      log_fail "MARKER_MISSING: $marker not found in production logs"
      missing_markers=$((missing_markers + 1))
    fi
  done

  if [[ $missing_markers -gt 0 ]]; then
    log_fail "PROD_MARKERS_INCOMPLETE - $missing_markers required markers missing"
    return 1
  fi

  log_marker "[FT_PROOF_PROD_MARKERS_OK]"

  # ========================================================================
  # GATE 6: FINAL VERIFICATION
  # ========================================================================
  log_info ""
  log_info "GATE 6/6: Final production verification..."
  log_marker "[FT_PROOF_PROD_TRUTH_GATE_START_FINAL]"

  log_pass "✓ ALL 6 PRODUCTION GATES PASSED"
  log_marker "[FT_PROOF_PROD_TRUTH_GATE_PASS]"
  log_info ""
  log_info "==================================================================="
  log_info "✓ v3.2.4 PRODUCTION TRUTH GATE - ALL GATES PASSED (NO SKIPS)"
  log_info "Evidence: $MASTER_EVIDENCE_DIR"
  log_info "  - Environment: FORGE_ENV=production"
  log_info "  - Authentication: VERIFIED"
  log_info "  - Forge Version: RETRIEVED"
  log_info "  - Production Logs: FETCHED"
  log_info "  - Required Markers: VERIFIED"
  log_info "==================================================================="

  return 0
}

##############################################################################
# Main
##############################################################################

if run_gate; then
  exit 0
else
  log_info ""
  log_info "==================================================================="
  log_fail "PRODUCTION TRUTH GATE FAILED - check evidence above"
  log_info "==================================================================="
  exit 1
fi
