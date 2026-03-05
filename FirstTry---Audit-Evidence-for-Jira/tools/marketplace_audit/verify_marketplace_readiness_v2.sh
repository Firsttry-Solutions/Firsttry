#!/usr/bin/env bash
#
# verify_marketplace_readiness_v2.sh — Fail-Closed Marketplace Readiness Verification
#
# PURPOSE:
#   Aggregate all marketplace readiness checks into a single fail-closed verification script:
#   1. Marketplace audit v2 (manifest, network, docs, evidence harness, trust center)
#   2. Trust center validator (all docs present)
#   3. SOC2 evidence pack generator (can generate tamper-evident pack)
#
# EXIT CODES:
#   0 = ALL CHECKS PASS (marketplace-ready)
#   1 = ONE OR MORE CHECKS FAILED (not ready)
#   2 = Fatal error (script misconfiguration)
#
# USAGE:
#   ./tools/marketplace_audit/verify_marketplace_readiness_v2.sh
#
# DESIGN:
#   - Fail-closed: Exit 1 if ANY check fails
#   - Deterministic: Same inputs produce same outputs
#   - No placeholders: All checks are real verifications
#   - No external dependencies: bash, jq, sha256sum only
#

set -euo pipefail

# Color codes for terminal output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Script metadata
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Output directory
OUTPUT_DIR="${REPO_ROOT}/build/marketplace_verification"
mkdir -p "${OUTPUT_DIR}"

REPORT_FILE="${OUTPUT_DIR}/marketplace_readiness_report.json"
SUMMARY_FILE="${OUTPUT_DIR}/marketplace_readiness_summary.txt"

# Verification results (0 = pass, 1 = fail)
MARKETPLACE_AUDIT_RESULT=1
TRUST_CENTER_RESULT=1
SOC2_GENERATOR_RESULT=1
OVERALL_RESULT=1

# Helpers
log_info() {
    echo -e "${BLUE}[INFO]${NC} $*" >&2
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $*" >&2
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $*" >&2
}

log_error() {
    echo -e "${RED}[FAIL]${NC} $*" >&2
}

log_header() {
    echo -e "\n${CYAN}═══════════════════════════════════════════════════════${NC}" >&2
    echo -e "${CYAN}  $*${NC}" >&2
    echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}\n" >&2
}

# Verification functions

run_marketplace_audit() {
    log_header "CHECK 1: Marketplace Audit v2"
    
    local audit_script="${SCRIPT_DIR}/run_marketplace_readiness_v2.sh"
    
    if [[ ! -f "${audit_script}" ]]; then
        log_error "Marketplace audit script not found: ${audit_script}"
        return 1
    fi
    
    if [[ ! -x "${audit_script}" ]]; then
        log_error "Marketplace audit script not executable: ${audit_script}"
        return 1
    fi
    
    log_info "Running marketplace audit..."
    
    # Run audit and capture output
    local audit_output="${OUTPUT_DIR}/marketplace_audit_output.txt"
    local audit_json="${OUTPUT_DIR}/marketplace_audit_report.json"
    
    if bash "${audit_script}" > "${audit_output}" 2>&1; then
        MARKETPLACE_AUDIT_RESULT=0
        log_success "Marketplace audit PASSED"
        
        # Copy audit report if it exists
        if [[ -f "${REPO_ROOT}/build/marketplace_audit/marketplace_readiness_report.json" ]]; then
            cp "${REPO_ROOT}/build/marketplace_audit/marketplace_readiness_report.json" "${audit_json}"
        fi
        
        return 0
    else
        MARKETPLACE_AUDIT_RESULT=1
        log_error "Marketplace audit FAILED"
        log_error "See ${audit_output} for details"
        
        # Show last 20 lines of output
        echo -e "\n${YELLOW}Last 20 lines of audit output:${NC}" >&2
        tail -n 20 "${audit_output}" >&2
        
        return 1
    fi
}

run_trust_center_validator() {
    log_header "CHECK 2: Trust Center Validator"
    
    local validator_script="${REPO_ROOT}/tools/trust_center/verify_trust_center.sh"
    
    if [[ ! -f "${validator_script}" ]]; then
        log_error "Trust center validator not found: ${validator_script}"
        return 1
    fi
    
    if [[ ! -x "${validator_script}" ]]; then
        log_error "Trust center validator not executable: ${validator_script}"
        return 1
    fi
    
    log_info "Running trust center validator..."
    
    # Run validator and capture output
    local validator_output="${OUTPUT_DIR}/trust_center_output.txt"
    local validator_json="${OUTPUT_DIR}/trust_center_report.json"
    
    if bash "${validator_script}" > "${validator_output}" 2>&1; then
        TRUST_CENTER_RESULT=0
        log_success "Trust center validation PASSED"
        
        # Copy validator report if it exists
        if [[ -f "${REPO_ROOT}/build/trust_center/trust_center_report.json" ]]; then
            cp "${REPO_ROOT}/build/trust_center/trust_center_report.json" "${validator_json}"
        fi
        
        return 0
    else
        TRUST_CENTER_RESULT=1
        log_error "Trust center validation FAILED"
        log_error "See ${validator_output} for details"
        
        # Show last 20 lines of output
        echo -e "\n${YELLOW}Last 20 lines of validator output:${NC}" >&2
        tail -n 20 "${validator_output}" >&2
        
        return 1
    fi
}

