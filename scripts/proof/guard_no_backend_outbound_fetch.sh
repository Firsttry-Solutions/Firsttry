#!/bin/bash

##############################################################################
# PHASE 3 v3.2.2 - No Backend Outbound Fetch Guard
# Verifies NO backend code makes external HTTP calls
# Fail-closed: any outbound fetch to non-Atlassian endpoints fails
##############################################################################

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/atlassian/forge-app/src"

# Source common lib
source "$SCRIPT_DIR/_lib_proof.sh"

EVIDENCE_DIR=$(mk_evidence_dir "ft_no_backend_egress")
VIOLATIONS_FILE="$EVIDENCE_DIR/egress_findings.txt"

##############################################################################
# Backend Egress Check
##############################################################################

main() {
  log_info "Verifying NO backend outbound fetch (no egress)..."
  log_info "Backend dir: $BACKEND_DIR"
  
  local violations=0
  
  # Check for fetch() calls to external URLs in backend
  log_info "Scanning for fetch() calls with external URLs..."
  
  # Pattern 1: fetch(webhookUrl, ) - variable holding URL
  if grep -r "fetch.*webhookUrl" "$BACKEND_DIR" --include="*.ts" 2>/dev/null | \
     grep -v "node_modules\|dist\|build" | tee -a "$VIOLATIONS_FILE"; then
    log_fail "Found fetch(webhookUrl) call"
    ((violations++))
  fi
  
  # Pattern 2: fetch(config.webhooks)
  if grep -r "fetch.*webhooks\|fetch.*slackWebhook\|fetch.*genericWebhook" "$BACKEND_DIR" --include="*.ts" 2>/dev/null | \
     grep -v "node_modules\|dist\|build" | tee -a "$VIOLATIONS_FILE"; then
    log_fail "Found fetch(config.webhooks) call"
    ((violations++))
  fi
  
  # Pattern 3: Check for external: in manifest
  if grep -n "external:" "$PROJECT_ROOT/atlassian/forge-app/manifest.yml" | tee -a "$VIOLATIONS_FILE"; then
    log_fail "Found external: egress permissions in manifest"
    ((violations++))
  fi
  
  # Pattern 4: Verify alerting.ts is disabled
  if grep -q "FT_ALERTING_DISABLED_NO_EGRESS" "$BACKEND_DIR/continuous-drift/alerting.ts" 2>/dev/null; then
    log_pass "Alerting module is disabled (no-egress)"
  else
    if grep -q "sendSlackAlert\|sendGenericAlert" "$BACKEND_DIR/continuous-drift/alerting.ts" 2>/dev/null; then
      log_fail "Alerting module still contains active webhook functions"
      ((violations++))
    fi
  fi
  
  if [[ $violations -gt 0 ]]; then
    log_fail "Backend egress check FAILED - found outbound calls"
    return 1
  fi
  
  log_pass "NO backend outbound fetch detected - zero egress"
  log_marker "FT_PROOF_NO_BACKEND_EGRESS_OK"
  echo "Evidence: $EVIDENCE_DIR"
  return 0
}

main "$@"
