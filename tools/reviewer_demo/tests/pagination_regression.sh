#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# PAGINATION HARDENING REGRESSION TEST SUITE
# Tests all failure modes and ensures fail-closed behavior
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIB_DIR="${SCRIPT_DIR}/../lib"
REPO_ROOT=$(cd "${SCRIPT_DIR}/../.." && pwd)

# Source required libraries
source "${LIB_DIR}/_common.sh"
source "${LIB_DIR}/pagination_harness.sh"
source "${LIB_DIR}/hard_fail_verifier.sh"
source "${LIB_DIR}/mode_integrity_guard.sh"

# Test tracking
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Test utility functions
test_setup() {
  local test_name="$1"
  TESTS_RUN=$((TESTS_RUN+1))
  log_info ""
  log_info "TEST $TESTS_RUN: $test_name"
  log_info "============================================================"
}

test_pass() {
  local test_name="$1"
  TESTS_PASSED=$((TESTS_PASSED+1))
  log_info "✅ PASS: $test_name"
}

test_fail() {
  local test_name="$1"
  local reason="$2"
  TESTS_FAILED=$((TESTS_FAILED+1))
  log_error "❌ FAIL: $test_name"
  log_error "   Reason: $reason"
}

# ============================================================================
# TEST 1: PAGINATION HARNESS GUARDS PRESENT
# ============================================================================

test_pagination_guards_implemented() {
  local test_name="All 6 pagination safety guards are implemented"
  test_setup "$test_name"

  local guards_found=0
  local required_guards=(
    "explicit_terminal_state_isLast_true"
    "semantic_exhaustion_zero_items"
    "cursor_non_advancement"
    "duplicate_page_detected"
    "total_reached"
    "hard_safety_cap"
  )

  for guard in "${required_guards[@]}"; do
    if grep -q "$guard" "${LIB_DIR}/pagination_harness.sh"; then
      guards_found=$((guards_found+1))
      log_info "  ✓ Found guard: $guard"
    else
      log_error "  ✗ Missing guard: $guard"
    fi
  done

  if [[ $guards_found -eq 6 ]]; then
    test_pass "$test_name"
  else
    test_fail "$test_name" "Only found $guards_found/6 guards"
  fi
}

# ============================================================================
# TEST 2: GROUPS PICKER SAFE COLLECTOR EXISTS
# ============================================================================

test_groups_picker_collector() {
  local test_name="Groups picker endpoint-specific safe collector function"
  test_setup "$test_name"

  if grep -q "jira_api_collect_groups_picker_safe" "${LIB_DIR}/pagination_harness.sh"; then
    test_pass "$test_name"
  else
    test_fail "$test_name" "Function jira_api_collect_groups_picker_safe not found"
  fi
}

# ============================================================================
# TEST 3: HARD FAIL VERIFIER PRODUCES REPORT
# ============================================================================

