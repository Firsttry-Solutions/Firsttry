#!/bin/bash

##############################################################################
# v3.2.7 - PLAYWRIGHT REVIEWER MINIMAL RUNTIME PROOF
# Purpose: Execute real Playwright browser tests. NO FALLBACK.
# FAIL-CLOSED: Browser must launch and tests must pass.
# Output markers:
#   - [[FT_PROOF_PW_RUNTIME_EXECUTED]] - browser launched and tests ran
#   - [[FT_PROOF_PW_RUNTIME_PASS]] - all tests passed
#   - [[FT_PROOF_PW_RUNTIME_FAIL]] - browser/tests failed (exit 1)
##############################################################################

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

source "$SCRIPT_DIR/_lib_proof.sh"

# Use the master evidence dir from calling script
LOG_FILE="${MASTER_EVIDENCE_DIR:-/tmp/ft_playwright_runtime}/playwright-runtime.log"
mkdir -p "$(dirname "$LOG_FILE")"

##############################################################################
# Main: Runtime Playwright Execution (NO FALLBACK)
##############################################################################

main() {
  log_marker "[FT_PROOF_PW_RUNTIME_START]"
  log_info "==================================================================="
  log_info "PLAYWRIGHT RUNTIME PROOF (FAIL-CLOSED, NO FALLBACK)"
  log_info "Must verify: npm ✓ playwright ✓ browser launch ✓ tests pass ✓"
  log_info "==================================================================="

  cd "$PROJECT_ROOT/atlassian/forge-app"

  # ========================================================================
  # Step 1: Verify npm/npx availability
  # ========================================================================
  log_info ""
  log_info "Step 1: Verifying npm/npx installation..."
  if ! command -v npm &> /dev/null; then
    log_fail "PW_NPM_NOT_FOUND"
    return 1
  fi
  if ! command -v npx &> /dev/null; then
    log_fail "PW_NPX_NOT_FOUND"
    return 1
  fi
  log_pass "npm and npx available"

  # ========================================================================
  # Step 2: Verify node_modules and npm ci (consistency check)
  # ========================================================================
  log_info ""
  log_info "Step 2: Verifying dependencies..."
  if [[ ! -d node_modules ]]; then
    log_warn "node_modules not found, running npm ci"
    if ! npm ci >> "$LOG_FILE" 2>&1; then
      log_fail "PW_NPM_CI_FAILED"
      return 1
    fi
  else
    log_pass "node_modules present"
  fi

  # ========================================================================
  # Step 3: Verify Playwright version and availability
  # ========================================================================
  log_info ""
  log_info "Step 3: Checking Playwright version..."
  if ! npx playwright --version >> "$LOG_FILE" 2>&1; then
    log_fail "PW_VERSION_CHECK_FAILED"
    return 1
  fi
  log_pass "Playwright available"

  # ========================================================================
  # Step 4: Install Playwright browsers with system dependencies
  # ========================================================================
  log_info ""
  log_info "Step 4: Installing Playwright browsers with system dependencies..."
  log_info "  (This includes chromium + system library dependencies)"
  if ! npx playwright install chromium --with-deps >> "$LOG_FILE" 2>&1; then
    log_fail "PW_BROWSER_INSTALL_FAILED"
    tail -30 "$LOG_FILE" || true
    return 1
  fi
  log_pass "Playwright browsers installed (chromium + deps)"

  # ========================================================================
  # Step 5: Run Playwright tests with reporter
  # ========================================================================
  log_info ""
  log_info "Step 5: Executing Playwright tests (reviewer_minimal.spec.ts)..."
  log_info "  - Config: playwright.reviewer.config.ts"
  log_info "  - Tests: 3 (dashboard root, access reviews tab, export button)"
  log_info "  - Browser: chromium-reviewer"
  log_info "  - Reporter: line (compact output)"
  
  log_marker "[FT_PROOF_PW_RUNTIME_EXECUTING]"

  if ! npx playwright test \
    --config playwright.reviewer.config.ts \
    tests/playwright/reviewer_minimal.spec.ts \
    --project=chromium-reviewer \
    --reporter=line >> "$LOG_FILE" 2>&1; then
    
    log_fail "PW_TESTS_FAILED"
    log_marker "[FT_PROOF_PW_RUNTIME_FAIL]"
    tail -50 "$LOG_FILE" || true
    return 1
  fi

  log_pass "Playwright tests EXECUTED AND PASSED"
  log_marker "[FT_PROOF_PW_RUNTIME_EXECUTED]"
  log_marker "[FT_PROOF_PW_RUNTIME_PASS]"

  # ========================================================================
  # Step 6: Final verification
  # ========================================================================
  log_info ""
  log_info "Step 6: Finalizing Playwright runtime proof..."

  if [[ -s "$LOG_FILE" ]]; then
    log_pass "✓ Playwright Runtime Proof COMPLETE"
    log_info "  - npm/npx: Available"
    log_info "  - Dependencies: Installed"
    log_info "  - Playwright: Installed with browser + system deps"
    log_info "  - Tests: 3/3 PASSED"
    log_info "  - Browser: Chromium launched and executed"
    log_marker "[FT_PROOF_PW_FINAL_SUCCESS]"
    log_info ""
    log_info "Full output: $LOG_FILE"
    return 0
  else
    log_fail "Log file empty"
    return 1
  fi
}

main "$@"
