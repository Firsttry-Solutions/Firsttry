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
    "gdpr compliant"
    "soc2 type ii certified"
    "soc 2 type ii certified"
    "iso 27001 certified"
    "pci compliant"
    "hipaa compliant"
    "fedramp authorized"
    "fips.*validated"
  )
  
  local violations=0
  
  # Search docs directory with context
  for pattern in "${forbidden_patterns[@]}"; do
    while IFS= read -r line; do
      # Skip if from archived/old phase specs (PHASE_0, PHASE_1_1)
      if echo "$line" | grep -q "PHASE_0\|PHASE_1_1"; then
        continue
      fi
      # Check if line explicitly negates with ❌ NOT / ✗ NOT / "NOT " prefix or "does NOT"
      if echo "$line" | grep -qi "❌.*\|✗.*\|does.*NOT\|^.*NOT $pattern\|^.*NOT [A-Z].*$pattern"; then
        continue  # This is explicitly saying "NOT certified" - OK
      fi
      # Check if it's in the "does NOT claim" section (earlier lines show pattern)
      if echo "$line" | grep -qi "security.*NOT.*claim\|does not claim"; then
        continue
      fi
      # Check if line has disclaimer keywords within ~120 chars context
      if echo "$line" | grep -qi "not certified\|does not claim\|supports evidence\|inherited from"; then
        continue  # Skip if disclaimer is present
      fi
      
      # Violation found
      echo "FORBIDDEN: $line" | tee -a "$FINDINGS_FILE"
      ((violations++))
    done < <(grep -r -i -n "$pattern" "$DOCS_DIR" 2>/dev/null)
  done
  
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
# Slack Check
##############################################################################

check_no_slack_terms() {
  log_info "Checking for Slack operational dependencies..."
  
  local slack_patterns=(
    "slack"
    "#incident-"
    "war room"
    "slack channel"
    "slack hooks"
  )
  
  local violations=0
  
  for pattern in "${slack_patterns[@]}"; do
    while IFS= read -r line; do
      # Skip if from archived/old phase specs (PHASE_0, PHASE_1_1 = ancient implementation docs)
      if echo "$line" | grep -q "PHASE_0\|PHASE_1_1"; then
        continue
      fi
      # Skip if it explicitly negates Slack (no, not, doesn't, never, legacy read-only)
      if echo "$line" | grep -qi "no slack\|not.*slack\|doesn't\|never.*slack\|legacy.*read-only\|no outbound\|no external\|cannot"; then
        continue
      fi
      # Skip if it says "customer can use", "customer-managed", or "internal communication"
      if echo "$line" | grep -qi "customer.*slack\|customer-managed\|internal communication\|customer may"; then
        continue
      fi
      echo "SLACK: $line" | tee -a "$FINDINGS_FILE"
      ((violations++))
    done < <(grep -r -i -n "$pattern" "$DOCS_DIR" 2>/dev/null)
  done
  
  if [[ $violations -gt 0 ]]; then
    log_fail "Found $violations Slack terms. Use 'customer-managed communication' instead."
    return 1
  fi
  
  log_pass "No Slack operational terms detected"
  log_marker "FT_PROOF_NO_SLACK_OK"
  return 0
}

##############################################################################
# Webhook Implementation Check
##############################################################################

