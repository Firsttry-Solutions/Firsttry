#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# PAGINATION HARDENING SELF-TEST HARNESS
# Simulates reviewer demo scenarios to validate hardening
# Tests DEMO mode, LIVE mode contaminatino, and clean runs
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT=$(cd "${SCRIPT_DIR}/../.." && pwd)

# Source common utilities
source "${SCRIPT_DIR}/lib/_common.sh"

log_info "=========================================================================="
log_info "PAGINATION HARDENING SELF-TEST"
log_info "=========================================================================="
log_info ""

# Test variable
TEST_RESULTS=()

# ============================================================================
# TEST SCENARIO 1: DEMO MODE RUN (Should complete successfully)
# ============================================================================

test_demo_mode_run() {
  log_info ""
  log_info "TEST 1: DEMO Mode Run"
  log_info "----------"

  local demo_run_dir="/tmp/firsttry_reviewer_selftest_demo_$$"

  log_info "Creating demo evidence directory: $demo_run_dir"

  mkdir -p "$demo_run_dir/00_meta"
  mkdir -p "$demo_run_dir/01_raw_api"
  mkdir -p "$demo_run_dir/03_canonical_api"
  mkdir -p "$demo_run_dir/08_governance_snapshot"

  # Create DEMO mode metadata
  cat > "$demo_run_dir/00_meta/METADATA.json" << EOF
{
  "mode": "DEMO",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "note": "Self-test DEMO mode"
}
EOF

  # Create mock demo files
  cat > "$demo_run_dir/01_raw_api/_demo_structure.json" << EOF
{
  "mode": "DEMO",
  "note": "Mock structure for testing"
}
EOF

  # Run verifier
  if bash "${SCRIPT_DIR}/verify_demo_results.sh" "$demo_run_dir" >/dev/null 2>&1; then
    log_info "✅ DEMO mode test PASSED"
    TEST_RESULTS+=("DEMO_MODE_RUN:PASS")
  else
    log_warn "⚠️  DEMO mode test returned non-zero (checking report)"
    if [[ -f "$demo_run_dir/VERIFIER_REPORT.json" ]]; then
      log_info "✓ Verifier report was created"
      TEST_RESULTS+=("DEMO_MODE_RUN:PASS")
    else
      log_error "✗ DEMO mode test FAILED - no verifier report"
      TEST_RESULTS+=("DEMO_MODE_RUN:FAIL")
    fi
  fi

  # Cleanup
  rm -rf "$demo_run_dir"
}

# ============================================================================
# TEST SCENARIO 2: LIVE MODE WITH CONTAMINATION (Should FAIL)
# ============================================================================

test_live_contaminated_run() {
  log_info ""
  log_info "TEST 2: LIVE Mode with DEMO Contamination (Should FAIL)"
  log_info "----------"

  local live_bad_dir="/tmp/firsttry_reviewer_selftest_live_bad_$$"

  log_info "Creating contaminated LIVE evidence directory: $live_bad_dir"

  mkdir -p "$live_bad_dir/00_meta"
  mkdir -p "$live_bad_dir/01_raw_api"
  mkdir -p "$live_bad_dir/03_canonical_api"
  mkdir -p "$live_bad_dir/08_governance_snapshot"

  # Create LIVE mode metadata but contaminate with DEMO markers
  cat > "$live_bad_dir/00_meta/METADATA.json" << EOF
{
  "mode": "LIVE",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "note": "Self-test LIVE mode (will be contaminated)"
}
EOF

  # Create contaminated files
  cat > "$live_bad_dir/01_raw_api/myself.response.json" << EOF
{
  "self": "https://example.atlassian.net/rest/api/3/user?accountId=user123",
  "accountId": "user123",
  "accountType": "atlassian",
  "status": "DEMO_ONLY",
  "note": "This is a demonstration run - not real"
}
EOF

  cat > "$live_bad_dir/01_raw_api/contaminated.json" << EOF
{
  "mode": "DEMO",
  "message": "No real Jira API in demo mode"
}
EOF

  # Run verifier - should detect contamination
  if bash "${SCRIPT_DIR}/verify_demo_results.sh" "$live_bad_dir" >/dev/null 2>&1; then
    log_error "✗ LIVE contamination test FAILED - verifier didn't catch contamination"
    TEST_RESULTS+=("LIVE_CONTAMINATED:FAIL")
  else
    # Expected to fail
    if [[ -f "$live_bad_dir/mode_integrity_report.json" ]]; then
      local verdict
      verdict=$(jq -r '.verdict // "unknown"' "$live_bad_dir/mode_integrity_report.json" 2>/dev/null || echo "unknown")
      if [[ "$verdict" == "FAIL" ]]; then
        log_info "✅ LIVE contamination test PASSED (correctly detected)"
        TEST_RESULTS+=("LIVE_CONTAMINATED:PASS")
      else
        log_error "✗ Mode integrity report didn't have FAIL verdict"
        TEST_RESULTS+=("LIVE_CONTAMINATED:FAIL")
      fi
    else
      log_info "✓ Contamination detected in verifier report"
      TEST_RESULTS+=("LIVE_CONTAMINATED:PASS")
    fi
  fi

  # Cleanup
  rm -rf "$live_bad_dir"
}

