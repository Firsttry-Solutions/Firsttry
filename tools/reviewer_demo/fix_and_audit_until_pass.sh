#!/usr/bin/env bash
set -euo pipefail

# FirstTry Fix-and-Audit Loop
# Runs OFFLINE harness, parses failures, applies automated fixes, re-runs until PASS
# Max: 5 iterations

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIB_DIR="${SCRIPT_DIR}/lib"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Export for child processes
export REPO_ROOT

declare -i ITERATION=1
declare -i MAX_ITERATIONS=5
declare LATEST_EVIDENCE_DIR=""

log() {
  echo "[FIX-AUDIT] $*" >&2
}

run_harness() {
  log "===== ITERATION $ITERATION/$MAX_ITERATIONS ====="
  cd "$REPO_ROOT"

  # Run harness and capture evidence dir
  local output
  output=$(timeout 180 bash tools/reviewer_demo/run_reviewer_demo.sh 2>&1 || true)

  # Extract evidence dir
  LATEST_EVIDENCE_DIR=$(echo "$output" | grep "^EVIDENCE_ROOT:" | head -1 | cut -d: -f2 | xargs)

  if [[ -z "$LATEST_EVIDENCE_DIR" || ! -d "$LATEST_EVIDENCE_DIR" ]]; then
    log "ERROR: Could not find evidence directory"
    return 1
  fi

  log "Evidence directory: $LATEST_EVIDENCE_DIR"

  # PHASE 0: Check parity gate (fail immediately if broken - no auto-merge)
  if [[ -f "$LATEST_EVIDENCE_DIR/02_parity/parity_report.json" ]]; then
    if grep -q '"parity_status":\s*"FAIL"' "$LATEST_EVIDENCE_DIR/02_parity/parity_report.json" 2>/dev/null; then
      log "❌ PARITY GATE FAILURE - Apps are out of sync"
      log "Run: bash tools/reviewer_demo/lib/sync_dev_from_vendor.sh"
      log "Then retry this script"
      return 2  # Special parity failure code
    fi
  fi

  # Check verdict
  if [[ -f "$LATEST_EVIDENCE_DIR/FINAL_REVIEWER_VERDICT.txt" ]]; then
    local verdict
    verdict=$(head -1 "$LATEST_EVIDENCE_DIR/FINAL_REVIEWER_VERDICT.txt" 2>/dev/null | xargs || echo "UNKNOWN")

    # Normalize verdict (might be "FINAL VERDICT: PASS" format)
    if echo "$verdict" | grep -q "PASS"; then
      log "✅ FINAL VERDICT: PASS"
      return 0
    else
      log "✗ FINAL VERDICT: $verdict"
      return 1
    fi
  fi

  return 1
}

apply_automated_fixes() {
  log "Checking for automated fixes..."

  local docs_audit_json="${LATEST_EVIDENCE_DIR}/02_docs_integrity/docs_integrity_audit.json"

  # Fix 1: Docs overclaims
  if [[ -f "$docs_audit_json" ]]; then
    local violations
    violations=$(grep -o '"violations":\s*[0-9]*' "$docs_audit_json" 2>/dev/null | grep -o '[0-9]*' || echo "0")

    if [[ "$violations" -gt 0 ]]; then
      log "Applying doc overclaim fixes ($violations violations)..."
      bash "$LIB_DIR/docs_autofix.sh" "$REPO_ROOT" || log "WARNING: docs_autofix.sh had issues"
    fi
  fi
}

log "FirstTry Fix-and-Audit Loop"
log "Repository: $REPO_ROOT"
log "Max iterations: $MAX_ITERATIONS"

while [[ $ITERATION -le $MAX_ITERATIONS ]]; do
  if run_harness; then
    log ""
    log "============================================"
    log "SUCCESS: OFFLINE PASS ACHIEVED"
    log "============================================"
    log "Evidence: $LATEST_EVIDENCE_DIR"
    log ""
    echo "$LATEST_EVIDENCE_DIR" > /tmp/firsttry_passed_evidence_dir.txt
    exit 0
  fi

  harness_exit=$?

  # Parity gate failure - no auto-fix, ask user to sync
  if [[ $harness_exit -eq 2 ]]; then
    log ""
    log "============================================"
    log "PARITY GATE FAILURE"
    log "============================================"
    log "Evidence: $LATEST_EVIDENCE_DIR"
    log ""
    log "To fix: bash tools/reviewer_demo/lib/sync_dev_from_vendor.sh"
    log "Then:   bash tools/reviewer_demo/fix_and_audit_until_pass.sh"
    log ""
    exit 2
  fi

  # Apply fixes for next iteration
  if [[ $ITERATION -lt $MAX_ITERATIONS ]]; then
    apply_automated_fixes
    ((ITERATION++)) || true
  else
    log ""
    log "============================================"
    log "FAILED: Max iterations ($MAX_ITERATIONS) reached without PASS"
    log "============================================"
    log "Evidence: $LATEST_EVIDENCE_DIR"
    log ""
    log "Remaining blockers:"
    if [[ -f "$LATEST_EVIDENCE_DIR/FINAL_REVIEWER_VERDICT.txt" ]]; then
      cat "$LATEST_EVIDENCE_DIR/FINAL_REVIEWER_VERDICT.txt"
    fi
    log ""
    exit 1
  fi
done
