#!/bin/bash

##############################################################################
# PHASE 3 v3.2 - No-Egress Guard
# Verifies manifest.yml has NO external fetch/egress permissions
# Fail-closed: any external: section fails the gate
##############################################################################

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
MANIFEST="$PROJECT_ROOT/atlassian/forge-app/manifest.yml"

# Source common lib
source "$SCRIPT_DIR/_lib_proof.sh"

EVIDENCE_DIR=$(mk_evidence_dir "ft_no_egress_guard")
VIOLATIONS_FILE="$EVIDENCE_DIR/egress_findings.txt"

##############################################################################
# No-Egress Verification
##############################################################################

main() {
  log_info "Verifying no-egress policy (manifest.yml)..."
  log_info "Manifest: $MANIFEST"
  
  if [[ ! -f "$MANIFEST" ]]; then
    die "Manifest not found: $MANIFEST"
  fi
  
  # Check for external: section with fetch rules
  log_info "Scanning for external fetch/egress rules..."
  
  local violations=0
  
  # Pattern 1: external: with fetch: backend:
  if grep -n -A10 "external:" "$MANIFEST" | grep -i "fetch:\|backend:\|address:" | tee "$VIOLATIONS_FILE"; then
    log_fail "Found external fetch declaration"
    ((violations++))
  fi
  
  # Pattern 2: Direct fetch URLs
  if grep -n "https://\|http://" "$MANIFEST" | grep -v "favicon\|example\|#" | tee -a "$VIOLATIONS_FILE"; then
    log_fail "Found external URL in manifest"
    ((violations++))
  fi
  
  if [[ $violations -gt 0 ]]; then
    log_fail "No-egress policy VIOLATED. See $VIOLATIONS_FILE"
    die "Remove external: fetch sections from manifest"
  fi
  
  log_pass "No-egress policy validated (zero external permissions)"
  log_marker "FT_PROOF_NO_EGRESS_OK"
  echo "Evidence: $EVIDENCE_DIR"
  return 0
}

main "$@"