run_soc2_generator() {
    log_header "CHECK 3: SOC2 Evidence Pack Generator"
    
    local generator_script="${REPO_ROOT}/tools/soc2_mapping/build_soc2_evidence_pack.sh"
    
    if [[ ! -f "${generator_script}" ]]; then
        log_error "SOC2 generator not found: ${generator_script}"
        return 1
    fi
    
    if [[ ! -x "${generator_script}" ]]; then
        log_error "SOC2 generator not executable: ${generator_script}"
        return 1
    fi
    
    log_info "Running SOC2 evidence pack generator..."
    
    # Run generator and capture output
    local generator_output="${OUTPUT_DIR}/soc2_generator_output.txt"
    local evidence_pack="${REPO_ROOT}/build/soc2_evidence/soc2_evidence_pack.tar.gz"
    
    if bash "${generator_script}" > "${generator_output}" 2>&1; then
        SOC2_GENERATOR_RESULT=0
        log_success "SOC2 evidence pack generation PASSED"
        
        # Verify pack was created
        if [[ -f "${evidence_pack}" ]]; then
            local pack_size=$(stat -f%z "${evidence_pack}" 2>/dev/null || stat -c%s "${evidence_pack}" 2>/dev/null || echo "0")
            log_info "Evidence pack size: ${pack_size} bytes"
        else
            log_warn "Evidence pack file not found: ${evidence_pack}"
        fi
        
        return 0
    else
        SOC2_GENERATOR_RESULT=1
        log_error "SOC2 evidence pack generation FAILED"
        log_error "See ${generator_output} for details"
        
        # Show last 20 lines of output
        echo -e "\n${YELLOW}Last 20 lines of generator output:${NC}" >&2
        tail -n 20 "${generator_output}" >&2
        
        return 1
    fi
}

