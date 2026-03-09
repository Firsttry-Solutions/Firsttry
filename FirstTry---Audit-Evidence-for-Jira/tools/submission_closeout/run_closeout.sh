#!/bin/bash
# run_closeout.sh - Vendor tree submission closeout harness (9 phases)
# Deterministic proof generation for Atlassian Marketplace submission
# STRICT: Runs ONLY inside FirstTry---Audit-Evidence-for-Jira/

set -euo pipefail

# Source shared library
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
source "$SCRIPT_DIR/lib.sh"

# ============================================================================
# INITIALIZE
# ============================================================================

ensure_vendor_root

CLOSEOUT_STAMP="$(utc_stamp)"
EVIDENCE_DIR="$VENDOR_ROOT/audit_artifacts/submission_closeout_${CLOSEOUT_STAMP}"

mkdir -p "$EVIDENCE_DIR"
log_section "SUBMISSION CLOSEOUT HARNESS - $CLOSEOUT_STAMP"
log_info "Evidence output: $EVIDENCE_DIR"

# State variables collected during phases
PAGES_LIVE=""
FREEZE_EXIT=1
GATE_EXIT=1
PLAYWRIGHT_EXIT=1
CLEANLINESS_VERDICT="UNKNOWN"
ORIGIN_PARITY="UNKNOWN"

# ============================================================================
# PHASE 1: CLEANLINESS PRECHECK
# ============================================================================

phase_1_cleanliness() {
  log_section "PHASE 1: CLEANLINESS PRECHECK"
  
  cd "$VENDOR_ROOT"
  
  # Check git status
  local git_status="$(git_status_short)"
  local git_diff="$(git_diff_stat)"
  local git_untracked="$(git_untracked)"
  
  # Write raw outputs
  write_file "$EVIDENCE_DIR/01_git_status.txt" "${git_status:-CLEAN}"
  write_file "$EVIDENCE_DIR/02_git_diff_stat.txt" "${git_diff:-NO DIFF}"
  write_file "$EVIDENCE_DIR/03_untracked_files.txt" "${git_untracked:-NO UNTRACKED}"
  
  # Check for tracked file modifications
  if [ -n "$git_status" ]; then
    local tracked_modified=$(echo "$git_status" | grep -v "^?" | wc -l)
    if [ "$tracked_modified" -gt 0 ]; then
      log_error "Phase 1 FAIL: Modified tracked files detected"
      write_file "$EVIDENCE_DIR/04_cleanliness_verdict.txt" "FAIL: Modified tracked files in vendor tree"
      CLEANLINESS_VERDICT="FAIL"
      return 1
    fi
  fi
  
  # Allowlist for untracked files
  local allowlist_regex="(FINAL_SUBMISSION_PROOF_SUMMARY\.md|audit_artifacts/|tools/submission_closeout/.*\.sh|tools/submission_closeout/README\.md)"
  
  # Check for unexpected untracked files
  if [ -n "$git_untracked" ]; then
    local unexpected=""
    while IFS= read -r line; do
      if ! echo "$line" | grep -qE "^$allowlist_regex" 2>/dev/null; then
        unexpected+="$line"$'\n'
      fi
    done <<< "$git_untracked"
    
    if [ -n "$unexpected" ]; then
      log_warn "Phase 1 WARN: Unexpected untracked files found"
      echo "$unexpected" >&2
      write_file "$EVIDENCE_DIR/04_cleanliness_verdict.txt" "WARN: Unexpected untracked files (see 03_untracked_files.txt)"
      CLEANLINESS_VERDICT="WARN"
      return 0
    fi
  fi
  
  log_info "Phase 1 PASS: Vendor tree clean"
  write_file "$EVIDENCE_DIR/04_cleanliness_verdict.txt" "PASS: Vendor tree clean"
  CLEANLINESS_VERDICT="PASS"
  return 0
}

# ============================================================================
# PHASE 2: LIVE PAGES ROUTE DISCOVERY
# ============================================================================