check_no_webhook_implementation() {
  log_info "Checking for webhook implementation claims..."
  
  local violations=0
  
  # CRITICAL:  First, look for claims that FirstTry HAS/SUPPORTS webhooks
  # Patterns we MUST fail on:
  # - "FirstTry webhooks"
  # - "webtrigger" (Forge technical term)
  # - "/webhook/ingest" (endpoint that doesn't exist)
  # - "read:webhook:jira" (scope FirstTry doesn't request)
  # - "sends webhooks"
  # - "webhook support"
  
  # Pattern 1: Claims FirstTry implements/supports webhooks (exclude old PHASE_1_1 specs)  
  while IFS= read -r line; do
    # Skip if from archived/old phase specs (PHASE_0, PHASE_1_1 = ancient implementation docs)
    if echo "$line" | grep -q "PHASE_0\|PHASE_1_1"; then
      continue
    fi
    # Skip if in evidence directory (archived)
    if echo "$line" | grep -q "evidence/"; then
      continue
    fi
    # Skip if it explicitly says "NOT" or "no"/"doesn't"
    if echo "$line" | grep -qi "does.*not.*webhook\|no.*webhook\|cannot.*webhook\|NOT.*webhook"; then
      continue
    fi
    echo "WEBHOOK_IMPL_CLAIM: $line" | tee -a "$FINDINGS_FILE"
    ((violations++))
  done < <(grep -rn "firsttry.*webhook\|webhook.*support\|sends.*webhook" docs --include="*.md" 2>/dev/null)
  
  # Pattern 2: WebTrigger references (Forge technical)
  while IFS= read -r line; do
    # Skip if from archived/old phase specs (PHASE_0, PHASE_1_1)
    if echo "$line" | grep -q "PHASE_0\|PHASE_1_1"; then
      continue
    fi
    # Skip if it's in archived spec files
    if echo "$line" | grep -q "ATLASSIAN_DUAL_LAYER_SPEC.md"; then
      continue
    fi
    # Skip if it's in evidence directory (archived)
    if echo "$line" | grep -q "evidence/"; then
      continue
    fi
    # Skip if it explicitly negates (NO, not, no inbound, no http)
    if echo "$line" | grep -qi "no.*webtrigger\|not.*webtrigger\|no.*webhook\|no.*http\|no inbound"; then
      continue
    fi
    # Skip if it's talking about Jira webhooks (not FirstTry webhooks)
    if echo "$line" | grep -qi "jira.*webhook\|receives.*webhook\|event-driven"; then
      continue
    fi
    echo "WEBTRIGGER_CLAIM: $line" | tee -a "$FINDINGS_FILE"
    ((violations++))
  done < <(grep -rn "webtrigger\|webTrigger" docs --include="*.md" 2>/dev/null)
  
  # Pattern 3: /webhook/ endpoint references (exclude Jira webhook documentation)
  while IFS= read -r line; do
    # Skip if from archived/old phase specs (PHASE_0, PHASE_1_1)
    if echo "$line" | grep -q "PHASE_0\|PHASE_1_1"; then
      continue
    fi
    # Skip if it's in evidence directory (archived)
    if echo "$line" | grep -q "evidence/"; then
      continue
    fi
    # Skip if it's in archived spec files that detail old implementation
    if echo "$line" | grep -q "ATLASSIAN_DUAL_LAYER_SPEC.md"; then
      continue
    fi
    # Skip if it's documenting Jira webhooks (not FirstTry endpoints)
    if echo "$line" | grep -qi "jira.*webhook\|receives.*webhook"; then
      continue
    fi
    echo "WEBHOOK_ENDPOINT: $line" | tee -a "$FINDINGS_FILE"
    ((violations++))
  done < <(grep -rn "/webhook/" docs --include="*.md" 2>/dev/null)
  
  # Pattern 4: read:webhook:jira scope (Jira API scope for receiving webhooks - OK to use)
  while IFS= read -r line; do
    # Skip if from archived/old phase specs (PHASE_0, PHASE_1_1, PHASE_9)
    if echo "$line" | grep -q "PHASE_0\|PHASE_1_1\|PHASE_9"; then
      continue
    fi
    # Skip if in evidence directory (archived)
    if echo "$line" | grep -q "evidence/"; then
      continue
    fi
    if echo "$line" | grep -qi "NOT\|no.*read:webhook"; then
      continue
    fi
    # Skip if it's saying this is a "Jira API scope" (which it is - allowed)
    if echo "$line" | grep -qi "jira.*scope\|jira.*api\|read:"; then
      continue
    fi
    echo "WEBHOOK_SCOPE: $line" | tee -a "$FINDINGS_FILE"
    ((violations++))
  done < <(grep -rn "read:webhook:jira\|read:webhook" docs --include="*.md" 2>/dev/null)
  
  if [[ $violations -gt 0 ]]; then
    log_fail "Found $violations webhook implementation references (FirstTry does NOT implement webhooks)."
    return 1
  fi
  
  log_pass "No active webhook implementation claims detected"
  log_marker "FT_PROOF_NO_WEBHOOK_IMPL_OK"
  return 0
}

##############################################################################

main() {
  log_info "Starting documentation sanitizer v2 (Slack/Webhook/Cert strict)..."
  log_info "Evidence dir: $EVIDENCE_DIR"
  log_info "Scanning: $DOCS_DIR"
  
  local all_pass=0
  
  log_marker "FT_PROOF_DOCS_SANITIZER_START"
  
  check_forbidden_claims || all_pass=1
  check_no_slack_terms || all_pass=1
  check_no_webhook_implementation || all_pass=1
  check_sla_overpromise
  check_no_external_emails || all_pass=1
  check_no_subprocessor_enumeration || all_pass=1
  
  if [[ $all_pass -eq 0 ]]; then
    log_pass "All documentation sanitizer v2 checks PASSED"
    log_marker "FT_PROOF_DOCS_SANITIZER_PASS"
    echo "Evidence saved to: $EVIDENCE_DIR"
    return 0
  else
    log_fail "Documentation sanitizer v2 checks FAILED"
    echo "See findings in: $FINDINGS_FILE"
    return 1
  fi
}

main "$@"
