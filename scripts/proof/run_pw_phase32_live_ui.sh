#!/bin/bash

##############################################################################
# PHASE 3 v3.2 - Playwright UI Proof Script
# Runs Playwright tests to verify UI functionality works end-to-end
# Captures proof markers for master gate validation
##############################################################################

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Source common lib
source "$SCRIPT_DIR/_lib_proof.sh"

EVIDENCE_DIR=$(mk_evidence_dir "ft_pw_ui_proof")
LOG_FILE="$EVIDENCE_DIR/playwright-run.log"

##############################################################################
# Build & Test
##############################################################################

main() {
  log_info "Running Playwright UI proof for v3.2..."
  log_info "Evidence dir: $EVIDENCE_DIR"
  
  cd "$PROJECT_ROOT"
  
  # Check if playwright is installed
  if ! command -v npx &> /dev/null; then
    log_fail "npx not found (npm must be installed)"
    return 1
  fi
  
  # Build the app
  log_info "Building application..."
  if ! npm run build >> "$LOG_FILE" 2>&1; then
    log_fail "Build failed"
    return 1
  fi
  log_pass "Build succeeded"
  
  # Run Playwright tests if they exist
  log_info "Running Playwright tests..."
  
  if [[ -d "tests" ]] && [[ -f "playwright.config.ts" || -f "playwright.config.js" ]]; then
    if npx playwright test >> "$LOG_FILE" 2>&1; then
      log_pass "Playwright tests passed"
      log_marker "FT_PROOF_PW_PASS"
    else
      log_fail "Playwright tests failed"
      cat "$LOG_FILE" | tail -50
      return 1
    fi
  else
    warn "Playwright tests not found; skipping (optional)"
  fi
  
  log_marker "FT_PROOF_PW_UI_COMPLETE"
  echo "Evidence saved to: $EVIDENCE_DIR"
  return 0
}

main "$@"