phase_2_pages_discovery() {
  log_section "PHASE 2: PAGES ROUTE DISCOVERY"
  
  local BASE="https://firsttry-solutions.github.io/Firsttry"
  
  # Required docs to verify
  local -a REQUIRED_DOCS=(
    "docs/legal/PRIVACY_POLICY.md"
    "docs/legal/TERMS_OF_SERVICE.md"
    "docs/trust/TRUST_CENTER.md"
    "docs/trust/security_whitepaper.md"
    "docs/trust/incident_response.md"
    "docs/trust/responsible_disclosure.md"
    "docs/trust/subprocessors.md"
    "docs/support/SUPPORT_SLA.md"
    "docs/marketplace/MARKETPLACE_REVIEWER_FAQ.md"
    "docs/marketplace/MARKETPLACE_SCOPE_JUSTIFICATION.md"
    "docs/marketplace/MARKETPLACE_DATA_RETENTION_DELETION.md"
  )
  
  # Fetch root page
  log_info "Fetching live root: $BASE/"
  local root_headers="$(curl_headers "$BASE/" 2>/dev/null || echo "ERROR: Could not reach root")"
  write_file "$EVIDENCE_DIR/10_pages_root_headers.txt" "$root_headers"
  
  log_info "Downloading root HTML"
  local root_html="$(curl_get "$BASE/" 2>/dev/null || echo "")"
  write_file "$EVIDENCE_DIR/11_pages_root.html" "$root_html"
  
  # Extract hrefs from root HTML
  log_info "Extracting hrefs from root HTML"
  local hrefs=""
  if [ -n "$root_html" ]; then
    hrefs=$(echo "$root_html" | grep -oP 'href=["'"'"']\K[^"'"'"']+' 2>/dev/null | sort -u || echo "")
  fi
  write_file "$EVIDENCE_DIR/12_pages_extracted_hrefs.txt" "$hrefs"
  
  # Discover live routes
  log_info "Discovering live routes..."
  
  {
    echo "source_file	discovered_route	http_code	discovery_method	status"
    
    local docs_found=0
    
    for doc_src in "${REQUIRED_DOCS[@]}"; do
      local doc_path="${doc_src#docs/}"
      local doc_name="${doc_path%.*}"
      
      local found="NO"
      local discovered_route=""
      local discovered_code="000"
      local discovery_method="none"
      
      # Try extensionless: legal/privacy_policy
      discovered_route="$BASE/$doc_name"
      discovered_code="$(curl_http_code "$discovered_route" 2>/dev/null || echo "000")"
      if [ "$discovered_code" = "200" ] || [ "$discovered_code" = "301" ]; then
        found="YES"
        discovery_method="extensionless"
      fi
      
      # Try with .md if first failed
      if [ "$found" = "NO" ]; then
        discovered_route="$BASE/$doc_path"
        discovered_code="$(curl_http_code "$discovered_route" 2>/dev/null || echo "000")"
        if [ "$discovered_code" = "200" ] || [ "$discovered_code" = "301" ]; then
          found="YES"
          discovery_method="raw_md"
        fi
      fi
      
      # Try with .html if still not found
      if [ "$found" = "NO" ]; then
        discovered_route="$BASE/${doc_name}.html"
        discovered_code="$(curl_http_code "$discovered_route" 2>/dev/null || echo "000")"
        if [ "$discovered_code" = "200" ] || [ "$discovered_code" = "301" ]; then
          found="YES"
          discovery_method="html_extension"
        fi
      fi
      
      if [ "$found" = "YES" ]; then
        docs_found=$((docs_found + 1))
        local status="PASS"
      else
        local status="FAIL (HTTP $discovered_code)"
        discovered_route="NOT_FOUND"
      fi
      
      echo "$doc_src	$discovered_route	$discovered_code	$discovery_method	$status"
    done
    
    echo ""
    echo "# Summary: $docs_found / ${#REQUIRED_DOCS[@]} docs reachable live"
  } | tee "$EVIDENCE_DIR/13_pages_route_discovery.tsv"
  
  # Count success
  local docs_found=$(grep -c "PASS" "$EVIDENCE_DIR/13_pages_route_discovery.tsv" 2>/dev/null || echo "0")
  
  if [ "$docs_found" = "${#REQUIRED_DOCS[@]}" ]; then
    PAGES_LIVE="PAGES_LIVE_COMPLETE"
  else
    PAGES_LIVE="PAGES_ROOT_ONLY_NOT_DOCS_COMPLETE"
  fi
  
  {
    echo "PAGES ROUTE DISCOVERY SUMMARY"
    echo "=============================================================================="
    echo "Base URL: $BASE"
    echo "Required docs live: $docs_found / ${#REQUIRED_DOCS[@]}"
    echo ""
    if [ "$PAGES_LIVE" = "PAGES_LIVE_COMPLETE" ]; then
      echo "Status: ALL REQUIRED DOCS REACHABLE"
      echo "Verdict: $PAGES_LIVE"
    else
      echo "Status: INCOMPLETE - Some docs not live"
      echo "Verdict: $PAGES_LIVE"
    fi
  } | tee "$EVIDENCE_DIR/14_pages_required_docs_live_check.txt"
  
  log_info "Phase 2 complete: $PAGES_LIVE"
}

