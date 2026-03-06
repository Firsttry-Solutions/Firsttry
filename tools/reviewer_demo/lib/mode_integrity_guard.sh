#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# MODE INTEGRITY GUARD
# Prevents LIVE/DEMO contamination and false claims
# Ensures evidence is cryptographically separated by mode
# ============================================================================

# Source common utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/_common.sh"

# ============================================================================
# SCAN FOR DEMO CONTAMINATION IN LIVE MODE
# ============================================================================

scan_for_demo_contamination() {
  local evidence_root="$1"
  local current_mode="$2"  # LIVE or DEMO

  log_info "Scanning for DEMO/LIVE contamination in $current_mode mode..."

  local contamination_detected=0
  local -a forbidden_markers_found=()
  local files_scanned=0

  # These markers must NEVER appear in LIVE mode
  local forbidden_in_live=(
    '"mode": "DEMO"'
    '"status": "DEMO_ONLY"'
    '"reason": "No real Jira API in demo mode"'
    'placeholder_generator'
    'demo_placeholder'
    'generated_from.*demo-only'
    'DEMO_PLACEHOLDER'
    'This is a demonstration run'
    'mock evidence'
    'not captured'
    'demo structure'
  )

  if [[ "$current_mode" == "LIVE" ]]; then
    log_info "  Checking for forbidden DEMO markers (strict mode)..."

    # Scan all JSON files in evidence root
    while IFS= read -r file; do
      files_scanned=$((files_scanned+1))

      for pattern in "${forbidden_in_live[@]}"; do
        if grep -qi "$pattern" "$file" 2>/dev/null; then
          contamination_detected=1
          forbidden_markers_found+=("$pattern")
          log_error "    ✗ Found forbidden: '$pattern' in $(basename $file)"
        fi
      done
    done < <(find "$evidence_root" -type f \( -name "*.json" -o -name "*.txt" \) 2>/dev/null)
  fi

  log_info "  Files scanned: $files_scanned"

  if [[ $contamination_detected -eq 1 ]]; then
    log_info "  Contamination detected: YES"
    return 1
  else
    log_info "  Contamination detected: NO"
    return 0
  fi
}

# ============================================================================
# VERIFY METADATA CONSISTENCY
# LIVE mode claim in metadata must match actual evidence
# ============================================================================

verify_metadata_mode_claim() {
  local evidence_root="$1"
  local claimed_mode="$2"  # What the metadata says

  log_info "Verifying metadata mode claim consistency..."

  local metadata_file="${evidence_root}/00_meta/METADATA.json"

  if [[ ! -f "$metadata_file" ]]; then
    log_error "Missing metadata file: $metadata_file"
    return 1
  fi

  # Extract mode from metadata
  local metadata_mode
  metadata_mode=$(jq -r '.mode // "UNKNOWN"' "$metadata_file" 2>/dev/null || echo "UNKNOWN")

  if [[ "$metadata_mode" == "UNKNOWN" ]]; then
    log_error "Cannot determine mode from metadata"
    return 1
  fi

  log_info "  Claimed mode (metadata): $metadata_mode"
  log_info "  Expected mode (parameter): $claimed_mode"

  # Verify consistency
  if [[ "$metadata_mode" != "$claimed_mode" ]]; then
    log_error "Mode mismatch: metadata claims $metadata_mode but expected $claimed_mode"
    return 1
  fi

  log_info "  ✓ Mode consistency verified"
  return 0
}

# ============================================================================
# CHECK FOR REAL JIRA EVIDENCE IN LIVE MODE
# ============================================================================

