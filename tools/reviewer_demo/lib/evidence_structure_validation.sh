#!/usr/bin/env bash
set -euo pipefail

# Source common utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/_common.sh
source "${SCRIPT_DIR}/_common.sh"

run_evidence_structure_validation() {
  local evidence_root="$1"
  local mode="${2:-OFFLINE}"
  local audit_dir="${evidence_root}/00_meta"

  log_info "Starting evidence structure validation..."
  mkdir -p "$audit_dir"

  # Define required directory structure
  local REQUIRED_DIRECTORIES=(
    "00_meta"
    "02_parity"
    "02_docs_integrity"
    "03_scope_audit"
    "04_readonly_api_audit"
    "05_network"
    "07_blast_radius"
    "12_final_verdict"
  )

  # Add mode-specific directories
  if [[ "$mode" == "LIVE" ]]; then
    REQUIRED_DIRECTORIES+=("06_runtime")
  fi

  # Define required evidence files (core set)
  local REQUIRED_EVIDENCE_FILES=(
    "00_meta/METADATA.json"
    "02_docs_integrity/docs_integrity_report.json"
    "02_docs_integrity/docs_claim_scan.json"
    "02_parity/parity_report.json"
    "03_scope_audit/scope_audit.json"
    "04_readonly_api_audit/readonly_requestjira_index.json"
    "05_network/static_network_audit.json"
    "07_blast_radius/blast_radius_report.json"
  )

  # Add mode-specific evidence files
  if [[ "$mode" == "LIVE" ]]; then
    REQUIRED_EVIDENCE_FILES+=("06_runtime/runtime_execution_report.json")
  fi

  # Initialize tracking variables
  local missing_directories=()
  local missing_files=()
  local found_directories=0
  local found_files=0
  local validation_status="PASS"

  log_info "Validating evidence directory structure for mode: $mode"

  # Check required directories exist
  for dir in "${REQUIRED_DIRECTORIES[@]}"; do
    local full_dir="${evidence_root}/${dir}"
    if [[ -d "$full_dir" ]]; then
      ((found_directories++))
      log_info "✓ Directory found: $dir"
    else
      missing_directories+=("$dir")
      log_error "✗ Missing directory: $dir"
      validation_status="FAIL"
    fi
  done

  # Check required evidence files exist
  for file in "${REQUIRED_EVIDENCE_FILES[@]}"; do
    local full_file="${evidence_root}/${file}"
    if [[ -f "$full_file" ]]; then
      ((found_files++))
      log_info "✓ Evidence file found: $file"
    else
      missing_files+=("$file")
      log_error "✗ Missing evidence file: $file"
      validation_status="FAIL"
    fi
  done

  # Additional structural validation
  local additional_checks_passed=0
  local total_additional_checks=3

  # Check 1: Verify METADATA.json is valid JSON
  local metadata_file="${evidence_root}/00_meta/METADATA.json"
  if [[ -f "$metadata_file" ]]; then
    if jq empty < "$metadata_file" >/dev/null 2>&1; then
      log_info "✓ METADATA.json is valid JSON"
      ((additional_checks_passed++))
    else
      log_error "✗ METADATA.json is not valid JSON"
      validation_status="FAIL"
    fi
  else
    log_error "✗ Cannot validate METADATA.json - file missing"
  fi

  # Check 2: Verify verdict directory exists and has appropriate structure
  local verdict_dir="${evidence_root}/12_final_verdict"
  if [[ -d "$verdict_dir" ]]; then
    # Check if verdict dir has expected files (even if empty)
    if [[ -w "$verdict_dir" ]]; then
      log_info "✓ Final verdict directory is accessible"
      ((additional_checks_passed++))
    else
      log_error "✗ Final verdict directory is not writable"
      validation_status="FAIL"
    fi
  else
    log_error "✗ Final verdict directory structure invalid"
    validation_status="FAIL"
  fi

  # Check 3: Verify evidence root has proper permissions
  if [[ -w "$evidence_root" && -r "$evidence_root" ]]; then
    log_info "✓ Evidence root has proper permissions"
    ((additional_checks_passed++))
  else
    log_error "✗ Evidence root has improper permissions"
    validation_status="FAIL"
  fi

  # Calculate completion percentages
  local directory_completion=$((found_directories * 100 / ${#REQUIRED_DIRECTORIES[@]}))
  local file_completion=$((found_files * 100 / ${#REQUIRED_EVIDENCE_FILES[@]}))
  local structural_completion=$((additional_checks_passed * 100 / total_additional_checks))

  # Generate missing directories array for JSON
  local missing_dirs_json="["
  local first_missing_dir=true
  for missing_dir in "${missing_directories[@]}"; do
    if [[ $first_missing_dir == true ]]; then
      first_missing_dir=false
    else
      missing_dirs_json+=","
    fi
    missing_dirs_json+="\"$missing_dir\""
  done
  missing_dirs_json+="]"

  # Generate missing files array for JSON
  local missing_files_json="["
  local first_missing_file=true
  for missing_file in "${missing_files[@]}"; do
    if [[ $first_missing_file == true ]]; then
      first_missing_file=false
    else
      missing_files_json+=","
    fi
    # Escape quotes for JSON
    local escaped_file="${missing_file//\"/\\\"}"
    missing_files_json+="\"$escaped_file\""
  done
  missing_files_json+="]"

  # Generate required directories array for JSON
  local required_dirs_json="["
  local first_req_dir=true
  for req_dir in "${REQUIRED_DIRECTORIES[@]}"; do
    if [[ $first_req_dir == true ]]; then
      first_req_dir=false
    else
      required_dirs_json+=","
    fi
    required_dirs_json+="\"$req_dir\""
  done
  required_dirs_json+="]"

  # Generate required files array for JSON
  local required_files_json="["
  local first_req_file=true
  for req_file in "${REQUIRED_EVIDENCE_FILES[@]}"; do
    if [[ $first_req_file == true ]]; then
      first_req_file=false
    else
      required_files_json+=","
    fi
    required_files_json+="\"$req_file\""
  done
  required_files_json+="]"

  # Generate evidence structure validation report
  cat > "${audit_dir}/evidence_structure_validation.json" << EOF
{
  "timestamp": "$(create_timestamp)",
  "mode": "$mode",
  "validation_status": "$validation_status",
  "evidence_root": "$evidence_root",
  "directories": {
    "required_count": ${#REQUIRED_DIRECTORIES[@]},
    "found_count": $found_directories,
    "missing_count": ${#missing_directories[@]},
    "completion_percentage": $directory_completion,
    "required": $required_dirs_json,
    "missing": $missing_dirs_json
  },
  "evidence_files": {
    "required_count": ${#REQUIRED_EVIDENCE_FILES[@]},
    "found_count": $found_files,
    "missing_count": ${#missing_files[@]},
    "completion_percentage": $file_completion,
    "required": $required_files_json,
    "missing": $missing_files_json
  },
  "structural_checks": {
    "passed_count": $additional_checks_passed,
    "total_count": $total_additional_checks,
    "completion_percentage": $structural_completion,
    "checks": [
      "METADATA.json JSON validity",
      "Final verdict directory accessibility",
      "Evidence root permissions"
    ]
  }
}
EOF

  # Generate summary report for easy reading
  {
    echo "EVIDENCE STRUCTURE VALIDATION REPORT"
    echo "====================================="
    echo ""
    echo "Mode: $mode"
    echo "Status: $validation_status"
    echo "Evidence Root: $evidence_root"
    echo "Validation Time: $(create_timestamp)"
    echo ""
    echo "DIRECTORY STRUCTURE:"
    echo "- Required: ${#REQUIRED_DIRECTORIES[@]}"
    echo "- Found: $found_directories"
    echo "- Missing: ${#missing_directories[@]}"
    echo "- Completion: ${directory_completion}%"
    echo ""
    if [[ ${#missing_directories[@]} -gt 0 ]]; then
      echo "Missing Directories:"
      for missing_dir in "${missing_directories[@]}"; do
        echo "  - $missing_dir"
      done
      echo ""
    fi
    echo "EVIDENCE FILES:"
    echo "- Required: ${#REQUIRED_EVIDENCE_FILES[@]}"
    echo "- Found: $found_files"
    echo "- Missing: ${#missing_files[@]}"
    echo "- Completion: ${file_completion}%"
    echo ""
    if [[ ${#missing_files[@]} -gt 0 ]]; then
      echo "Missing Evidence Files:"
      for missing_file in "${missing_files[@]}"; do
        echo "  - $missing_file"
      done
      echo ""
    fi
    echo "STRUCTURAL CHECKS:"
    echo "- Passed: $additional_checks_passed/$total_additional_checks"
    echo "- Completion: ${structural_completion}%"
    echo ""
    if [[ "$validation_status" == "PASS" ]]; then
      echo "✅ All evidence structure validation checks passed"
    else
      echo "❌ Evidence structure validation failed"
      echo "Some required directories or files are missing"
    fi
  } > "${audit_dir}/evidence_structure_validation.txt"

  # Return appropriate exit code
  if [[ "$validation_status" == "PASS" ]]; then
    log_success "Evidence structure validation passed"
    return 0
  else
    log_error "Evidence structure validation failed"
    log_error "Missing directories: ${#missing_directories[@]}"
    log_error "Missing files: ${#missing_files[@]}"
    log_error "See: $audit_dir/evidence_structure_validation.txt"
    return 1
  fi
}

# Only execute if run directly (not sourced)
if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  run_evidence_structure_validation "${1:-}" "${2:-OFFLINE}" || exit $?
fi