# ============================================================================
# PHASE 3: PAGES VERDICT
# ============================================================================

phase_3_pages_verdict() {
  log_section "PHASE 3: PAGES VERDICT"
  
  if [ -z "$PAGES_LIVE" ]; then
    log_error "Page discovery did not complete"
    return 1
  fi
  
  {
    echo "PAGES VERDICT: $PAGES_LIVE"
    echo "=============================================================================="
  } | tee "$EVIDENCE_DIR/15_pages_verdict.txt"
  
  log_info "Phase 3: $PAGES_LIVE"
}

# ============================================================================
# PHASE 4: FREEZE & GATE
# ============================================================================

phase_4_gates() {
  log_section "PHASE 4: FREEZE LOCK & REVIEWER GATE"
  
  cd "$VENDOR_ROOT"
  
  log_info "Running freeze lock verify..."
  if bash audit/verify_freeze_lock.sh > "$EVIDENCE_DIR/20_freeze_verify.txt" 2>&1; then
    FREEZE_EXIT=0
    log_info "Freeze: PASS"
  else
    FREEZE_EXIT=1
    log_error "Freeze: FAIL"
  fi
  
  log_info "Running reviewer gate..."
  if bash audit/reviewer_ready_gate.sh > "$EVIDENCE_DIR/21_reviewer_gate.txt" 2>&1; then
    GATE_EXIT=0
    log_info "Gate: PASS"
  else
    GATE_EXIT=1
    log_error "Gate: FAIL"
  fi
  
  {
    echo "GATE SUMMARY"
    echo "=============================================================================="
    echo "Freeze lock: $([ "$FREEZE_EXIT" = "0" ] && echo "PASS" || echo "FAIL")"
    echo "Reviewer gate: $([ "$GATE_EXIT" = "0" ] && echo "PASS" || echo "FAIL")"
  } | tee "$EVIDENCE_DIR/22_gate_summary.txt"
}

# ============================================================================
# PHASE 5: FORGE INSTALL
# ============================================================================

phase_5_forge_install() {
  log_section "PHASE 5: FORGE INSTALL STATE"
  
  cd "$VENDOR_ROOT"
  
  if command -v forge &> /dev/null; then
    log_info "Querying forge install list..."
    forge install list > "$EVIDENCE_DIR/30_forge_install_list.txt" 2>&1 || true
  else
    log_warn "Forge CLI not available"
    echo "Forge CLI not installed" > "$EVIDENCE_DIR/30_forge_install_list.txt"
  fi
  
  cat "$EVIDENCE_DIR/30_forge_install_list.txt" | head -20 | tee "$EVIDENCE_DIR/31_install_summary.txt"
}

# ============================================================================
# PHASE 6: PLAYWRIGHT
# ============================================================================

phase_6_playwright() {
  log_section "PHASE 6: REVIEWER PLAYWRIGHT"
  
  cd "$VENDOR_ROOT"
  
  # Check auth state
  if [ ! -f "tests/playwright/.auth/storageState.json" ]; then
    log_error "Auth state missing: cannot run playwright"
    PLAYWRIGHT_EXIT=1
    echo "PLAYWRIGHT BLOCKED: storageState.json missing" > "$EVIDENCE_DIR/41_playwright_summary.txt"
    return 1
  fi
  
  mkdir -p "$EVIDENCE_DIR/40_playwright"
  
  export FT_REVIEWER_EVIDENCE_DIR="$EVIDENCE_DIR/40_playwright"
  export JIRA_BASE_URL="https://firsttry-solutions.atlassian.net"
  export JIRA_DASHBOARD_URL="https://firsttry-solutions.atlassian.net/jira/dashboards/10001"
  export FORGE_EMAIL="contact@firsttry.run"
  
  log_info "Running Playwright E2E..."
  
  if npx playwright test "tests/playwright/reviewer_dashboard_e2e.spec.ts" \
    --config=playwright.reviewer.config.ts \
    > "$EVIDENCE_DIR/40_playwright/stdout.txt" 2> "$EVIDENCE_DIR/40_playwright/stderr.txt"; then
    PLAYWRIGHT_EXIT=0
    log_info "Playwright: PASS"
  else
    PLAYWRIGHT_EXIT=1
    log_warn "Playwright: FAIL (see logs)"
  fi
  
  {
    echo "PLAYWRIGHT RESULT: $([ "$PLAYWRIGHT_EXIT" = "0" ] && echo "PASS" || echo "FAIL")"
    [ -f "$EVIDENCE_DIR/40_playwright/stdout.txt" ] && tail -20 "$EVIDENCE_DIR/40_playwright/stdout.txt"
  } | tee "$EVIDENCE_DIR/41_playwright_summary.txt"
}

