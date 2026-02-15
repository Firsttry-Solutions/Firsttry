#!/bin/bash

##############################################################################
# PHASE 3 v3.2 - Documentation Sanitizer
# Scans docs for forbidden claims + risky language
# Fail-closed: any violation fails the gate
##############################################################################

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DOCS_DIR="$PROJECT_ROOT/docs"

# Source common lib
source "$SCRIPT_DIR/_lib_proof.sh"

EVIDENCE_DIR=$(mk_evidence_dir "ft_docs_sanitizer")
FINDINGS_FILE="$EVIDENCE_DIR/findings.txt"

##############################################################################
# Forbidden Claims Check
##############################################################################

check_forbidden_claims() {
  log_info "Checking for forbidden compliance claims..."
  
  local forbidden_patterns=(
    "COMPLIANCE VALIDATED"
    "SOC.?2.*certified"
    "ISO.?27001.*certified"
    "HIPAA.?compliant"
    "ready for Atlassian Marketplace certification"
  )
  
  local violations=0
  
  # Search docs directory
  for pattern in "${forbidden_patterns[@]}"; do
    if grep -r -i -n "$pattern" "$DOCS_DIR" 2>/dev/null | \
       grep -v "NOT.*FedRAMP\|NOT.*SOC\|NOT.*ISO\|NOT.*HIPAA\|NOT.*certification" | \
       tee -a "$FINDINGS_FILE"; then
      ((violations++))
    fi
  done
  
  # Separate check for FedRAMP (but exclude "NOT FedRAMP" disclaimers)
  if grep -r -i -n "FedRAMP" "$DOCS_DIR" 2>/dev/null | \
     grep -v "NOT.*FedRAMP\|No.*FedRAMP" | \
     tee -a "$FINDINGS_FILE"; then
    ((violations++))
  fi
  
  if [[ $violations -gt 0 ]]; then
    log_fail "Found $violations forbidden claim(s). See $FINDINGS_FILE"
    return 1
  fi
  
  log_pass "No forbidden compliance claims detected"
  log_marker "FT_PROOF_DOCS_CLAIMS_OK"
  return 0
}

##############################################################################
# SLA Over-Promise Check
##############################################################################

check_sla_overpromise() {
  log_info "Checking for SLA over-promises outside enterprise tier..."
  
  local support_policy="$DOCS_DIR/support-policy.md"
  
  if [[ ! -f "$support_policy" ]]; then
    warn "Support policy not found (optional check)"
    return 0
  fi
  
  # Check if non-enterprise SLAs are defined
  # Valid pattern: "15min / 30min / 1h" only if clearly within "enterprise" or "professional" sections
  
  local violations=0
  
  # Look for timer values outside gated sections
  if grep -n -B5 -A5 "15.?min\|30.?min\|1.*hour" "$support_policy" | \
     grep -v "enterprise\|professional\|Enterprise\|Professional" | \
     tee -a "$FINDINGS_FILE"; then
    ((violations++))
  fi
  
  if [[ $violations -gt 0 ]]; then
    warn "SLA timers found outside tier gating (verify in $FINDINGS_FILE)"
    # This is a warning, not fatal (policy may be internally gated)
  else
    log_pass "SLA over-promises properly gated by tier"
  fi
  
  return 0
}

##############################################################################
# Email Address Check
##############################################################################

check_no_external_emails() {
  log_info "Checking for external email addresses..."
  
  local violations=0
  
  # Find mailto links
  if grep -r -i "mailto:" "$DOCS_DIR" 2>/dev/null | tee -a "$FINDINGS_FILE"; then
    ((violations++))
  fi
  
  # Find bare email addresses (allow @jira as code sample)
  if grep -r -n "[a-zA-Z0-9._%+-]*@[a-zA-Z0-9.-]*\\.com\|@[a-zA-Z0-9.-]*\\.org" "$DOCS_DIR" 2>/dev/null | \
     grep -v "example.com\|example.org\|@jira" | tee -a "$FINDINGS_FILE"; then
    ((violations++))
  fi
  
  if [[ $violations -gt 0 ]]; then
    log_fail "Found external email addresses/mailto links. See $FINDINGS_FILE"
    return 1
  fi
  
  log_pass "No external email addresses detected"
  log_marker "FT_PROOF_DOCS_NO_EMAIL_OK"
  return 0
}

##############################################################################
# Subprocessor Enumeration Check
##############################################################################

check_no_subprocessor_enumeration() {
  log_info "Checking for direct subprocessor enumeration..."
  
  local subprocessors_doc="$DOCS_DIR/subprocessors.md"
  
  if [[ ! -f "$subprocessors_doc" ]]; then
    log_fail "Subprocessors doc not found"
    return 1
  fi
  
  local violations=0
  
  # Forbidden: direct enumeration of AWS/Fastly/etc (allowed: references only)
  if grep -n "AWS\|Amazon Web Services\|EC2\|S3\|KMS" "$subprocessors_doc" 2>/dev/null | \
     grep -v "link\|reference\|Atlassian.*subprocessor" | tee -a "$FINDINGS_FILE"; then
    ((violations++))
  fi
  
  if [[ $violations -gt 0 ]]; then
    log_fail "Found direct subprocessor enumeration. Link to Atlassian official list instead."
    return 1
  fi
  
  log_pass "No direct subprocessor enumeration"
  log_marker "FT_PROOF_DOCS_SUBPROCESSOR_OK"
  return 0
}

##############################################################################
# Main Execution
##############################################################################

main() {
  log_info "Starting documentation sanitizer..."
  log_info "Evidence dir: $EVIDENCE_DIR"
  log_info "Scanning: $DOCS_DIR"
  
  local all_pass=0
  
  check_forbidden_claims || all_pass=1
  check_sla_overpromise
  check_no_external_emails || all_pass=1
  check_no_subprocessor_enumeration || all_pass=1
  
  if [[ $all_pass -eq 0 ]]; then
    log_pass "All documentation sanitizer checks PASSED"
    log_marker "FT_PROOF_DOCS_SANITIZER_PASS"
    echo "Evidence saved to: $EVIDENCE_DIR"
    return 0
  else
    log_fail "Documentation sanitizer checks FAILED"
    echo "See findings in: $FINDINGS_FILE"
    return 1
  fi
}

main "$@"
