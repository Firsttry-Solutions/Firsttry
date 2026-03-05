#!/usr/bin/env bash
#
# FirstTry Trust Center Validator
#
# Purpose: Verify that all required trust center documentation is present
# Exit codes:
#   0 = All documents present (PASS)
#   1 = Missing documents (FAIL)
#   2 = Fatal error (invalid environment, missing tools)
#
# Usage: bash tools/trust_center/verify_trust_center.sh
#
# NO EXTERNAL DEPENDENCIES (bash, jq, and standard Unix tools only)

set -euo pipefail

# ============================================================================
# CONFIGURATION
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
OUTPUT_DIR="/tmp/firsttry_trust_center_validation_$(date +%Y%m%d_%H%M%S)"

DOCS_TRUST="${REPO_ROOT}/docs/trust"
DOCS_LEGAL="${REPO_ROOT}/docs/legal"
DOCS_SUPPORT="${REPO_ROOT}/docs/support"

# ============================================================================
# REQUIRED DOCUMENTS
# ============================================================================

# Trust Center documents
TRUST_DOCS=(
  "TRUST_CENTER.md"
  "security_whitepaper.md"
  "threat_model.md"
  "data_handling.md"
  "data_retention.md"
  "incident_response.md"
  "responsible_disclosure.md"
  "subprocessors.md"
  "vendor_security.md"
  "ENTERPRISE_SECURITY_QUESTIONNAIRE.md"
)

# SOC2 documents
SOC2_DOCS=(
  "soc2/SOC2_CONTROL_MAPPING.md"
)

# Legal documents
LEGAL_DOCS=(
  "PRIVACY_POLICY.md"
  "TERMS_OF_SERVICE.md"
)

# Support documents
SUPPORT_DOCS=(
  "SUPPORT_SLA.md"
)

# ============================================================================
# UTILITIES
# ============================================================================

log_info() {
  echo "[INFO] $*"
}

log_success() {
  echo "[SUCCESS] $*"
}

log_error() {
  echo "[ERROR] $*" >&2
}

log_fatal() {
  echo "[FATAL] $*" >&2
  exit 2
}

# ============================================================================
# ENVIRONMENT CHECKS
# ============================================================================

check_environment() {
  log_info "Checking environment..."
  
  if [[ ! -d "${REPO_ROOT}" ]]; then
    log_fatal "Repository root not found: ${REPO_ROOT}"
  fi
  
  if ! command -v jq &> /dev/null; then
    log_fatal "jq is required but not installed. Install with: apt-get install jq"
  fi
  
  log_success "Environment OK"
}

# ============================================================================
# DOCUMENT PRESENCE CHECKS
# ============================================================================

