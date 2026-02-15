#!/bin/bash

##############################################################################
# PHASE 3 v3.2.3 BORING RELIABILITY - Master Gate Script
# STRICT: No skips, no optionals, no fallbacks
# Every gate must PASS or entire thing FAILs
# Fail-closed, deterministic, reviewable
##############################################################################

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Source common lib
source "$SCRIPT_DIR/_lib_proof.sh"

MASTER_EVIDENCE_DIR=$(mk_evidence_dir "ft_phase32_boring")
GATE_LOG="$MASTER_EVIDENCE_DIR/master-gate.log"

# Export for child scripts
export MASTER_EVIDENCE_DIR

# Ensure all output goes to the log
exec > >(tee -a "$GATE_LOG")
exec 2> >(tee -a "$GATE_LOG" >&2)

##############################################################################
# Helper: Strict Git Clean Check
##############################################################################

check_repo_clean_strict() {
  local repo_root="$1"
  
  # Check for unstaged changes
  if ! git -C "$repo_root" diff --quiet 2>/dev/null; then
    return 1
  fi
  
  # Check for staged changes
  if ! git -C "$repo_root" diff --cached --quiet 2>/dev/null; then
    return 1
  fi
  
  # Check for untracked files (may be OK, but verify)
  # We'll allow untracked, but no staged or unstaged
  return 0
}

##############################################################################
# Gate Execution Order
##############################################################################

