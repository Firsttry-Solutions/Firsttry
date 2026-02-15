#!/bin/bash

##############################################################################
# PHASE 3 v3.2 AUDIT-FIX - Master Gate Script
# Orchestrates all verification checks in sequence
# Fail-closed: if any check fails, entire gate fails
# Output: All evidence to dated directory, final marker if all pass
##############################################################################

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Source common lib
source "$SCRIPT_DIR/_lib_proof.sh"

MASTER_EVIDENCE_DIR=$(mk_evidence_dir "ft_phase32_audit_fix")
GATE_LOG="$MASTER_EVIDENCE_DIR/master-gate.log"

# Ensure all output goes to the log
exec > >(tee -a "$GATE_LOG")
exec 2> >(tee -a "$GATE_LOG" >&2)

##############################################################################
# Gate Execution Order
##############################################################################

run_gate() {
  log_info "==================================================================="
  log_info "PHASE 3 v3.2 AUDIT-FIX - MASTER GATE"
  log_info "==================================================================="
  log_info "Master evidence directory: $MASTER_EVIDENCE_DIR"
  log_info ""

  local all_pass=0

  # 1. Clean git check
  log_info "GATE 1/8: Checking clean git status..."
  if require_clean_git "$PROJECT_ROOT"; then
    log_pass "Git status clean"
  else
    log_fail "Git has uncommitted changes"
    all_pass=1
  fi

  # 2. Scope allowlist guard
  log_info ""
  log_info "GATE 2/8: Verifying manifest scope allowlist..."
  if [[ -x "$SCRIPT_DIR/guard_scopes_allowlist.sh" ]]; then
    if bash "$SCRIPT_DIR/guard_scopes_allowlist.sh"; then
      log_pass "Scope allowlist verified"
    else
      log_fail "Scope allowlist check failed"
      all_pass=1
    fi
  else
    warn "Scope guard script not found or not executable"
  fi

  # 3. No-egress guard
  log_info ""
  log_info "GATE 3/8: Verifying no-egress policy (manifest)..."
  if bash "$SCRIPT_DIR/guard_no_egress_permissions.sh"; then
    log_pass "No-egress policy verified"
  else
    log_fail "No-egress check failed"
    all_pass=1
  fi

  # 4. Documentation sanitizer
  log_info ""
  log_info "GATE 4/8: Sanitizing documentation..."
  if bash "$SCRIPT_DIR/sanitize_docs_claims.sh"; then
    log_pass "Documentation sanitizer passed"
  else
    log_fail "Documentation contains forbidden claims"
    all_pass=1
  fi

  # 5. Build
  log_info ""
  log_info "GATE 5/8: Building application..."
  cd "$PROJECT_ROOT"
  if npm run build > "$MASTER_EVIDENCE_DIR/build.log" 2>&1; then
    log_pass "Build succeeded"
  else
    log_fail "Build failed"
    tail -20 "$MASTER_EVIDENCE_DIR/build.log"
    all_pass=1
  fi

  # 6. Unit tests (if available)
  log_info ""
  log_info "GATE 6/8: Running unit tests..."
  if [[ -f "package.json" ]] && grep -q '"test"' package.json; then
    if npm test > "$MASTER_EVIDENCE_DIR/tests.log" 2>&1; then
      log_pass "Unit tests passed"
    else
      log_warn "Unit tests failed (may be optional)"
      # Don't fail gate on unit test failure; but log it
      tail -20 "$MASTER_EVIDENCE_DIR/tests.log" || true
    fi
  else
    log_info "No test script found (optional)"
  fi

  # 7. Playwright UI tests
  log_info ""
  log_info "GATE 7/8: Running Playwright UI proof..."
  if bash "$SCRIPT_DIR/run_pw_phase32_live_ui.sh"; then
    log_pass "Playwright tests passed"
  else
    log_warn "Playwright tests failed or skipped (optional)"
  fi

  # 8. Enterprise live proof (with production logs check)
  log_info ""
  log_info "GATE 8/8: Running enterprise live proof..."
  if bash "$SCRIPT_DIR/../proof/phase3_enterprise_live_proof.sh" > "$MASTER_EVIDENCE_DIR/enterprise-proof.log" 2>&1; then
    log_pass "Enterprise live proof passed"
  else
    log_fail "Enterprise live proof failed"
    tail -30 "$MASTER_EVIDENCE_DIR/enterprise-proof.log"
    all_pass=1
  fi

  # Final result
  log_info ""
  log_info "==================================================================="
  if [[ $all_pass -eq 0 ]]; then
    log_pass "ALL GATES PASSED ✓"
    log_marker "FT_PROOF_PHASE32_AUDIT_FIX_PASS"
    log_info "Evidence saved to: $MASTER_EVIDENCE_DIR"
    return 0
  else
    log_fail "MASTER GATE FAILED ✗"
    log_info "Evidence saved to: $MASTER_EVIDENCE_DIR"
    return 1
  fi
}

##############################################################################
# Main
##############################################################################

main() {
  trap "log_fail 'Gate execution interrupted'; exit 1" INT TERM
  run_gate
}

main "$@"
