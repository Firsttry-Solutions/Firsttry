#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# HARD-FAIL VERIFIER FOR PAGINATION SAFETY
# Ensures all pagination completed safely with termination reasons
# Prevents infinite loops from being claimed as successful
# Always generates VERIFIER_REPORT.json (even on failure)
# ============================================================================

# Source common utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/_common.sh"
source "${SCRIPT_DIR}/mode_integrity_guard.sh"

# ============================================================================
# HARD-FAIL VERIFIER ORCHESTRATION
# Ensures upstream failures propagate cleanly to final verdict
# ============================================================================

perform_hard_fail_verification() {
  local evidence_root="$1"

  # Initialize verdict
  local overall_verdict="UNKNOWN"
  local failed_phase=""
  local root_cause_code=""
  local root_cause_summary=""
  local -a missing_required_files=()

  log_info ""
  log_info "Performing hard-fail verification..."

  # Determine mode
  local current_mode="DEMO"
  local metadata_file="${evidence_root}/00_meta/METADATA.json"

  if [[ -f "$metadata_file" ]]; then
    if jq -e '.mode == "LIVE"' "$metadata_file" >/dev/null 2>&1; then
      current_mode="LIVE"
    fi
  fi

  log_info "Evidence mode (from metadata): $current_mode"

  # ===== LIVE-SPECIFIC VALIDATION: CONTAMINATION SCAN =====
  local contamination_detected=0
  if [[ "$current_mode" == "LIVE" ]]; then
    if ! scan_for_demo_contamination "$evidence_root" "$current_mode"; then
      contamination_detected=1
      log_error "[HARD FAIL] DEMO/LIVE contamination detected in LIVE mode"
      failed_phase="contamination_scan"
      root_cause_code="demo_contamination_in_live_mode"
      root_cause_summary="LIVE mode evidence contains DEMO_ONLY markers or placeholder generators"
      overall_verdict="FAIL"
    fi
  fi

  # ===== PREREQUISITE CHECKS (unless already failed) =====
  if [[ "$overall_verdict" == "UNKNOWN" ]]; then
    if [[ ! -d "${evidence_root}/01_raw_api" ]]; then
      missing_required_files+=("01_raw_api/")
      failed_phase="raw_api_capture"
      root_cause_code="missing_raw_api_directory"
      overall_verdict="FAIL"
    fi

    if [[ ! -d "${evidence_root}/03_canonical_api" ]]; then
      missing_required_files+=("03_canonical_api/")
      failed_phase="canonicalization"
      root_cause_code="missing_canonical_api_directory"
      overall_verdict="FAIL"
    fi

    if [[ ! -d "${evidence_root}/08_governance_snapshot" ]]; then
      missing_required_files+=("08_governance_snapshot/")
      failed_phase="governance_snapshot"
      root_cause_code="missing_governance_snapshot_directory"
      overall_verdict="FAIL"
    fi
  fi

  # ===== PAGINATION SAFETY CHECKS (LIVE only) =====
  if [[ "$overall_verdict" == "UNKNOWN" && "$current_mode" == "LIVE" ]]; then
    # Check pagination reports exist and indicate safe termination
    local unsafe_pagination=0

    for report_file in "${evidence_root}/01_raw_api/"*_pagination_report.json; do
      if [[ -f "$report_file" ]]; then
        local termination_reason
        termination_reason=$(jq -r '.termination_reason // "unknown"' "$report_file" 2>/dev/null || echo "unknown")

        # Audit which termination reason occurred
        case "$termination_reason" in
          hard_safety_cap_exceeded)
            log_error "[HARD FAIL] Pagination hard safety cap exceeded in $(basename $report_file)"
            unsafe_pagination=1
            failed_phase="pagination"
            root_cause_code="hard_cap_exceeded"
            overall_verdict="FAIL"
            ;;
          duplicate_page_detected)
            log_error "[HARD FAIL] Duplicate page detected in $(basename $report_file)"
            unsafe_pagination=1
            failed_phase="pagination"
            root_cause_code="duplicate_page_loop"
            overall_verdict="FAIL"
            ;;
          cursor_non_advancement)
            log_error "[HARD FAIL] Cursor non-advancement in $(basename $report_file)"
            unsafe_pagination=1
            failed_phase="pagination"
            root_cause_code="cursor_non_advancement"
            overall_verdict="FAIL"
            ;;
          *)
            # Safe termination reasons: OK
            log_info "  ✓ Pagination safe: $termination_reason"
            ;;
        esac
      fi
    done
  fi

  # ===== GROUPS PICKER SPECIFIC CHECK (LIVE only) =====
  if [[ "$overall_verdict" == "UNKNOWN" && "$current_mode" == "LIVE" ]]; then
    local groups_report="${evidence_root}/01_raw_api/groups_picker_collection_report.json"
    if [[ -f "$groups_report" ]]; then
      local groups_outcome
      groups_outcome=$(jq -r '.run_outcome // "UNKNOWN"' "$groups_report" 2>/dev/null || echo "UNKNOWN")

      if [[ "$groups_outcome" != "PASS" ]]; then
        log_error "[HARD FAIL] Groups picker collection failed with outcome: $groups_outcome"
        local groups_outcome_code
        groups_outcome_code=$(jq -r '.run_outcome_code // "unknown"' "$groups_report" 2>/dev/null || echo "unknown")
        failed_phase="groups_picker"
        root_cause_code="$groups_outcome_code"
        root_cause_summary="$groups_outcome - see groups_picker_collection_report.json"
        overall_verdict="FAIL"
      else
        log_info "  ✓ Groups picker collection successful"
      fi
    fi
  fi

  # ===== DEFAULT TO PASS if no failures detected =====
  if [[ "$overall_verdict" == "UNKNOWN" ]]; then
    overall_verdict="PASS"
  fi

  # ===== WRITE FINAL VERIFIER REPORT (ALWAYS, pass or fail) =====
  local verifier_report="${evidence_root}/VERIFIER_REPORT.json"
  local missing_files_json_str=""
  if [[ ${#missing_required_files[@]} -gt 0 ]]; then
    missing_files_json_str=$(printf '"%s"\n' "${missing_required_files[@]}" | paste -sd,)
  fi

  cat > "$verifier_report" << VERIFIER_JSON
{
  "overall_verdict": "$overall_verdict",
  "mode": "$current_mode",
  "evidence_root": "$evidence_root",
  "run_id": "$(basename $evidence_root)",
  "failed_phase": "$failed_phase",
  "root_cause_code": "$root_cause_code",
  "root_cause_summary": "$root_cause_summary",
  "missing_required_files": [$missing_files_json_str],
  "contamination_detected": $contamination_detected,
  "upstream_failure_propagated": $(if [[ "$overall_verdict" == "FAIL" ]]; then echo "true"; else echo "false"; fi),
  "generated_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "verifier_version": "2.0-hardened"
}
VERIFIER_JSON

  log_info ""
  log_info "=================================================="
  log_info "VERIFIER REPORT"
  log_info "=================================================="
  log_info "Overall Verdict: $overall_verdict"
  log_info "Failed Phase: $failed_phase"
  log_info "Root Cause: $root_cause_code"
  log_info "Report: $verifier_report"

  if [[ "$overall_verdict" == "FAIL" ]]; then
    log_error "❌ VERIFICATION FAILED"
    return 1
  else
    log_info "✅ VERIFICATION PASSED"
    return 0
  fi
}

# ============================================================================
# EXPORT FUNCTIONS
# ============================================================================

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  echo "[ERROR] This library must be sourced, not executed directly" >&2
  exit 1
fi
