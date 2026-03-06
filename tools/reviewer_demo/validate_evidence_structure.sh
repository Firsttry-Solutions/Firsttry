#!/usr/bin/env bash
set -euo pipefail

# Evidence Structure Validation Tool
# Validates FirstTry evidence directory structure and completeness

# Enforce deterministic environment
export TZ=UTC
export LC_ALL=C
export LANG=C
umask 022

# ============================================================================
# SETUP & INITIALIZATION
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIB_DIR="${SCRIPT_DIR}/lib"
REPO_ROOT=$(cd "${SCRIPT_DIR}/../.." && pwd)

# Source common utilities
test -f "${LIB_DIR}/_common.sh" || { echo "ERROR: Missing common utilities" >&2; exit 1; }
# shellcheck source=lib/_common.sh
source "${LIB_DIR}/_common.sh"

# Source evidence structure validation module
test -f "${LIB_DIR}/evidence_structure_validation.sh" || { echo "ERROR: Missing evidence structure validation module" >&2; exit 1; }
# shellcheck source=lib/evidence_structure_validation.sh
source "${LIB_DIR}/evidence_structure_validation.sh"

# ============================================================================
# USAGE INFORMATION
# ============================================================================

show_usage() {
  cat << 'EOF'
Evidence Structure Validation Tool

USAGE:
  validate_evidence_structure.sh <evidence_directory> [mode]

ARGUMENTS:
  evidence_directory  Path to the evidence directory to validate
  mode               Execution mode: OFFLINE (default) or LIVE

EXAMPLES:
  # Validate offline evidence structure
  ./validate_evidence_structure.sh /tmp/firsttry_reviewer_demo_20240101T120000Z

  # Validate live evidence structure
  ./validate_evidence_structure.sh /tmp/firsttry_reviewer_demo_20240101T120000Z LIVE

  # Validate latest evidence directory
  ./validate_evidence_structure.sh /tmp/firsttry_reviewer_demo_LATEST

DESCRIPTION:
  This tool validates the structural integrity of FirstTry evidence directories.
  It checks for:

  - Required directory structure
  - Presence of all expected evidence files
  - JSON validity of metadata files
  - Proper file permissions
  - Mode-specific requirements (LIVE vs OFFLINE)

  Returns exit code 0 if validation passes, non-zero if it fails.

EOF
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

main() {
  local evidence_dir="${1:-}"
  local mode="${2:-OFFLINE}"

  # Validate arguments
  if [[ -z "$evidence_dir" ]]; then
    echo "ERROR: Evidence directory path is required" >&2
    echo "" >&2
    show_usage >&2
    exit 1
  fi

  # Check if evidence directory exists
  if [[ ! -d "$evidence_dir" ]]; then
    log_error "Evidence directory does not exist: $evidence_dir"

    # Suggest alternatives if the user provided a pattern
    if [[ "$evidence_dir" == *"LATEST"* ]]; then
      echo "" >&2
      echo "Suggestion: Check if the symlink exists:" >&2
      echo "  ls -la /tmp/firsttry_reviewer_demo_LATEST" >&2
    elif [[ "$evidence_dir" == */tmp/firsttry_reviewer_demo_* ]]; then
      echo "" >&2
      echo "Suggestion: List available evidence directories:" >&2
      echo "  ls -la /tmp/firsttry_reviewer_demo_*" >&2
    fi

    exit 2
  fi

  # Validate mode parameter
  if [[ "$mode" != "OFFLINE" && "$mode" != "LIVE" ]]; then
    log_error "Invalid mode: $mode (must be OFFLINE or LIVE)"
    exit 1
  fi

  log_info "======================================================================"
  log_info "FirstTry Evidence Structure Validation"
  log_info "======================================================================"
  log_info "Evidence Directory: $evidence_dir"
  log_info "Mode: $mode"
  log_info "Validation Time: $(create_timestamp)"
  log_info ""

  # Run the validation
  if run_evidence_structure_validation "$evidence_dir" "$mode"; then
    log_info ""
    log_info "======================================================================"
    log_success "✅ EVIDENCE STRUCTURE VALIDATION PASSED"
    log_info "======================================================================"
    log_info "All required directories and evidence files are present."
    log_info "Validation report: $evidence_dir/00_meta/evidence_structure_validation.json"
    log_info "Summary report: $evidence_dir/00_meta/evidence_structure_validation.txt"
    exit 0
  else
    log_error ""
    log_error "======================================================================"
    log_error "❌ EVIDENCE STRUCTURE VALIDATION FAILED"
    log_error "======================================================================"
    log_error "Some required directories or evidence files are missing."
    log_error "Check validation report for details:"
    log_error "  - JSON Report: $evidence_dir/00_meta/evidence_structure_validation.json"
    log_error "  - Summary Report: $evidence_dir/00_meta/evidence_structure_validation.txt"
    log_error ""
    log_error "Common fixes:"
    log_error "  1. Re-run the reviewer harness: bash tools/reviewer_demo/run_reviewer_demo.sh"
    log_error "  2. Check for failed audit phases in the evidence directory"
    log_error "  3. Ensure write permissions on evidence directory"
    exit 1
  fi
}

# Handle help flags
if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  show_usage
  exit 0
fi

# Execute main function with all arguments
main "$@"