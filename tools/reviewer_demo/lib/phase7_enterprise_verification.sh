#!/usr/bin/env bash
set -euo pipefail

# Phase 7: Enterprise Verification (Offline)
# Comprehensive fail-closed verification of LIVE evidence pack

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/_common.sh"

phase7_enterprise_verification() {
  local evidence_root="${1:-/tmp/firsttry_reviewer_demo_LATEST}"

  log_info ""
  log_info "PHASE 5: Enterprise Verification (Offline, Fail-Closed)"
  log_info "========================================================"

  local failures=()
  local pass_count=0
  local fail_count=0

  # =========================================================================
  # CHECK A: MODE must be LIVE
  # =========================================================================

  log_info ""
  log_info "CHECK A: Mode Enforcement"

  local mode="UNKNOWN"
  if [[ -f "${evidence_root}/00_meta/METADATA.json" ]]; then
    mode=$(jq -r '.mode // "UNKNOWN"' "${evidence_root}/00_meta/METADATA.json")
  fi

  if [[ "$mode" != "LIVE" ]]; then
    log_error "✗ MODE is '$mode', not 'LIVE'"
    failures+=("Mode is not LIVE (found: $mode)")
    ((fail_count++))
  else
    log_info "✓ MODE is LIVE"
    ((pass_count++))
  fi

  # =========================================================================
  # CHECK B: Required raw files exist and non-empty
  # =========================================================================

  log_info ""
  log_info "CHECK B: Raw Evidence Files"

  local required_raw_files=(
    "01_raw_api/myself.response.json"
    "01_raw_api/serverInfo.response.json"
    "01_raw_api/permissionschemes.response.json"
    "01_raw_api/groups_picker_page001.response.json"
  )

  local has_project_search=false
  [[ -f "${evidence_root}/01_raw_api/project_search_page001.response.json" ]] && has_project_search=true

  local all_raw_ok=true
  for raw_file in "${required_raw_files[@]}"; do
    if [[ ! -f "${evidence_root}/$raw_file" ]]; then
      log_error "✗ Missing: $raw_file"
      failures+=("Missing raw evidence: $raw_file")
      all_raw_ok=false
    else
      # Check file is non-empty
      if [[ ! -s "${evidence_root}/$raw_file" ]]; then
        log_error "✗ Empty file: $raw_file"
        failures+=("Empty raw evidence: $raw_file")
        all_raw_ok=false
      else
        log_info "✓ Found: $raw_file"
      fi
    fi
  done

  if [[ "$has_project_search" == "true" ]]; then
    log_info "✓ Project search pages present"
  else
    log_error "✗ No project search pages found"
    failures+=("No project search pages captured")
    all_raw_ok=false
  fi

  # =========================================================================
  # CHECK C: Pagination proof exists and references correct files
  # =========================================================================

  log_info ""
  log_info "CHECK C: Pagination Proof"

  local pagination_ok=true
  if [[ ! -f "${evidence_root}/02_pagination/pagination_proof.json" ]]; then
    log_error "✗ Missing: 02_pagination/pagination_proof.json"
    failures+=("Missing pagination proof")
    pagination_ok=false
  else
    # Check pagination_valid flag
    local pag_valid
    pag_valid=$(jq -r '.pagination_valid // false' "${evidence_root}/02_pagination/pagination_proof.json")

    if [[ "$pag_valid" == "true" ]]; then
      log_info "✓ Pagination proof valid"
    else
      log_error "✗ Pagination proof invalid flag"
      failures+=("Pagination proof validation flag not true")
      pagination_ok=false
    fi
  fi

  if [[ "$pagination_ok" == "true" ]]; then
    ((pass_count++))
  else
    ((fail_count++))
  fi

  # =========================================================================
  # CHECK D: Derived files have _provenance with sources
  # =========================================================================

  log_info ""
  log_info "CHECK D: Derived File Provenance"

  local derived_dir="${evidence_root}/08_governance_snapshot/derived"
  local derived_ok=true

  if [[ ! -d "$derived_dir" ]]; then
    log_error "✗ Missing: 08_governance_snapshot/derived"
    failures+=("Missing derived directory")
    derived_ok=false
  else
    # Check each derived file
    for derived_file in governance_snapshot.json jira_projects_snapshot.json jira_permissions_snapshot.json jira_groups_snapshot.json jira_project_access_map.json governance_audit_report.json; do
      if [[ ! -f "${derived_dir}/${derived_file}" ]]; then
        log_error "✗ Missing derived: $derived_file"
        failures+=("Missing derived file: $derived_file")
        derived_ok=false
      else
        # Check for _provenance
        if ! jq -e '._provenance' "${derived_dir}/${derived_file}" >/dev/null 2>&1; then
          log_error "✗ No _provenance in: $derived_file"
          failures+=("Missing _provenance in: $derived_file")
          derived_ok=false
        else
          # Check provenance has sources
          local source_count
          source_count=$(jq '._provenance.sources | length' "${derived_dir}/${derived_file}")

          if [[ "$source_count" -gt 0 ]]; then
            log_info "✓ $derived_file has provenance with $source_count sources"
          else
            log_error "✗ $derived_file provenance has no sources"
            failures+=("Provenance sources missing in: $derived_file")
            derived_ok=false
          fi
        fi
      fi
    done
  fi

  if [[ "$derived_ok" == "true" ]]; then
    ((pass_count++))
  else
    ((fail_count++))
  fi

  # =========================================================================
  # CHECK E: Provenance source files exist with matching sha256
  # =========================================================================

  log_info ""
  log_info "CHECK E: Source File Verification"

  local sources_ok=true
  if [[ -f "${derived_dir}/governance_snapshot.json" ]]; then
    local sources
    sources=$(jq -r '._provenance.sources[]? | "\(.raw_file) \(.raw_sha256 // "")"' "${derived_dir}/governance_snapshot.json" | head -3)

    if [[ -n "$sources" ]]; then
      while IFS=' ' read -r src_file src_sha256; do
        if [[ ! -f "${evidence_root}/$src_file" ]]; then
          log_error "✗ Source file missing: $src_file"
          failures+=("Source file missing: $src_file")
          sources_ok=false
        else
          log_info "✓ Source file exists: $src_file"
        fi
      done <<< "$sources"
    fi
  fi

  if [[ "$sources_ok" == "true" ]]; then
    ((pass_count++))
  else
    ((fail_count++))
  fi

  # =========================================================================
  # CHECK F: Evidence manifest sha256sum verification
  # =========================================================================

  log_info ""
  log_info "CHECK F: Hash Manifest Verification"

  local hashes_ok=true
  local manifest="${evidence_root}/09_evidence_pack/evidence_manifest.sha256"

  if [[ ! -f "$manifest" ]]; then
    log_error "✗ Missing: evidence_manifest.sha256"
    failures+=("Missing hash manifest")
    hashes_ok=false
  else
    # Verify hash manifest (run from evidence root to use relative paths)
    cd "$evidence_root"

    if sha256sum -c "09_evidence_pack/evidence_manifest.sha256" >/dev/null 2>&1; then
      local ok_count
      ok_count=$(sha256sum -c "09_evidence_pack/evidence_manifest.sha256" 2>/dev/null | grep -c ": OK$" || echo "0")
      log_info "✓ Hash verification PASSED ($ok_count files verified)"
    else
      local fail_count_hashes
      fail_count_hashes=$(sha256sum -c "09_evidence_pack/evidence_manifest.sha256" 2>&1 | grep -c "FAILED$" || echo "0")
      log_error "✗ Hash verification FAILED ($fail_count_hashes files)"
      failures+=("Hash verification failed ($fail_count_hashes files)")
      hashes_ok=false
    fi

    cd - >/dev/null
  fi

  if [[ "$hashes_ok" == "true" ]]; then
    ((pass_count++))
  else
    ((fail_count++))
  fi

  # =========================================================================
  # CHECK G: Proof pack hash verification
  # =========================================================================

  log_info ""
  log_info "CHECK G: Proof Pack Hash"

  local proof_ok=true
  local proof_pack="${evidence_root}/09_evidence_pack/PROOF_PACK_SHA256.txt"

  if [[ ! -f "$proof_pack" ]]; then
    log_error "✗ Missing: PROOF_PACK_SHA256.txt"
    failures+=("Missing proof pack hash")
    proof_ok=false
  else
    # Verify proof pack hash (hash of the manifest)
    local expected_proof
    expected_proof=$(cat "$proof_pack")

    local actual_proof
    actual_proof=$(sha256sum "${evidence_root}/09_evidence_pack/evidence_manifest.sha256" | awk '{print $1}')

    if [[ "$expected_proof" == "$actual_proof" ]]; then
      log_info "✓ Proof pack hash VERIFIED (manifest not tampered)"
    else
      log_error "✗ Proof pack hash MISMATCH (expected: $expected_proof, actual: $actual_proof)"
      failures+=("Proof pack hash mismatch (manifest tampered?)")
      proof_ok=false
    fi
  fi

  if [[ "$proof_ok" == "true" ]]; then
    ((pass_count++))
  else
    ((fail_count++))
  fi

  # =========================================================================
  # FINAL VERDICT
  # =========================================================================

  log_info ""
  log_info "======================================================================"
  log_info "VERIFICATION SUMMARY"
  log_info "======================================================================"
  log_info "Checks passed: $pass_count"
  log_info "Checks failed: $fail_count"

  local final_verdict="FAIL"
  if [[ $fail_count -eq 0 ]] && [[ $pass_count -ge 7 ]]; then
    final_verdict="PASS"
  fi

  if [[ "${#failures[@]}" -gt 0 ]]; then
    log_info ""
    log_error "Failures detected:"
    for failure in "${failures[@]}"; do
      log_error "  - $failure"
    done
  fi

  # =========================================================================
  # WRITE VERDICT FILES
  # =========================================================================

  echo "$final_verdict" > "${evidence_root}/FINAL_REVIEWER_VERDICT.txt"

  # Write VERIFIER_REPORT.json
  jq -n \
    --arg verdict "$final_verdict" \
    --arg mode "$mode" \
    --arg timestamp "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    --argjson pass "$([ "$final_verdict" = "PASS" ] && echo true || echo false)" \
    --argjson failures "$(printf '%s\n' "${failures[@]}" | jq -R . | jq -s .)" \
    --argjson stats "{\"checks_passed\": $pass_count, \"checks_failed\": $fail_count}" \
    '{
      mode: $mode,
      verdict: $verdict,
      pass: $pass,
      verified_at_utc: $timestamp,
      failures: $failures,
      stats: $stats
    }' > "${evidence_root}/VERIFIER_REPORT.json"

  log_info ""
  log_info "Final verdict: $final_verdict"
  log_info "FINAL_REVIEWER_VERDICT.txt written"
  log_info "VERIFIER_REPORT.json written"

  # Exit with appropriate code
  if [[ "$final_verdict" == "PASS" ]]; then
    return 0
  else
    return 1
  fi
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  evidence_dir="${1:-/tmp/firsttry_reviewer_demo_LATEST}"
  phase7_enterprise_verification "$evidence_dir"
fi
