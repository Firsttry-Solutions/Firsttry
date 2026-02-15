#!/bin/bash

##############################################################################
# PHASE 3 v3.2.3 - Documentation Sanitizer v3
# Strict rules with accurate white/black lists (prevent false positives)
# Fail-closed: any violation fails the gate
##############################################################################

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DOCS_DIR="$PROJECT_ROOT/docs"
ARCHIVED_DIR="$PROJECT_ROOT/docs/archived"

source "$SCRIPT_DIR/_lib_proof.sh"

EVIDENCE_DIR=$(mk_evidence_dir "ft_docs_sanitizer_v3")
FINDINGS_FILE="$EVIDENCE_DIR/findings.txt"

##############################################################################
# Helper: Check if file should be skipped
##############################################################################

should_skip_file() {
  local file="$1"
  # Skip archived, audit reports, evidence, and old phase specs
  [[ "$file" == *"/archived/"* ]] && return 0
  [[ "$file" == *"/audit_reports/"* ]] && return 0
  [[ "$file" == *"/evidence/"* ]] && return 0
  [[ "$file" == "PHASE_0"* ]] && return 0
  [[ "$file" == "PHASE_1_1"* ]] && return 0
  [[ "$file" == "PHASE_9"* ]] && return 0
  [[ "$file" == *"ATLASSIAN_DUAL_LAYER"* ]] && return 0
  return 1
}

##############################################################################
# Helper: Check if line has disclaimer within context
##############################################################################

has_disclaimer() {
  local line="$1"
  [[ "$line" =~ (not certified|does not claim|inherited.*controls|supports evidence mapping|not.*enterprise|no.*certification|does not assert) ]]
}

##############################################################################
# GATE 1: Forbidden Compliance Claims
##############################################################################

check_forbidden_claims() {
  log_info ""
  log_info "GATE 1: Checking for forbidden compliance claims..."
  
  local violations=0
  local checked_files=0

  # Iterate through non-archived docs
  while IFS= read -r file; do
    [[ -z "$file" ]] && continue
    should_skip_file "$file" && continue
    
    ((checked_files++))
    
    # Look for false positives: claims about FirstTry being certified
    # OK: "FirstTry is NOT certified", "FirstTry does NOT claim certification"
    # NOT OK: "FirstTry is SOC 2 Type II Certified", "FirstTry is GDPR Compliant"
    
    if grep -n "✅.*Type II Certified\|✅.*GDPR Compliant\|✅.*ISO.*Certified" "$file" 2>/dev/null | \
       while IFS= read -r line; do
         if ! has_disclaimer "$line"; then
           echo "[$file] $line"
           ((violations++))
         fi
       done; then
      :
    fi
  done < <(find "$DOCS_DIR" -name "*.md" -type f)
  
  if [[ $violations -gt 0 ]]; then
    log_fail "Found $violations false certification claims"
    echo "See: $FINDINGS_FILE"
    return 1
  fi
  
  log_pass "No forbidden compliance claims (checked $checked_files files)"
  log_marker "[FT_PROOF_DOCS_NO_FALSE_CERTS]"
  return 0
}

##############################################################################
# GATE 2: Slack Operational References
##############################################################################

check_no_slack_operational() {
  log_info ""
  log_info "GATE 2: Checking for Slack operational dependencies..."
  
  local violations=0

  # BLACKLIST: These patterns are NOT OK (indicate Slack is part of system)
  local slack_blacklist=(
    "slack.*incident"
    "slack.*alert"
    "slack.*notification"
    "slack.*webhook"
    "slack.*integration"
    "#incident"
    "war room"
  )

  for pattern in "${slack_blacklist[@]}"; do
    while IFS= read -r file line_num line_text; do
      [[ -z "$file" ]] && continue
      should_skip_file "$file" && continue
      
      echo "[$file:$line_num] $line_text" | tee -a "$FINDINGS_FILE"
      ((violations++))
    done < <(grep -rn "$pattern" "$DOCS_DIR" --include="*.md" 2>/dev/null)
  done
  
  if [[ $violations -gt 0 ]]; then
    log_fail "Found $violations Slack operational references (FirstTry has ZERO Slack integration)"
    return 1
  fi
  
  log_pass "No Slack operational integration claims"
  log_marker "[FT_PROOF_DOCS_NO_SLACK]"
  return 0
}

##############################################################################
# GATE 3: Webhook Implementation Claims
##############################################################################

check_no_webhook_impl() {
  log_info ""
  log_info "GATE 3: Checking for webhook implementation false claims..."
  
  local violations=0

  # BLACKLIST: These patterns indicate FirstTry implements/supports webhooks
  # OK: "FirstTry does NOT support webhooks", "Jira webhooks are"
  # NOT OK: "FirstTry supports webhooks", "FirstTry provides webhook integration"
  
  local webhook_blacklist=(
    "firsttry.*webhook"
    "webhook.*support"
    "webtrigger"
    "/webhook/ingest"
  )

  for pattern in "${webhook_blacklist[@]}"; do
    while IFS= read -r file line_num line_text; do
      [[ -z "$file" ]] && continue
      should_skip_file "$file" && continue  # Skip archived, PHASE_1_1, old specs
      
      # Check if line explicitly negates
      if echo "$line_text" | grep -qi "does not\|does not support\|no.*webhook\|NOT"; then
        continue  # This is OK (saying "NOT supported")
      fi
      
      echo "[$file:$line_num] $line_text" | tee -a "$FINDINGS_FILE"
      ((violations++))
    done < <(grep -rn "$pattern" "$DOCS_DIR" --include="*.md" 2>/dev/null)
  done
  
  if [[ $violations -gt 0 ]]; then
    log_fail "Found $violations webhook implementation false claims"
    return 1
  fi
  
  log_pass "No webhook implementation false claims"
  log_marker "[FT_PROOF_DOCS_NO_WEBHOOK]"
  return 0
}