generate_aggregate_report() {
    log_header "GENERATING AGGREGATE REPORT"
    
    # Calculate overall result
    if [[ ${MARKETPLACE_AUDIT_RESULT} -eq 0 ]] && [[ ${TRUST_CENTER_RESULT} -eq 0 ]] && [[ ${SOC2_GENERATOR_RESULT} -eq 0 ]]; then
        OVERALL_RESULT=0
    else
        OVERALL_RESULT=1
    fi
    
    # Generate JSON report
    cat > "${REPORT_FILE}" <<EOF
{
  "verification": {
    "timestamp": "${TIMESTAMP}",
    "repository": "FirstTry---Audit-Evidence-for-Jira",
    "version": "2.0",
    "overall_status": "$(if [[ ${OVERALL_RESULT} -eq 0 ]]; then echo "PASS"; else echo "FAIL"; fi)"
  },
  "checks": {
    "marketplace_audit": {
      "status": "$(if [[ ${MARKETPLACE_AUDIT_RESULT} -eq 0 ]]; then echo "PASS"; else echo "FAIL"; fi)",
      "exit_code": ${MARKETPLACE_AUDIT_RESULT},
      "description": "Manifest verification, external network detection, required docs, evidence harness, trust center"
    },
    "trust_center_validator": {
      "status": "$(if [[ ${TRUST_CENTER_RESULT} -eq 0 ]]; then echo "PASS"; else echo "FAIL"; fi)",
      "exit_code": ${TRUST_CENTER_RESULT},
      "description": "Trust docs, SOC2 mapping, legal docs, support docs all present"
    },
    "soc2_evidence_generator": {
      "status": "$(if [[ ${SOC2_GENERATOR_RESULT} -eq 0 ]]; then echo "PASS"; else echo "FAIL"; fi)",
      "exit_code": ${SOC2_GENERATOR_RESULT},
      "description": "Generates tamper-evident SOC2 evidence pack with SHA256 manifest"
    }
  },
  "summary": {
    "total_checks": 3,
    "passed": $((3 - MARKETPLACE_AUDIT_RESULT - TRUST_CENTER_RESULT - SOC2_GENERATOR_RESULT)),
    "failed": $((MARKETPLACE_AUDIT_RESULT + TRUST_CENTER_RESULT + SOC2_GENERATOR_RESULT))
  },
  "output_directory": "${OUTPUT_DIR}",
  "audit_artifacts": {
    "marketplace_audit_output": "${OUTPUT_DIR}/marketplace_audit_output.txt",
    "trust_center_output": "${OUTPUT_DIR}/trust_center_output.txt",
    "soc2_generator_output": "${OUTPUT_DIR}/soc2_generator_output.txt",
    "aggregate_report": "${REPORT_FILE}",
    "summary": "${SUMMARY_FILE}"
  }
}
EOF
    
    log_success "JSON report written to: ${REPORT_FILE}"
    
    # Generate human-readable summary
    cat > "${SUMMARY_FILE}" <<EOF
═══════════════════════════════════════════════════════
  MARKETPLACE READINESS VERIFICATION REPORT
═══════════════════════════════════════════════════════

Timestamp: ${TIMESTAMP}
Repository: FirstTry---Audit-Evidence-for-Jira
Verification Version: 2.0

───────────────────────────────────────────────────────
CHECK RESULTS
───────────────────────────────────────────────────────

✓ Marketplace Audit v2:      $(if [[ ${MARKETPLACE_AUDIT_RESULT} -eq 0 ]]; then echo "PASS"; else echo "FAIL"; fi)
  - Manifest verification
  - External network detection
  - Required documentation
  - Evidence harness validation
  - Trust center presence

✓ Trust Center Validator:    $(if [[ ${TRUST_CENTER_RESULT} -eq 0 ]]; then echo "PASS"; else echo "FAIL"; fi)
  - Trust documentation (8 files)
  - SOC2 control mapping
  - Legal documents (Privacy, ToS)
  - Support SLA

✓ SOC2 Evidence Generator:   $(if [[ ${SOC2_GENERATOR_RESULT} -eq 0 ]]; then echo "PASS"; else echo "FAIL"; fi)
  - Tamper-evident pack creation
  - SHA256 manifest generation
  - All compliance docs bundled

───────────────────────────────────────────────────────
OVERALL STATUS: $(if [[ ${OVERALL_RESULT} -eq 0 ]]; then echo "✅ PASS — MARKETPLACE READY"; else echo "❌ FAIL — NOT MARKETPLACE READY"; fi)
───────────────────────────────────────────────────────

Summary:
  Total Checks: 3
  Passed: $((3 - MARKETPLACE_AUDIT_RESULT - TRUST_CENTER_RESULT - SOC2_GENERATOR_RESULT))
  Failed: $((MARKETPLACE_AUDIT_RESULT + TRUST_CENTER_RESULT + SOC2_GENERATOR_RESULT))

Output Directory: ${OUTPUT_DIR}

Detailed Output Files:
  - Marketplace Audit: ${OUTPUT_DIR}/marketplace_audit_output.txt
  - Trust Center:      ${OUTPUT_DIR}/trust_center_output.txt
  - SOC2 Generator:    ${OUTPUT_DIR}/soc2_generator_output.txt
  - JSON Report:       ${REPORT_FILE}

═══════════════════════════════════════════════════════
EOF
    
    log_success "Summary written to: ${SUMMARY_FILE}"
    
    # Display summary to console
    cat "${SUMMARY_FILE}" >&2
}

# Main execution
main() {
    log_header "MARKETPLACE READINESS VERIFICATION v2.0"
    
    log_info "Repository root: ${REPO_ROOT}"
    log_info "Output directory: ${OUTPUT_DIR}"
    log_info "Timestamp: ${TIMESTAMP}"
    
    # Run all checks (continue even if some fail to get complete picture)
    run_marketplace_audit || true
    run_trust_center_validator || true
    run_soc2_generator || true
    
    # Generate aggregate report
    generate_aggregate_report
    
    # Final status
    log_header "VERIFICATION COMPLETE"
    
    if [[ ${OVERALL_RESULT} -eq 0 ]]; then
        log_success "✅ ALL CHECKS PASSED — Repository is MARKETPLACE READY"
        log_success "Enterprise buyers can review:"
        log_info "  - Trust Center: docs/trust/TRUST_CENTER.md"
        log_info "  - SOC2 Mapping: docs/trust/soc2/SOC2_CONTROL_MAPPING.md"
        log_info "  - Security Questionnaire: docs/trust/ENTERPRISE_SECURITY_QUESTIONNAIRE.md"
        log_info "  - Evidence Pack: build/soc2_evidence/soc2_evidence_pack.tar.gz"
        exit 0
    else
        log_error "❌ ONE OR MORE CHECKS FAILED — Repository is NOT marketplace ready"
        log_error "Review detailed output files in: ${OUTPUT_DIR}"
        log_error "Fix all issues before submitting to Atlassian Marketplace"
        exit 1
    fi
}

# Run main
main "$@"
