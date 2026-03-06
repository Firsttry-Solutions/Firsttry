#!/usr/bin/env bash
set -euo pipefail

# Source common utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/_common.sh
source "${SCRIPT_DIR}/_common.sh"

generate_verdict() {
  local evidence_root="$1"
  local mode="$2"

  log_info "Generating final verdict..."

  # Initialize status tracking
  local installation_status="N/A"
  local gadget_status="N/A"
  local proof_pack_status="N/A"
  local verification_status="N/A"
  local network_status="PASS"  # Static audit always runs
  local architecture_status="UNKNOWN"
  local blast_radius_status="UNKNOWN"
  local determinism_status="N/A"
  local uninstall_status="N/A"
  local overall_status="PASS"

  # DEMO mode: Skip real infrastructure checks, just mark as DEMO
  if [[ "$mode" == "DEMO" ]]; then
    overall_status="DEMO_ONLY"
    architecture_status="DEMO"
    governance_status="DEMO"
    network_status="DEMO"

    # In DEMO mode, just generate the verdict files and return
    cat > "${evidence_root}/demo_verdict.json" << EOF
{
  "timestamp": "$(create_timestamp)",
  "mode": "$mode",
  "installation_status": "$installation_status",
  "gadget_status": "$gadget_status",
  "proof_pack_status": "$proof_pack_status",
  "verification_status": "$verification_status",
  "network_status": "$network_status",
  "architecture_status": "$architecture_status",
  "scope_status": "N/A",
  "blast_radius_status": "N/A",
  "governance_status": "$governance_status",
  "determinism_status": "$determinism_status",
  "uninstall_status": "$uninstall_status",
  "overall": "$overall_status"
}
EOF

    echo "$overall_status" > "${evidence_root}/FINAL_REVIEWER_VERDICT.txt"
    log_info "✓ DEMO mode verdict: $overall_status"
    return 0
  fi

  # Check docs integrity audit (was previously called architecture audit)
  if [[ -f "${evidence_root}/02_docs_integrity/docs_integrity_report.json" ]]; then
    if grep -q '"pass":\s*true' "${evidence_root}/02_docs_integrity/docs_integrity_report.json" 2>/dev/null; then
      architecture_status="PASS"
    else
      architecture_status="FAIL"
      overall_status="FAIL"
    fi
  else
    architecture_status="FAIL"
    overall_status="FAIL"
  fi

  # Check scope audit (critical for security)
  local scope_status="UNKNOWN"
  if [[ -f "${evidence_root}/03_scope_audit/scope_audit.json" ]]; then
    if grep -q '"status":\s*"PASS"' "${evidence_root}/03_scope_audit/scope_audit.json" 2>/dev/null; then
      scope_status="PASS"
    else
      scope_status="FAIL"
      overall_status="FAIL"
    fi
  else
    scope_status="FAIL"
    overall_status="FAIL"
  fi

  # Check blast radius audit
  if [[ -f "${evidence_root}/07_blast_radius/blast_radius_report.json" ]]; then
    if grep -q '"pass":\s*true' "${evidence_root}/07_blast_radius/blast_radius_report.json" 2>/dev/null; then
      blast_radius_status="PASS"
    else
      blast_radius_status="FAIL"
      overall_status="FAIL"
    fi
  else
    blast_radius_status="FAIL"
    overall_status="FAIL"
  fi

  # Check governance snapshot validation (NEW)
  local governance_status="UNKNOWN"
  if [[ -f "${evidence_root}/08_governance_snapshot/validation/validation_report.json" ]]; then
    # Check all validation assertions
    local validation_passed=true

    # Read all assertion results
    while IFS= read -r assertion; do
      if [[ "$assertion" =~ false ]]; then
        validation_passed=false
        break
      fi
    done < <(jq -r 'to_entries[] | select(.key | startswith("assert_")) | .value' \
              "${evidence_root}/08_governance_snapshot/validation/validation_report.json" 2>/dev/null || echo "false")

    if [[ "$validation_passed" == "true" ]]; then
      governance_status="PASS"
    else
      governance_status="FAIL"
      overall_status="FAIL"
    fi
  elif [[ -f "${evidence_root}/08_governance_snapshot/derived/governance_audit_report.json" ]]; then
    # Check governance audit report status
    if jq -e '.offline_mode == true' "${evidence_root}/08_governance_snapshot/derived/governance_audit_report.json" >/dev/null 2>&1; then
      governance_status="OFFLINE"  # Offline mode - not a failure
    elif jq -e '.validation_status == "passed"' "${evidence_root}/08_governance_snapshot/derived/governance_audit_report.json" >/dev/null 2>&1; then
      governance_status="PASS"
    else
      governance_status="FAIL"
      overall_status="FAIL"
    fi
  else
    governance_status="FAIL"
    overall_status="FAIL"
  fi

  # Check network audit
  if [[ -f "${evidence_root}/05_network/static_network_audit.json" ]]; then
    if grep -q '"pass":\s*true' "${evidence_root}/05_network/static_network_audit.json" 2>/dev/null; then
      network_status="PASS"
    else
      network_status="FAIL"
      overall_status="FAIL"
    fi
  elif [[ "$mode" == "LIVE" ]]; then
    network_status="FAIL"
    overall_status="FAIL"
  fi

  # LIVE mode specific checks
  if [[ "$mode" == "LIVE" ]]; then
    # Check installation status
    if [[ -f "${evidence_root}/01_install/install_status.json" ]]; then
      if grep -q '"install_success":\s*true' "${evidence_root}/01_install/install_status.json" 2>/dev/null; then
        installation_status="PASS"
      else
        installation_status="FAIL"
        overall_status="FAIL"
      fi
    else
      installation_status="FAIL"
      overall_status="FAIL"
    fi

    # Check gadget status
    if [[ -f "${evidence_root}/02_gadget/summary.json" ]]; then
      if grep -q '"render_success":\s*true' "${evidence_root}/02_gadget/summary.json" 2>/dev/null; then
        gadget_status="PASS"
      else
        gadget_status="FAIL"
        overall_status="FAIL"
      fi
    else
      gadget_status="FAIL"
      overall_status="FAIL"
    fi

    # Check proof pack and verification
    if [[ -f "${evidence_root}/03_proof_pack/PROOF_PACK_SHA256.txt" ]]; then
      proof_pack_status="PASS"
    else
      proof_pack_status="FAIL"
      overall_status="FAIL"
    fi

    if [[ -f "${evidence_root}/04_verification/verify.log" ]]; then
      verification_status="PASS"
    else
      verification_status="FAIL"
      overall_status="FAIL"
    fi

    # Check determinism
    if [[ -f "${evidence_root}/08_determinism/determinism_report.json" ]]; then
      if grep -q '"pass":\s*true' "${evidence_root}/08_determinism/determinism_report.json" 2>/dev/null; then
        determinism_status="PASS"
      else
        determinism_status="FAIL"
        overall_status="FAIL"
      fi
    else
      determinism_status="FAIL"
      overall_status="FAIL"
    fi

    # Check uninstall
    if [[ -f "${evidence_root}/09_uninstall/uninstall_status.json" ]]; then
      if grep -q '"uninstall_success":\s*true' "${evidence_root}/09_uninstall/uninstall_status.json" 2>/dev/null; then
        uninstall_status="PASS"
      else
        uninstall_status="FAIL"
        overall_status="FAIL"
      fi
    else
      uninstall_status="FAIL"
      overall_status="FAIL"
    fi
  fi

  # Generate demo_verdict.json without jq dependency
  cat > "${evidence_root}/demo_verdict.json" << EOF
{
  "timestamp": "$(create_timestamp)",
  "mode": "$mode",
  "installation_status": "$installation_status",
  "gadget_status": "$gadget_status",
  "proof_pack_status": "$proof_pack_status",
  "verification_status": "$verification_status",
  "network_status": "$network_status",
  "architecture_status": "$architecture_status",
  "scope_status": "$scope_status",
  "blast_radius_status": "$blast_radius_status",
  "governance_status": "$governance_status",
  "determinism_status": "$determinism_status",
  "uninstall_status": "$uninstall_status",
  "overall": "$overall_status"
}
EOF

  # Generate FINAL_REVIEWER_VERDICT.txt
  echo "$overall_status" > "${evidence_root}/FINAL_REVIEWER_VERDICT.txt"

  # Cross-verification: Ensure JSON verdict matches text verdict
  log_info "Performing verdict consistency cross-verification..."

  local json_verdict
  json_verdict=$(grep -o '"overall":\s*"[^"]*"' "${evidence_root}/demo_verdict.json" | sed 's/.*"\([^"]*\)".*/\1/')

  local text_verdict
  text_verdict=$(cat "${evidence_root}/FINAL_REVIEWER_VERDICT.txt" | tr -d '\n\r ')

  log_info "JSON verdict: '$json_verdict'"
  log_info "Text verdict: '$text_verdict'"

  if [[ "$json_verdict" != "$text_verdict" ]]; then
    log_error "CRITICAL: Verdict consistency check FAILED"
    log_error "JSON verdict ('$json_verdict') does not match text verdict ('$text_verdict')"

    # Create consistency failure report
    cat > "${evidence_root}/VERDICT_CONSISTENCY_FAILURE.json" << EOF
{
  "timestamp": "$(create_timestamp)",
  "error": "Verdict consistency check failed",
  "json_verdict": "$json_verdict",
  "text_verdict": "$text_verdict",
  "status": "CONSISTENCY_FAILURE"
}
EOF

    # Overwrite both verdicts with failure status to maintain fail-closed behavior
    cat > "${evidence_root}/demo_verdict.json" << EOF
{
  "timestamp": "$(create_timestamp)",
  "mode": "$mode",
  "installation_status": "$installation_status",
  "gadget_status": "$gadget_status",
  "proof_pack_status": "$proof_pack_status",
  "verification_status": "$verification_status",
  "network_status": "$network_status",
  "architecture_status": "$architecture_status",
  "scope_status": "$scope_status",
  "blast_radius_status": "$blast_radius_status",
  "governance_status": "$governance_status",
  "determinism_status": "$determinism_status",
  "uninstall_status": "$uninstall_status",
  "overall": "CONSISTENCY_FAILURE",
  "consistency_error": "JSON and text verdicts did not match"
}
EOF

    echo "CONSISTENCY_FAILURE" > "${evidence_root}/FINAL_REVIEWER_VERDICT.txt"

    log_error "Verdict set to CONSISTENCY_FAILURE due to mismatch"
    return 1
  fi

  log_success "Verdict consistency check PASSED: JSON and text verdicts match"
  log_info "Final verdict generated: $overall_status"
}