check_trust_docs() {
  log_info "Checking trust center documents..."
  
  local missing=()
  local present=()
  
  for doc in "${TRUST_DOCS[@]}"; do
    local path="${DOCS_TRUST}/${doc}"
    if [[ -f "${path}" ]]; then
      present+=("${doc}")
      log_success "  ✓ ${doc}"
    else
      missing+=("${doc}")
      log_error "  ✗ MISSING: ${doc}"
    fi
  done
  
  # Write JSON report (handle empty arrays)
  present_json="[]"
  if [[ ${#present[@]} -gt 0 ]]; then
    present_json="$(printf '%s\n' "${present[@]}" | jq -R . | jq -s .)"
  fi
  
  missing_json="[]"
  if [[ ${#missing[@]} -gt 0 ]]; then
    missing_json="$(printf '%s\n' "${missing[@]}" | jq -R . | jq -s .)"
  fi
  
  jq -n \
    --arg base "docs/trust" \
    --argjson present "${present_json}" \
    --argjson missing "${missing_json}" \
    '{
      category: "trust_docs",
      base_path: $base,
      present: $present,
      missing: $missing,
      total: ($present | length),
      expected: (($present | length) + ($missing | length)),
      pass: (($missing | length) == 0)
    }' > "${OUTPUT_DIR}/trust_docs.json" 2>/dev/null || true
  
  if [[ ${#missing[@]} -gt 0 ]]; then
    return 1
  fi
  return 0
}

check_soc2_docs() {
  log_info "Checking SOC2 documents..."
  
  local missing=()
  local present=()
  
  for doc in "${SOC2_DOCS[@]}"; do
    local path="${DOCS_TRUST}/${doc}"
    if [[ -f "${path}" ]]; then
      present+=("${doc}")
      log_success "  ✓ ${doc}"
    else
      missing+=("${doc}")
      log_error "  ✗ MISSING: ${doc}"
    fi
  done
  
  # Write JSON report (handle empty arrays)
  present_json="[]"
  if [[ ${#present[@]} -gt 0 ]]; then
    present_json="$(printf '%s\n' "${present[@]}" | jq -R . | jq -s .)"
  fi
  
  missing_json="[]"
  if [[ ${#missing[@]} -gt 0 ]]; then
    missing_json="$(printf '%s\n' "${missing[@]}" | jq -R . | jq -s .)"
  fi
  
  jq -n \
    --arg base "docs/trust" \
    --argjson present "${present_json}" \
    --argjson missing "${missing_json}" \
    '{
      category: "soc2_docs",
      base_path: $base,
      present: $present,
      missing: $missing,
      total: ($present | length),
      expected: (($present | length) + ($missing | length)),
      pass: (($missing | length) == 0)
    }' > "${OUTPUT_DIR}/soc2_docs.json" 2>/dev/null || true
  
  if [[ ${#missing[@]} -gt 0 ]]; then
    return 1
  fi
  return 0
}

check_legal_docs() {
  log_info "Checking legal documents..."
  
  local missing=()
  local present=()
  
  for doc in "${LEGAL_DOCS[@]}"; do
    local path="${DOCS_LEGAL}/${doc}"
    if [[ -f "${path}" ]]; then
      present+=("${doc}")
      log_success "  ✓ ${doc}"
    else
      missing+=("${doc}")
      log_error "  ✗ MISSING: ${doc}"
    fi
  done
  
  # Write JSON report (handle empty arrays)
  present_json="[]"
  if [[ ${#present[@]} -gt 0 ]]; then
    present_json="$(printf '%s\n' "${present[@]}" | jq -R . | jq -s .)"
  fi
  
  missing_json="[]"
  if [[ ${#missing[@]} -gt 0 ]]; then
    missing_json="$(printf '%s\n' "${missing[@]}" | jq -R . | jq -s .)"
  fi
  
  jq -n \
    --arg base "docs/legal" \
    --argjson present "${present_json}" \
    --argjson missing "${missing_json}" \
    '{
      category: "legal_docs",
      base_path: $base,
      present: $present,
      missing: $missing,
      total: ($present | length),
      expected: (($present | length) + ($missing | length)),
      pass: (($missing | length) == 0)
    }' > "${OUTPUT_DIR}/legal_docs.json" 2>/dev/null || true
  
  if [[ ${#missing[@]} -gt 0 ]]; then
    return 1
  fi
  return 0
}

check_support_docs() {
  log_info "Checking support documents..."
  
  local missing=()
  local present=()
  
  for doc in "${SUPPORT_DOCS[@]}"; do
    local path="${DOCS_SUPPORT}/${doc}"
    if [[ -f "${path}" ]]; then
      present+=("${doc}")
      log_success "  ✓ ${doc}"
    else
      missing+=("${doc}")
      log_error "  ✗ MISSING: ${doc}"
    fi
  done
  
  # Write JSON report (handle empty arrays)
  present_json="[]"
  if [[ ${#present[@]} -gt 0 ]]; then
    present_json="$(printf '%s\n' "${present[@]}" | jq -R . | jq -s .)"
  fi
  
  missing_json="[]"
  if [[ ${#missing[@]} -gt 0 ]]; then
    missing_json="$(printf '%s\n' "${missing[@]}" | jq -R . | jq -s .)"
  fi
  
  jq -n \
    --arg base "docs/support" \
    --argjson present "${present_json}" \
    --argjson missing "${missing_json}" \
    '{
      category: "support_docs",
      base_path: $base,
      present: $present,
      missing: $missing,
      total: ($present | length),
      expected: (($present | length) + ($missing | length)),
      pass: (($missing | length) == 0)
    }' > "${OUTPUT_DIR}/support_docs.json" 2>/dev/null || true
  
  if [[ ${#missing[@]} -gt 0 ]]; then
    return 1
  fi
  return 0
}

# ============================================================================
# SUMMARY
# ============================================================================

generate_summary() {
  local trust_pass=$1
  local soc2_pass=$2
  local legal_pass=$3
  local support_pass=$4
  
  log_info "Generating summary..."
  
  # Aggregate results
  local overall_pass=true
  if [[ "${trust_pass}" != "true" ]] || \
     [[ "${soc2_pass}" != "true" ]] || \
     [[ "${legal_pass}" != "true" ]] || \
     [[ "${support_pass}" != "true" ]]; then
    overall_pass=false
  fi
  
  # Create summary JSON (with error handling for missing/invalid JSON files)
  local trust_json="{}"
  local soc2_json="{}"
  local legal_json="{}"
  local support_json="{}"
  
  [[ -f "${OUTPUT_DIR}/trust_docs.json" ]] && trust_json="$(cat "${OUTPUT_DIR}/trust_docs.json" 2>/dev/null || echo '{}')"
  [[ -f "${OUTPUT_DIR}/soc2_docs.json" ]] && soc2_json="$(cat "${OUTPUT_DIR}/soc2_docs.json" 2>/dev/null || echo '{}')"
  [[ -f "${OUTPUT_DIR}/legal_docs.json" ]] && legal_json="$(cat "${OUTPUT_DIR}/legal_docs.json" 2>/dev/null || echo '{}')"
  [[ -f "${OUTPUT_DIR}/support_docs.json" ]] && support_json="$(cat "${OUTPUT_DIR}/support_docs.json" 2>/dev/null || echo '{}')"
  
  jq -n \
    --argjson trust "${trust_json}" \
    --argjson soc2 "${soc2_json}" \
    --argjson legal "${legal_json}" \
    --argjson support "${support_json}" \
    --argjson overall "${overall_pass}" \
    --arg timestamp "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    '{
      validation_timestamp: $timestamp,
      overall_pass: $overall,
      categories: {
        trust_center: $trust,
        soc2: $soc2,
        legal: $legal,
        support: $support
      }
    }' > "${OUTPUT_DIR}/summary.json" 2>/dev/null || echo '{"validation_timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'", "overall_pass": '${overall_pass}'}' > "${OUTPUT_DIR}/summary.json"
  
  # Create FINAL_VERDICT.txt
  if [[ "${overall_pass}" == "true" ]]; then
    cat > "${OUTPUT_DIR}/FINAL_VERDICT.txt" <<EOF
===============================================================================
TRUST CENTER VALIDATION: PASS
===============================================================================

All required trust center documentation is present.

TRUST CENTER DOCS: ✓ PASS (${TRUST_DOCS[@]} | wc -w)/${TRUST_DOCS[@]} | wc -w} documents)
SOC2 DOCS:         ✓ PASS (${SOC2_DOCS[@]} | wc -w)/${SOC2_DOCS[@]} | wc -w} documents)
LEGAL DOCS:        ✓ PASS (${LEGAL_DOCS[@]} | wc -w)/${LEGAL_DOCS[@]} | wc -w} documents)
SUPPORT DOCS:      ✓ PASS (${SUPPORT_DOCS[@]} | wc -w)/${SUPPORT_DOCS[@]} | wc -w} documents)

OVERALL: ✓ PASS

Validation completed: $(date -u +%Y-%m-%dT%H:%M:%SZ)
Output directory: ${OUTPUT_DIR}

===============================================================================
EOF
    log_success "✓ TRUST CENTER VALIDATION: PASS"
  else
    cat > "${OUTPUT_DIR}/FINAL_VERDICT.txt" <<EOF
===============================================================================
TRUST CENTER VALIDATION: FAIL
===============================================================================

Some required trust center documentation is missing.

Review the following files for details:
  - ${OUTPUT_DIR}/trust_docs.json
  - ${OUTPUT_DIR}/soc2_docs.json
  - ${OUTPUT_DIR}/legal_docs.json
  - ${OUTPUT_DIR}/support_docs.json

REQUIRED ACTIONS:
1. Create all missing documents listed in the JSON reports above
2. Rerun this script to verify: bash tools/trust_center/verify_trust_center.sh

Validation completed: $(date -u +%Y-%m-%dT%H:%M:%SZ)
Output directory: ${OUTPUT_DIR}

===============================================================================
EOF
    log_error "✗ TRUST CENTER VALIDATION: FAIL"
  fi
}

# ============================================================================
# MAIN
# ============================================================================

main() {
  echo "==============================================================================="
  echo "FirstTry Trust Center Validator"
  echo "==============================================================================="
  echo ""
  
  # Create output directory
  mkdir -p "${OUTPUT_DIR}"
  log_info "Output directory: ${OUTPUT_DIR}"
  echo ""
  
  # Environment checks
  check_environment
  echo ""
  
  # Check documents
  local trust_pass=false
  local soc2_pass=false
  local legal_pass=false
  local support_pass=false
  
  if check_trust_docs; then
    trust_pass=true
  fi
  echo ""
  
  if check_soc2_docs; then
    soc2_pass=true
  fi
  echo ""
  
  if check_legal_docs; then
    legal_pass=true
  fi
  echo ""
  
  if check_support_docs; then
    support_pass=true
  fi
  echo ""
  
  # Generate summary
  generate_summary "${trust_pass}" "${soc2_pass}" "${legal_pass}" "${support_pass}"
  echo ""
  
  # Print final verdict
  cat "${OUTPUT_DIR}/FINAL_VERDICT.txt"
  echo ""
  
  # Exit
  if [[ "${trust_pass}" == "true" ]] && \
     [[ "${soc2_pass}" == "true" ]] && \
     [[ "${legal_pass}" == "true" ]] && \
     [[ "${support_pass}" == "true" ]]; then
    exit 0
  else
    exit 1
  fi
}

main "$@"