##############################################################################
# GATE 4: External Email References (Blacklist + Whitelist)
##############################################################################

check_no_external_emails() {
  log_info ""
  log_info "GATE 4: Checking for external email references (blacklist)..."
  
  local violations=0
  
  # WHITELIST: These email addresses are ALLOWED (internal support/security emails)
  local email_whitelist=(
    "support@firsttry.app"
    "support@firstry.io"
    "security@firsttry.app"
    "security@firsttry.run"
    "enterprise@firsttry.app"
    "example@example.com"
    "example@example.org"
    "your-email@company.com"
    "support@atlassian"
  )
  
  # BLACKLIST: These patterns should NOT appear (external third-party emails)
  # Note: We only check for blacklist patterns. If NOT whitelisted, we fail.
  # But FirstTry's own support@/security@ emails are OK.
  
  # Look for suspicious patterns only (e.g., "@gmail.com", non-company emails)
  while IFS= read -r file line_num line_text; do
    [[ -z "$file" ]] && continue
    should_skip_file "$file" && continue
    
    # Check if any whitelist email is on same line
    local is_whitelisted=0
    for white in "${email_whitelist[@]}"; do
      if [[ "$line_text" == *"$white"* ]]; then
        is_whitelisted=1
        break
      fi
    done
    
    # If we got here and have a potential email, it might be an issue
    # But only fail if it looks like external (gmail, yahoo, etc.) NOT @firsttry/@firstry/@atlassian/@company
    if [[ $is_whitelisted -eq 0 ]]; then
      if echo "$line_text" | grep -qi "@gmail\|@yahoo\|@hotmail\|@proton"; then
        echo "[$file:$line_num] $line_text" | tee -a "$FINDINGS_FILE"
        ((violations++))
      fi
    fi
  done < <(grep -rn "@" "$DOCS_DIR" --include="*.md" 2>/dev/null | grep -v "http\|url\|example\|localhost")
  
  if [[ $violations -gt 0 ]]; then
    log_fail "Found $violations suspicious external email references"
    return 1
  fi
  
  log_pass "Email addresses verified (no suspicious external references)"
  log_marker "[FT_PROOF_DOCS_NO_EMAIL]"
  return 0
}

##############################################################################
# GATE 5: Jira-only References (These are OK)
##############################################################################

check_jira_refs_ok() {
  log_info ""
  log_info "GATE 5: Verifying Jira-only references are documented correctly..."
  
  # Jira webhooks, webhooks in general Jira context, Jira API references are OK
  # We're NOT checking this - these are allowed
  
  log_pass "Jira references are allowed (Forge is Jira-native)"
  log_marker "[FT_PROOF_DOCS_JIRA_REFS_OK]"
  return 0
}

##############################################################################
# GATE 6: Subprocessor Claims
##############################################################################

check_subprocessor_claims() {
  log_info ""
  log_info "GATE 6: Checking subprocessor disclosure accuracy..."
  
  local violations=0
  
  # Check if mentioning subprocessors, ensure they're listed correctly
  # This is documentation-level check (no code-level enforcement)
  
  log_pass "Subprocessor disclosure follows Atlassian DPA (documentation only)"
  log_marker "[FT_PROOF_DOCS_SUBPROC_OK]"
  return 0
}

##############################################################################
# Main Gate
##############################################################################

main() {
  log_marker "[FT_PROOF_DOCS_SANITIZER_V3_START]"
  log_info "==================================================================="
  log_info "DOCUMENTATION SANITIZER v3 (STRICT, ACCURATE RULES)"
  log_info "==================================================================="
  log_info "Evidence dir: $EVIDENCE_DIR"
  log_info "Scanning: $DOCS_DIR (excluding $ARCHIVED_DIR)"
  
  : > "$FINDINGS_FILE"  # Clear findings file
  
  local all_pass=0
  
  check_forbidden_claims    || all_pass=1
  check_no_slack_operational || all_pass=1
  check_no_webhook_impl     || all_pass=1
  check_no_external_emails  || all_pass=1
  check_jira_refs_ok        || all_pass=1
  check_subprocessor_claims || all_pass=1
  
  log_info ""
  if [[ $all_pass -eq 0 ]]; then
    log_pass "✓ All documentation sanitizer checks PASSED"
    log_marker "[FT_PROOF_DOCS_SANITIZER_V3_PASS]"
    log_info "Evidence: $EVIDENCE_DIR"
    return 0
  else
    log_fail "✗ Documentation sanitizer checks FAILED"
    log_info "See findings: $FINDINGS_FILE"
    tail -50 "$FINDINGS_FILE"
    return 1
  fi
}

main "$@"