# ============================================================================
# PHASE 7: ORIGIN PARITY
# ============================================================================

phase_7_origin_parity() {
  log_section "PHASE 7: ORIGIN PARITY"
  
  cd "$VENDOR_ROOT"
  
  local local_head="$(git rev-parse HEAD 2>/dev/null || echo "")"
  local origin_main="$(git ls-remote origin refs/heads/main 2>/dev/null | awk '{print $1}' || echo "")"
  
  if [ -z "$local_head" ] || [ -z "$origin_main" ]; then
    ORIGIN_PARITY="UNKNOWN"
    echo "PARITY: Cannot determine (git remote unavailable)" > "$EVIDENCE_DIR/50_origin_parity.txt"
    return 0
  fi
  
  if [ "$local_head" = "$origin_main" ]; then
    ORIGIN_PARITY="REMOTE_MATCHED"
  else
    local ahead_behind="$(git rev-list --left-right --count origin/main...HEAD 2>/dev/null || echo "0 0")"
    local ahead=$(echo "$ahead_behind" | awk '{print $1}')
    local behind=$(echo "$ahead_behind" | awk '{print $2}')
    
    if [ "$ahead" -gt 0 ] && [ "$behind" = "0" ]; then
      ORIGIN_PARITY="LOCAL_AHEAD_OF_ORIGIN"
    elif [ "$behind" -gt 0 ]; then
      ORIGIN_PARITY="LOCAL_BEHIND_ORIGIN"
    else
      ORIGIN_PARITY="DIVERGED"
    fi
  fi
  
  {
    echo "PARITY: $ORIGIN_PARITY"
    echo "Local HEAD: ${local_head:0:7}"
    echo "Origin/main: ${origin_main:0:7}"
  } | tee "$EVIDENCE_DIR/50_origin_parity.txt"
}

# ============================================================================
# PHASE 8: FINAL VERDICT
# ============================================================================

phase_8_final_verdict() {
  log_section "PHASE 8: FINAL VERDICT"
  
  # Apply decision logic
  local final_status="NOT_SUBMISSION_READY"
  
  if [ "$PAGES_LIVE" = "PAGES_LIVE_COMPLETE" ] && \
     [ "$FREEZE_EXIT" = "0" ] && \
     [ "$GATE_EXIT" = "0" ] && \
     [ "$PLAYWRIGHT_EXIT" = "0" ] && \
     [ "$CLEANLINESS_VERDICT" != "FAIL" ]; then
    final_status="FULL_SUBMISSION_BULLETPROOF_READY"
  elif [ "$FREEZE_EXIT" = "0" ] && [ "$GATE_EXIT" = "0" ]; then
    final_status="SUBMISSION_READY_WITH_NONBLOCKING_GAPS"
  fi
  
  {
    echo "FINAL VERDICT"
    echo "=============================================================================="
    echo "Pages live: $PAGES_LIVE"
    echo "Freeze lock: $([ "$FREEZE_EXIT" = "0" ] && echo "PASS" || echo "FAIL")"
    echo "Reviewer gate: $([ "$GATE_EXIT" = "0" ] && echo "PASS" || echo "FAIL")"
    echo "Playwright: $([ "$PLAYWRIGHT_EXIT" = "0" ] && echo "PASS" || echo "FAIL")"
    echo "Cleanliness: $CLEANLINESS_VERDICT"
    echo "Origin parity: $ORIGIN_PARITY"
    echo ""
    echo "VERDICT: $final_status"
    echo "=============================================================================="
  } | tee "$EVIDENCE_DIR/60_final_verdict.txt"
  
  log_info "Verdict: $final_status"
}

# ============================================================================
# MAIN
# ============================================================================

main() {
  phase_1_cleanliness || { log_error "Phase 1 failed"; return 1; }
  phase_2_pages_discovery
  phase_3_pages_verdict
  phase_4_gates
  phase_5_forge_install
  phase_6_playwright || true
  phase_7_origin_parity
  phase_8_final_verdict
  
  log_section "CLOSEOUT COMPLETE"
  log_info "Evidence: $EVIDENCE_DIR"
  
  echo ""
  grep "^VERDICT:" "$EVIDENCE_DIR/60_final_verdict.txt" || true
}

main "$@"
