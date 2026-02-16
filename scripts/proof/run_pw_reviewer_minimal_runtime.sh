#!/bin/bash

##############################################################################
# v3.2.8 - PLAYWRIGHT REVIEWER MINIMAL RUNTIME PROOF (HTTP SERVER)
# Purpose: Execute real Playwright browser tests with HTTP server rendering.
# FAIL-CLOSED: Browser must launch, HTTP server must serve, tests must pass.
# 
# Key difference from v3.2.7:
# - Serves dist via HTTP (not file:// URL)
# - Tests assert DOM markers after JS hydration
# - No fallback to static verification
#
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
  log_info "PLAYWRIGHT RUNTIME PROOF v3.2.8 (HTTP SERVER + DOM ASSERTIONS)"
  log_info "Prerequisites: npm ✓ build dist ✓ http-server ✓"
  log_info "Execution: browser ✓ hydration ✓ DOM markers ✓ tests pass ✓"
  log_info "==================================================================="

  cd "$PROJECT_ROOT/atlassian/forge-app"

  # ========================================================================
  # Step 1: Verify npm/npx availability
  # ========================================================================
  log_info ""
  log_info "Step 1: Verifying npm/npx installation..."
  if ! command -v npm &> /dev/null; then
    log_fail "PW_NPM_NOT_FOUND"
    log_marker "[FT_PROOF_PW_RUNTIME_FAIL]"
    return 1
  fi
  if ! command -v npx &> /dev/null; then
    log_fail "PW_NPX_NOT_FOUND"
    log_marker "[FT_PROOF_PW_RUNTIME_FAIL]"
    return 1
  fi
  log_pass "npm and npx available"

  # ========================================================================
  # Step 2: Install/verify dependencies (npm ci)
  # ========================================================================
  log_info ""
  log_info "Step 2: Installing dependencies via npm ci..."
  if ! npm ci >> "$LOG_FILE" 2>&1; then
    log_fail "PW_NPM_CI_FAILED"
    log_marker "[FT_PROOF_PW_RUNTIME_FAIL]"
    tail -20 "$LOG_FILE" || true
    return 1
  fi
  log_pass "npm ci completed"

  # ========================================================================
  # Step 3: Build the UI distribution
  # ========================================================================
  log_info ""
  log_info "Step 3: Building gadget UI distribution..."
  if ! npm run build >> "$LOG_FILE" 2>&1; then
    log_fail "PW_BUILD_FAILED"
    log_marker "[FT_PROOF_PW_RUNTIME_FAIL]"
    tail -30 "$LOG_FILE" || true
    return 1
  fi
  log_pass "npm run build completed"

  # ========================================================================
  # Step 4: Verify dist exists
  # ========================================================================
  log_info ""
  log_info "Step 4: Verifying dist directory..."
  if ! [[ -f "src/gadget-ui/dist/index.html" ]]; then
    log_fail "PW_DIST_NOT_FOUND"
    log_marker "[FT_PROOF_PW_RUNTIME_FAIL]"
    log_info "Expected: src/gadget-ui/dist/index.html"
    return 1
  fi
  log_pass "dist/index.html exists (ready for HTTP serving)"

  # ========================================================================
  # Step 5: Verify http-server is available
  # ========================================================================
  log_info ""
  log_info "Step 5: Verifying http-server availability..."
  if ! npx http-server --version >> "$LOG_FILE" 2>&1; then
    log_fail "PW_HTTP_SERVER_NOT_FOUND"
    log_marker "[FT_PROOF_PW_RUNTIME_FAIL]"
    return 1
  fi
  HTTP_SERVER_VERSION=$(npx http-server --version 2>&1 | head -1)
  log_pass "http-server available: $HTTP_SERVER_VERSION"

  # ========================================================================
  # Step 6: Verify Playwright browsers
  # ========================================================================
  log_info ""
  log_info "Step 6: Installing Playwright chromium with system dependencies..."
  if ! npx playwright install chromium --with-deps >> "$LOG_FILE" 2>&1; then
    log_fail "PW_BROWSER_INSTALL_FAILED"
    log_marker "[FT_PROOF_PW_RUNTIME_FAIL]"
    tail -30 "$LOG_FILE" || true
    return 1
  fi
  log_pass "Playwright chromium browser installed"

  # ========================================================================
  # Step 7: Run Playwright tests with HTTP server and DOM assertions
  # ========================================================================
  log_info ""
  log_info "Step 7: Executing Playwright tests with HTTP server..."
  log_info "  Config: playwright.reviewer.config.ts (webServer: http://127.0.0.1:4173)"
  log_info "  Project: chromium-reviewer"
  log_info "  Tests: 3 (dashboard root, access reviews tab, export button)"
  log_info "  Spec: tests/playwright/reviewer_minimal.spec.ts"
  log_info "  This is REAL BROWSER rendering, NOT HTML grep or file:// URL"
  
  log_marker "[FT_PROOF_PW_RUNTIME_EXECUTING]"

  if ! npx playwright test \
    --config playwright.reviewer.config.ts \
    tests/playwright/reviewer_minimal.spec.ts \
    --project=chromium-reviewer \
    --reporter=line >> "$LOG_FILE" 2>&1; then
    
    log_fail "PW_TESTS_FAILED"
    log_marker "[FT_PROOF_PW_RUNTIME_FAIL]"
    log_info "Last 50 lines of test output:"
    tail -50 "$LOG_FILE" || true
    return 1
  fi

  log_pass "Playwright tests EXECUTED AND PASSED (real browser rendering with DOM assertions)"
  log_marker "[FT_PROOF_PW_RUNTIME_EXECUTED]"
  log_marker "[FT_PROOF_PW_RUNTIME_PASS]"

  # ========================================================================
  # Step 8: Final verification
  # ========================================================================
  log_info ""
  log_info "Step 8: Runtime proof complete"
  log_info "Evidence: HTTP server served dist, Chromium rendered UI, JS hydrated, DOM markers asserted"
  log_pass "✓ PLAYWRIGHT RUNTIME PROOF PASSED (v3.2.8)"

  return 0
}

# Run main, capture exit code
if main; then
  log_info ""
  log_info "==================================================================="
  log_info "✓ PLAYWRIGHT RUNTIME PROOF SUCCESS"
  log_info "==================================================================="
  exit 0
else
  EXIT_CODE=$?
  log_info ""
  log_info "==================================================================="
  log_info "✗ PLAYWRIGHT RUNTIME PROOF FAILED (exit $EXIT_CODE)"
  log_info "==================================================================="
  exit $EXIT_CODE
fi
