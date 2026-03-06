#!/usr/bin/env bash
set -euo pipefail

# Source common utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/_common.sh
source "${SCRIPT_DIR}/_common.sh"

run_runtime_execution_audit() {
  local evidence_root="$1"
  local repo_root="$2"
  local app_root="$3"
  local manifest_path="$4"
  local audit_dir="${evidence_root}/06_runtime"

  log_info "Starting runtime execution audit..."
  mkdir -p "$audit_dir"

  # Initialize runtime status
  local forge_available=false
  local forge_version="unknown"
  local lint_status="skipped"
  local runtime_warnings=0
  local runtime_errors=0
  local runtime_check="skipped"

  # Detect if Forge CLI is installed
  if command -v forge >/dev/null 2>&1; then
    forge_available=true
    forge_version=$(forge --version 2>/dev/null | head -1 || echo "version_unknown")
    log_info "Forge CLI detected: $forge_version"

    # Change to app root for forge operations
    local current_dir=$(pwd)
    cd "$app_root"

    # Run forge lint and capture output
    log_info "Running forge lint..."
    local lint_output_file="${audit_dir}/runtime_lint_output.txt"
    local lint_exit_code=0

    # Run forge lint with timeout to prevent hanging
    if timeout 60 forge lint > "$lint_output_file" 2>&1; then
      lint_exit_code=0
      log_info "forge lint completed successfully"
    else
      lint_exit_code=$?
      log_warning "forge lint failed or timed out (exit code: $lint_exit_code)"
    fi

    # Parse lint output for errors and warnings
    if [[ -f "$lint_output_file" ]]; then
      runtime_warnings=$(grep -c -i "warning" "$lint_output_file" 2>/dev/null || echo "0")
      runtime_errors=$(grep -c -i "error" "$lint_output_file" 2>/dev/null || echo "0")

      # Determine lint status based on output
      if [[ $lint_exit_code -eq 0 ]]; then
        if [[ $runtime_errors -eq 0 ]]; then
          lint_status="PASS"
          runtime_check="completed"
        else
          lint_status="FAIL"
          runtime_check="completed"
        fi
      else
        lint_status="FAIL"
        runtime_check="completed"
      fi

      log_info "Lint analysis: $runtime_errors errors, $runtime_warnings warnings"
    else
      log_error "Failed to generate lint output file"
      lint_status="FAIL"
      runtime_check="failed"
    fi

    # Return to original directory
    cd "$current_dir"

  else
    log_info "Forge CLI not available - skipping runtime execution checks"

    # Create placeholder output file
    cat > "${audit_dir}/runtime_lint_output.txt" << EOF
Forge CLI not available in environment.
Runtime execution audit skipped.
This is expected in offline/static analysis environments.
EOF

    runtime_check="skipped"
    lint_status="skipped"
  fi

  # Generate runtime execution report
  cat > "${audit_dir}/runtime_execution_report.json" << EOF
{
  "timestamp": "$(create_timestamp)",
  "forge_available": $forge_available,
  "forge_version": "$forge_version",
  "runtime_check": "$runtime_check",
  "lint_status": "$lint_status",
  "runtime_warnings": $runtime_warnings,
  "runtime_errors": $runtime_errors,
  "app_root_scanned": "$app_root",
  "lint_output_file": "06_runtime/runtime_lint_output.txt"
}
EOF

  # Determine overall status
  if [[ "$runtime_check" == "skipped" ]]; then
    log_info "Runtime execution audit skipped (Forge CLI not available)"
    return 0
  elif [[ "$lint_status" == "PASS" ]]; then
    log_success "Runtime execution audit passed (no lint errors detected)"
    return 0
  else
    log_error "Runtime execution audit failed (lint errors detected: $runtime_errors)"
    log_error "See: $audit_dir/runtime_lint_output.txt"
    return 1
  fi
}

# Only execute if run directly (not sourced)
if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  run_runtime_execution_audit "${1:-}" "${2:-}" "${3:-}" "${4:-}" || exit $?
fi