run_gate() {
  log_info "==================================================================="
  log_info "PHASE 3 v3.2.3 BORING RELIABILITY MASTER GATE"
  log_info "NO SKIPS. NO OPTIONALS. FAIL-CLOSED."
  log_info "==================================================================="
  log_info "Evidence directory: $MASTER_EVIDENCE_DIR"
  log_info ""

  local all_pass=0

  # ========================================================================
  # GATE 1: STRICT REPO CLEAN
  # ========================================================================
  log_info "GATE 1/10: Checking STRICT repo clean (no staged/unstaged changes)..."
  cd "$PROJECT_ROOT"
  if check_repo_clean_strict "$PROJECT_ROOT"; then
    log_pass "Git repo is CLEAN (no staged/unstaged changes)"
    log_marker "[FT_PROOF_REPO_CLEAN]"
  else
    log_fail "REPO_IS_DIRTY - staged or unstaged changes present"
    git diff --stat || true
    git diff --cached --stat || true
    all_pass=1
  fi

  # ========================================================================
  # GATE 2: MANIFEST SCOPE ALLOWLIST
  # ========================================================================
  log_info ""
  log_info "GATE 2/10: Verifying manifest scope allowlist (MANDATORY)..."
  if [[ -x "$SCRIPT_DIR/guard_scopes_allowlist.sh" ]]; then
    if bash "$SCRIPT_DIR/guard_scopes_allowlist.sh"; then
      log_pass "Scope allowlist verified"
    else
      log_fail "SCOPE_ALLOWLIST_FAILED"
      all_pass=1
    fi
  else
    log_fail "SCOPE_GUARD_MISSING - script not found or not executable"
    all_pass=1
  fi

  # ========================================================================
  # GATE 3: NO-EGRESS MANIFEST
  # ========================================================================
  log_info ""
  log_info "GATE 3/10: Verifying no-egress policy in manifest (MANDATORY)..."
  if bash "$SCRIPT_DIR/guard_no_egress_permissions.sh"; then
    log_pass "No-egress policy verified"
  else
    log_fail "EGRESS_POLICY_FAILED"
    all_pass=1
  fi

  # ========================================================================
  # GATE 4: BACKEND EGRESS BAN (CODE-LEVEL)
  # ========================================================================
  log_info ""
  log_info "GATE 4/10: Verifying NO backend outbound fetch (MANDATORY)..."
  if bash "$SCRIPT_DIR/guard_no_backend_outbound_fetch.sh"; then
    log_pass "Backend has zero outbound fetch calls"
  else
    log_fail "BACKEND_EGRESS_DETECTED"
    all_pass=1
  fi

  # ========================================================================
  # GATE 5: DOCS SANITIZER (STRICT, NO FALSE POSITIVES) - v3
  # ========================================================================
  log_info ""
  log_info "GATE 5/10: Docs sanitizer v3 (strict, accurate) (MANDATORY)..."
  if bash "$SCRIPT_DIR/sanitize_docs_claims_v3.sh"; then
    log_pass "Docs sanitizer PASSED"
  else
    log_fail "DOCS_SANITIZER_FAILED"
    all_pass=1
  fi

  # ========================================================================
  # GATE 6: BUILD (MANDATORY - MUST SUCCEED)
  # ========================================================================
  log_info ""
  log_info "GATE 6/10: Building application (MANDATORY - NO SKIPS)..."
  cd "$PROJECT_ROOT/atlassian/forge-app"
  
  if ! npm run build > "$MASTER_EVIDENCE_DIR/build.log" 2>&1; then
    log_fail "BUILD_FAILED_MANDATORY"
    tail -50 "$MASTER_EVIDENCE_DIR/build.log"
    all_pass=1
  else
    log_pass "Build succeeded"
  fi

  # ========================================================================
  # GATE 7: UNIT TESTS (MANDATORY - MUST SUCCEED)
  # ========================================================================
  log_info ""
  log_info "GATE 7/10: Running unit tests (MANDATORY - NO SKIPS)..."
  cd "$PROJECT_ROOT/atlassian/forge-app"
  
  if ! npm test > "$MASTER_EVIDENCE_DIR/tests.log" 2>&1; then
    log_fail "UNIT_TESTS_FAILED_MANDATORY"
    tail -50 "$MASTER_EVIDENCE_DIR/tests.log"
    all_pass=1
  else
    log_pass "Unit tests passed"
  fi

  # ========================================================================
  # GATE 8: PLAYWRIGHT UI PROOF (MANDATORY - MUST VERIFY LIVE UI)
  # ========================================================================
  log_info ""
  log_info "GATE 8/10: Playwright UI proof (MANDATORY - LIVE DASHBOARD)..."
  
  if bash "$SCRIPT_DIR/run_pw_phase32_live_ui.sh" > "$MASTER_EVIDENCE_DIR/playwright.log" 2>&1; then
    log_pass "Playwright UI proof passed"
  else
    log_fail "PLAYWRIGHT_FAILED_MANDATORY"
    tail -50 "$MASTER_EVIDENCE_DIR/playwright.log"
    all_pass=1
  fi

  # ========================================================================
  # GATE 9: PRODUCTION LOGS PROOF (MANDATORY - FORGE LOGS WITH MARKERS)
  # ========================================================================
  log_info ""
  log_info "GATE 9/10: Production logs proof (MANDATORY - FORGE LOGS)..."
  
  if bash "$SCRIPT_DIR/phase3_enterprise_live_proof.sh" > "$MASTER_EVIDENCE_DIR/prod-logs.log" 2>&1; then
    log_pass "Production logs proof passed"
  else
    log_fail "PROD_LOGS_FAILED_MANDATORY"
    tail -50 "$MASTER_EVIDENCE_DIR/prod-logs.log"
    all_pass=1
  fi

  # ========================================================================
  # GATE 10: FINAL VERIFICATION
  # ========================================================================
  log_info ""
  log_info "GATE 10/10: Final verification..."
  log_marker "[FT_PROOF_PHASE32_BORING_RELIABILITY_START_FINAL]"
  
  if [[ $all_pass -eq 0 ]]; then
    log_pass "ALL 10 GATES PASSED ✓✓✓"
    log_marker "[FT_PROOF_PHASE32_BORING_RELIABILITY_PASS]"
    log_info ""
    log_info "==================================================================="
    log_info "✓ v3.2.3 BORING RELIABILITY HARDENING - ALL GATES PASSED"
    log_info "Evidence: $MASTER_EVIDENCE_DIR"
    log_info "==================================================================="
    return 0
  else
    log_fail "MASTER GATE FAILED - ONE OR MORE GATES FAILED"
    log_info ""
    log_info "==================================================================="
    log_info "✗ v3.2.3 BORING RELIABILITY HARDENING - GATES FAILED"
    log_info "Evidence: $MASTER_EVIDENCE_DIR"
    log_info "==================================================================="
    return 1
  fi
}

##############################################################################
# Main
##############################################################################

run_gate
exit $?