test_hard_fail_verifier_report_generation() {
  local test_name="Hard-fail verifier always produces VERIFIER_REPORT.json"
  test_setup "$test_name"

  # Create minimal test evidence directory
  local test_dir="/tmp/test_verifier_$$"
  mkdir -p "$test_dir/00_meta"

  # Create minimal metadata
  cat > "$test_dir/00_meta/METADATA.json" << EOF
{
  "mode": "DEMO",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

  # Create necessary directories
  mkdir -p "$test_dir/01_raw_api"
  mkdir -p "$test_dir/03_canonical_api"
  mkdir -p "$test_dir/08_governance_snapshot"

  # Run verifier (will fail due to missing files, but should create report)
  perform_hard_fail_verification "$test_dir" >/dev/null 2>&1 || true

  # Check that report was created
  if [[ -f "$test_dir/VERIFIER_REPORT.json" ]]; then
    # Verify it's valid JSON
    if jq empty "$test_dir/VERIFIER_REPORT.json" 2>/dev/null; then
      test_pass "$test_name"
    else
      test_fail "$test_name" "VERIFIER_REPORT.json is not valid JSON"
    fi
  else
    test_fail "$test_name" "VERIFIER_REPORT.json was not created"
  fi

  # Cleanup
  rm -rf "$test_dir"
}

# ============================================================================
# TEST 4: MODE INTEGRITY GUARD DETECTS CONTAMINATION
# ============================================================================

test_mode_integrity_contamination_detection() {
  local test_name="Mode integrity guard detects DEMO markers in LIVE mode"
  test_setup "$test_name"

  # Create test directory with contamination
  local test_dir="/tmp/test_contamination_$$"
  mkdir -p "$test_dir/00_meta"

  # Create LIVE mode metadata
  cat > "$test_dir/00_meta/METADATA.json" << EOF
{
  "mode": "LIVE",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

  # Create contaminated file
  mkdir -p "$test_dir/01_raw_api"
  cat > "$test_dir/01_raw_api/contaminated.json" << EOF
{
  "status": "DEMO_ONLY",
  "message": "This is a demonstration run"
}
EOF

  # Run contamination check
  if perform_mode_integrity_check "$test_dir" "LIVE" >/dev/null 2>&1; then
    test_fail "$test_name" "Failed to detect contamination in LIVE mode"
  else
    # Check was expected to fail
    if [[ -f "$test_dir/mode_integrity_report.json" ]]; then
      local verdict
      verdict=$(jq -r '.verdict // "unknown"' "$test_dir/mode_integrity_report.json")
      if [[ "$verdict" == "FAIL" ]]; then
        test_pass "$test_name"
      else
        test_fail "$test_name" "Report verdict not FAIL"
      fi
    else
      test_fail "$test_name" "No report generated"
    fi
  fi

  # Cleanup
  rm -rf "$test_dir"
}

# ============================================================================
# TEST 5: UNSAFE PAGINATION REJECTED IN jira_live_capture
# ============================================================================

test_unsafe_pagination_deprecated() {
  local test_name="Generic jira_api_paginate is deprecated (errors in LIVE)"
  test_setup "$test_name"

  # Check that jira_api_paginate in jira_live_capture.sh now returns error
  if grep -A 5 "jira_api_paginate() {" "${LIB_DIR}/jira_live_capture.sh" | grep -q "return 1\|FATAL"; then
    test_pass "$test_name"
  else
    test_fail "$test_name" "jira_api_paginate should error out"
  fi
}

# ============================================================================
# TEST 6: JIRA_CAPTURE USES SAFE PAGINATION
# ============================================================================

test_jira_capture_uses_safe_pagination() {
  local test_name="jira_capture.sh uses jira_api_paginate_safe for /groups/picker"
  test_setup "$test_name"

  if grep -q "jira_api_collect_groups_picker_safe" "${LIB_DIR}/jira_capture.sh"; then
    test_pass "$test_name"
  else
    test_fail "$test_name" "jira_capture.sh doesn't use safe groups collector"
  fi
}

# ============================================================================
# TEST 7: PAGINATION HARNESS SOURCES IN JIRA_CAPTURE
# ============================================================================

test_pagination_harness_sourced() {
  local test_name="Pagination harness is sourced in jira_capture.sh"
  test_setup "$test_name"

  if grep -q 'source.*pagination_harness' "${LIB_DIR}/jira_capture.sh"; then
    test_pass "$test_name"
  else
    test_fail "$test_name" "Pagination harness not sourced"
  fi
}

# ============================================================================
# TEST 8: HARD_FAIL_VERIFIER CALLED IN run_reviewer_demo
# ============================================================================

test_hard_fail_verifier_integrated() {
  local test_name="Hard-fail verifier is called in main harness"
  test_setup "$test_name"

  if grep -q "perform_hard_fail_verification" "${LIB_DIR}/../run_reviewer_demo.sh"; then
    test_pass "$test_name"
  else
    test_fail "$test_name" "perform_hard_fail_verification not called in harness"
  fi
}

# ============================================================================
# TEST 9: PAGINATION REPORT SCHEMA
# ============================================================================

test_pagination_report_schema() {
  local test_name="Pagination reports include required fields"
  test_setup "$test_name"

  local required_fields=(
    "endpoint"
    "pages_collected"
    "items_collected"
    "termination_reason"
    "pagination_valid"
  )

  local all_present=1
  for field in "${required_fields[@]}"; do
    if grep -q "\"$field\"" "${LIB_DIR}/pagination_harness.sh"; then
      log_info "  ✓ Field present: $field"
    else
      log_error "  ✗ Field missing: $field"
      all_present=0
    fi
  done

  if [[ $all_present -eq 1 ]]; then
    test_pass "$test_name"
  else
    test_fail "$test_name" "Some required fields missing from report schema"
  fi
}

# ============================================================================
# TEST 10: NO SILENT SUCCESS ON MISSING FILES
# ============================================================================

test_fail_closed_on_missing_files() {
  local test_name="Verifier fails (closed) when files missing"
  test_setup "$test_name"

  # Create empty test directory
  local test_dir="/tmp/test_failclosed_$$"
  mkdir -p "$test_dir/00_meta"

  cat > "$test_dir/00_meta/METADATA.json" << EOF
{
  "mode": "LIVE",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

  # Run verifier - should fail due to missing directories
  if perform_hard_fail_verification "$test_dir" >/dev/null 2>&1; then
    test_fail "$test_name" "Verifier returned success despite missing required directories"
  else
    # Expected to fail
    test_pass "$test_name"
  fi

  # Verify report was still created
  if [[ ! -f "$test_dir/VERIFIER_REPORT.json" ]]; then
    log_error "   WARNING: Report not created despite directory structure check"
  fi

  # Cleanup
  rm -rf "$test_dir"
}

# ============================================================================
# TEST 11: VERIFIER REPORT HAS CORRECT STRUCTURE
# ============================================================================

test_verifier_report_structure() {
  local test_name="Verifier report has all required fields"
  test_setup "$test_name"

  local test_dir="/tmp/test_report_struct_$$"
  mkdir -p "$test_dir/00_meta"

  cat > "$test_dir/00_meta/METADATA.json" << EOF
{
  "mode": "DEMO",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

  # Create minimal expected directories
  mkdir -p "$test_dir/01_raw_api"
  mkdir -p "$test_dir/03_canonical_api"
  mkdir -p "$test_dir/08_governance_snapshot"

  # Run verifier
  perform_hard_fail_verification "$test_dir" >/dev/null 2>&1 || true

  # Check report structure
  if [[ -f "$test_dir/VERIFIER_REPORT.json" ]]; then
    local required_fields=(
      "overall_verdict"
      "mode"
      "evidence_root"
      "failed_phase"
      "root_cause_code"
    )

    local all_found=1
    for field in "${required_fields[@]}"; do
      if ! jq -e ".$field" "$test_dir/VERIFIER_REPORT.json" >/dev/null 2>&1; then
        log_error "  ✗ Missing field in report: $field"
        all_found=0
      fi
    done

    if [[ $all_found -eq 1 ]]; then
      test_pass "$test_name"
    else
      test_fail "$test_name" "Report missing required fields"
    fi
  else
    test_fail "$test_name" "Report not created"
  fi

  # Cleanup
  rm -rf "$test_dir"
}

# ============================================================================
# MAIN TEST EXECUTION
# ============================================================================

main() {
  log_info ""
  log_info "=========================================================================="
  log_info "PAGINATION HARDENING REGRESSION TEST SUITE"
  log_info "=========================================================================="
  log_info ""

  # Run all tests
  test_pagination_guards_implemented
  test_groups_picker_collector
  test_hard_fail_verifier_report_generation
  test_mode_integrity_contamination_detection
  test_unsafe_pagination_deprecated
  test_jira_capture_uses_safe_pagination
  test_pagination_harness_sourced
  test_hard_fail_verifier_integrated
  test_pagination_report_schema
  test_fail_closed_on_missing_files
  test_verifier_report_structure

  # Summary
  log_info ""
  log_info "=========================================================================="
  log_info "TEST SUMMARY"
  log_info "=========================================================================="
  log_info "Total:  $TESTS_RUN"
  log_info "Passed: $TESTS_PASSED"
  log_info "Failed: $TESTS_FAILED"
  log_info ""

  if [[ $TESTS_FAILED -eq 0 ]]; then
    log_info "✅ ALL TESTS PASSED"
    return 0
  else
    log_error "❌ $TESTS_FAILED TEST(S) FAILED"
    return 1
  fi
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