verify_live_has_real_evidence() {
  local evidence_root="$1"

  log_info "Verifying LIVE mode has real Jira evidence..."

  # In LIVE mode, we MUST have:
  # 1. Non-empty myself.response.json (user context from real Jira)
  # 2. Non-empty serverInfo.response.json (server info from real Jira)
  # 3. Pagination reports indicating successful collection

  local required_files=(
    "01_raw_api/myself.response.json"
    "01_raw_api/serverInfo.response.json"
  )

  for req_file in "${required_files[@]}"; do
    local full_path="${evidence_root}/${req_file}"

    if [[ ! -f "$full_path" ]]; then
      log_error "  ✗ Missing real evidence file: $req_file"
      return 1
    fi

    # Verify file is not empty
    if [[ ! -s "$full_path" ]]; then
      log_error "  ✗ Empty evidence file: $req_file"
      return 1
    fi

    # Verify it looks like real Jira JSON (has key fields)
    if ! jq -e '.self' "$full_path" >/dev/null 2>&1; then
      log_error "  ✗ Invalid Jira response in: $req_file (missing 'self' field)"
      return 1
    fi

    log_info "  ✓ Real evidence verified: $req_file"
  done

  # Check pagination reports
  local pagination_reports
  pagination_reports=$(find "${evidence_root}/01_raw_api" -name "*_pagination_report.json" 2>/dev/null | wc -l)

  if [[ $pagination_reports -gt 0 ]]; then
    log_info "  ✓ Found $pagination_reports pagination reports"
  else
    log_warn "  ⚠ No pagination reports found (some endpoints may not have pagination)"
  fi

  log_info "  ✓ LIVE mode evidence verified"
  return 0
}

# ============================================================================
# MAIN MODE INTEGRITY CHECK
# ============================================================================

perform_mode_integrity_check() {
  local evidence_root="$1"
  local declared_mode="$2"  # What we're claiming the mode is

  log_info ""
  log_info "=========================================="
  log_info "MODE INTEGRITY CHECK"
  log_info "=========================================="

  local verdict="PASS"
  local -a failures=()

  # Get metadata
  local metadata_file="${evidence_root}/00_meta/METADATA.json"
  if [[ ! -f "$metadata_file" ]]; then
    log_error "Missing metadata: $metadata_file"
    verdict="FAIL"
    failures+=("missing_metadata")
  fi

  # Extract actual mode from metadata (source of truth)
  local actual_mode
  actual_mode=$(jq -r '.mode // "UNKNOWN"' "$metadata_file" 2>/dev/null || echo "UNKNOWN")

  log_info "Expected mode: $declared_mode"
  log_info "Actual mode (from metadata): $actual_mode"

  # Phase 1: Verify metadata consistency
  if ! verify_metadata_mode_claim "$evidence_root" "$actual_mode"; then
    verdict="FAIL"
    failures+=("metadata_inconsistency")
  fi

  # Phase 2: Contamination scan
  if [[ "$actual_mode" == "LIVE" ]]; then
    if ! scan_for_demo_contamination "$evidence_root" "$actual_mode"; then
      verdict="FAIL"
      failures+=("demo_contamination_detected")
    fi

    # Phase 3: Verify LIVE has real evidence
    if ! verify_live_has_real_evidence "$evidence_root"; then
      verdict="FAIL"
      failures+=("live_missing_real_evidence")
    fi
  fi

  # Generate report
  local report_file="${evidence_root}/mode_integrity_report.json"
  local failures_json_str=""
  if [[ ${#failures[@]} -gt 0 ]]; then
    failures_json_str=$(printf '"%s"\n' "${failures[@]}" | paste -sd,)
  fi

  cat > "$report_file" << REPORT_EOF
{
  "mode": "$actual_mode",
  "declared_mode": "$declared_mode",
  "verdict": "$verdict",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "checks": {
    "metadata_consistency": $(if [[ " ${failures[*]:-} " =~ "metadata_inconsistency" ]]; then echo "false"; else echo "true"; fi),
    "contamination_scan": $(if [[ " ${failures[*]:-} " =~ "demo_contamination_detected" ]]; then echo "false"; else echo "true"; fi),
    "live_real_evidence": $(if [[ " ${failures[*]:-} " =~ "live_missing_real_evidence" ]]; then echo "false"; else echo "true"; fi)
  },
  "failures": [$failures_json_str]
}
REPORT_EOF

  log_info ""
  log_info "Mode Integrity Report: $report_file"
  log_info "Verdict: $verdict"

  if [[ "$verdict" == "FAIL" ]]; then
    log_error "❌ MODE INTEGRITY CHECK FAILED"
    return 1
  else
    log_info "✅ MODE INTEGRITY CHECK PASSED"
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