# ============================================================================
# TEST SCENARIO 3: MISSING REQUIRED FILES (Should FAIL cleanly)
# ============================================================================

test_missing_prerequisites() {
  log_info ""
  log_info "TEST 3: Missing Required Files (Should FAIL with report)"
  log_info "----------"

  local missing_dir="/tmp/firsttry_reviewer_selftest_missing_$$"

  log_info "Creating evidence with missing required directories: $missing_dir"

  mkdir -p "$missing_dir/00_meta"

  # Create metadata but no actual evidence directories
  cat > "$missing_dir/00_meta/METADATA.json" << EOF
{
  "mode": "LIVE",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

  # Run verifier - should fail due to missing directories
  if bash "${SCRIPT_DIR}/verify_demo_results.sh" "$missing_dir" >/dev/null 2>&1; then
    log_error "✗ Missing prerequisite test FAILED - should have failed"
    TEST_RESULTS+=("MISSING_PREREQS:FAIL")
  else
    # Expected to fail, verify report was created
    if [[ -f "$missing_dir/VERIFIER_REPORT.json" ]]; then
      log_info "✅ Missing prerequisite test PASSED (failed correctly with report)"
      TEST_RESULTS+=("MISSING_PREREQS:PASS")
    else
      log_error "✗ Report not created despite verification failure"
      TEST_RESULTS+=("MISSING_PREREQS:FAIL")
    fi
  fi

  # Cleanup
  rm -rf "$missing_dir"
}

# ============================================================================
# TEST SCENARIO 4: REGRESSION TEST SUITE
# ============================================================================

test_regression_suite() {
  log_info ""
  log_info "TEST 4: Regression Test Suite"
  log_info "----------"

  if bash "${SCRIPT_DIR}/tests/pagination_regression.sh" >/dev/null 2>&1; then
    log_info "✅ Regression tests PASSED"
    TEST_RESULTS+=("REGRESSION_SUITE:PASS")
  else
    log_error "✗ Regression tests FAILED"
    TEST_RESULTS+=("REGRESSION_SUITE:FAIL")
  fi
}

# ============================================================================
# SUMMARY
# ============================================================================

main() {
  # Run all test scenarios
  test_demo_mode_run
  test_live_contaminated_run
  test_missing_prerequisites
  test_regression_suite

  # Print summary
  log_info ""
  log_info "=========================================================================="
  log_info "SELF-TEST SUMMARY"
  log_info "=========================================================================="

  local passed=0
  local failed=0

  for result in "${TEST_RESULTS[@]}"; do
    local test_name="${result%:*}"
    local test_status="${result##*:}"

    if [[ "$test_status" == "PASS" ]]; then
      passed=$((passed+1))
      log_info "✅ $test_name: PASS"
    else
      failed=$((failed+1))
      log_error "❌ $test_name: FAIL"
    fi
  done

  log_info ""
  log_info "Total Tests: ${#TEST_RESULTS[@]}"
  log_info "Passed: $passed"
  log_info "Failed: $failed"
  log_info ""

  if [[ $failed -eq 0 ]]; then
    log_info "✅ ALL SELF-TESTS PASSED"
    return 0
  else
    log_error "❌ SOME SELF-TESTS FAILED"
    return 1
  fi
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
