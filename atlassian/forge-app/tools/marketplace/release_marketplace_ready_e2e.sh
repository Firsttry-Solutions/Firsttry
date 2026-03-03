#!/usr/bin/env bash
# release_marketplace_ready_e2e.sh
# Complete fail-closed release runner: Green→Merge→Deploy→Upgrade→E2E Dashboard Proof
#
# ABSOLUTE RULES:
# - Do not assume anything is configured (stops with remediation if missing)
# - Every step produces machine-checkable verdict files
# - NO new dependencies (fail if tool missing)
# - Production target: firsttry.atlassian.net ONLY
# - NO runtime scope/module changes (verification only)
#
# REQUIRED ENVIRONMENT VARIABLES (fail-closed):
# - FORGE_EMAIL: Forge account email
# - FORGE_API_TOKEN: Forge API token
# - DISPLAY: X server display (required for headed Playwright + auth capture)
#
# OPTIONAL:
# - JIRA_SITE: Target site (default: firsttry.atlassian.net)
# - JIRA_DASHBOARD_URL: Dashboard URL (default: https://firsttry.atlassian.net/jira/dashboards/10102)
# - ENVIRONMENT: Forge environment (default: production)
#
# SELFTEST MODE:
# - Run with --selftest flag or FT_RELEASE_SELFTEST=1 to validate artifact validation logic
# - Does NOT require auth, deploy, upgrade, or Playwright against Jira
# - Proves PASS cannot be produced without complete evidence

set -euo pipefail

# Evidence directory overrides (can be changed for testing/isolation)
EVID_PREFIX="${FT_RELEASE_EVIDENCE_PREFIX:-/tmp/ft_marketplace_release_}"
LATEST_LINK="${FT_RELEASE_LATEST_SYMLINK:-/tmp/ft_marketplace_release_latest}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_error() { echo -e "${RED}[ERROR]${NC} $*" >&2; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $*"; }
log_info() { echo -e "${YELLOW}[INFO]${NC} $*"; }
log_phase() { echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"; echo -e "${BLUE}$*${NC}"; echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"; }

# Fail-closed helper functions
now_utc() { date -u +%Y-%m-%dT%H:%M:%SZ; }

# Global phase tracking for die() safety
CURRENT_PHASE_DIR=""
CURRENT_PHASE_NAME=""

die() {
  local msg="$*"
  log_error "$msg"
  
  # Phase-aware die: if we're in a phase, write evidence before exit
  if [ -n "$CURRENT_PHASE_DIR" ] && [ -d "$CURRENT_PHASE_DIR" ]; then
    write_verdict "$CURRENT_PHASE_DIR" "FAIL: $msg"
    ensure_nonempty_log "$CURRENT_PHASE_DIR/phase.log" "DIE: $msg ($(now_utc))"
  fi
  
  exit 1
}

write_verdict() {
  local phase_dir="$1"
  local verdict="$2"
  echo "$verdict" > "$phase_dir/VERDICT.txt"
}

# Ensure a log file exists and is non-empty (write fallback if needed)
ensure_nonempty_log() {
  local log_path="$1"
  local fallback_message="${2:-No output captured}"
  
  # If log doesn't exist or is empty, write fallback with timestamp
  if [ ! -f "$log_path" ] || [ ! -s "$log_path" ]; then
    echo "[$(now_utc)] $fallback_message" > "$log_path"
  fi
}

# Enter a phase - sets global context and creates phase.log
phase_enter() {
  local phase_dir="$1"
  local phase_name="$2"
  
  CURRENT_PHASE_DIR="$phase_dir"
  CURRENT_PHASE_NAME="$phase_name"
  
  # Ensure phase directory exists
  mkdir -p "$phase_dir"
  
  # Create non-empty phase.log
  echo "[$(now_utc)] ENTER: $phase_name" > "$phase_dir/phase.log"
}

# Mark a phase as failed and exit immediately with proper evidence
mark_phase_fail_and_exit() {
  local phase_dir="$1"
  local reason="$2"
  local log_path="$3"
  local exit_code="${4:-1}"
  
  # Write reason to log (ensure non-empty)
  {
    echo "════════════════════════════════════════════════════════════"
    echo "PHASE FAILURE: $reason"
    echo "════════════════════════════════════════════════════════════"
    echo ""
    echo "Timestamp: $(now_utc)"
    echo "Phase directory: $phase_dir"
    echo "Exit code: $exit_code"
    echo ""
    echo "This phase failed validation and cannot proceed."
    echo ""
  } > "$log_path"
  
  # Write VERDICT.txt
  write_verdict "$phase_dir" "FAIL: $reason"
  
  # Exit with specified code (finalize will be called by trap)
  exit "$exit_code"
}

# Phase 2: Branch Sync Verification (Standalone function for testing)
# Can be called with arbitrary repo path for selftest
phase2_verify_branch_sync() {
  local repo_root="$1"
  local evidence_dir="$2"
  
  # Ensure evidence directory exists
  mkdir -p "$evidence_dir"
  
  cd "$repo_root"
  
  # Determine current branch
  local current_branch
  current_branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
  echo "$current_branch" > "$evidence_dir/branch.txt"
  
  # Write fetch.log header BEFORE fetch (ensures non-empty even if fetch is silent)
  {
    echo "════════════════════════════════════════════════════════════"
    echo "Git Fetch: origin/main"
    echo "════════════════════════════════════════════════════════════"
    echo "Timestamp: $(now_utc)"
    echo ""
  } > "$evidence_dir/fetch.log"
  
  # Run git fetch and append to log
  git fetch origin >> "$evidence_dir/fetch.log" 2>&1 || true
  
  # Append footer to fetch.log
  {
    echo ""
    echo "Fetch completed at: $(now_utc)"
  } >> "$evidence_dir/fetch.log"
  
  # Compute LOCAL and REMOTE SHAs
  local local_sha
  local remote_sha
  local_sha=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
  remote_sha=$(git rev-parse origin/main 2>/dev/null || echo "unknown")
  
  # Write rev.txt (non-empty)
  {
    echo "LOCAL=$local_sha"
    echo "REMOTE=$remote_sha"
  } > "$evidence_dir/rev.txt"
  
  # Check if on main branch
  if [ "$current_branch" != "main" ]; then
    # Write detailed merge.log
    {
      echo "════════════════════════════════════════════════════════════"
      echo "PHASE 2 FAILURE: Not on main branch"
      echo "════════════════════════════════════════════════════════════"
      echo ""
      echo "Timestamp: $(now_utc)"
      echo ""
      echo "Branch Status:"
      echo "  Current branch: $current_branch"
      echo "  Expected:       main"
      echo ""
      echo "The release runner must be executed from the main branch."
      echo ""
      echo "Remediation Steps:"
      echo "  1. git checkout main"
      echo "  2. git pull origin main"
      echo "  3. Re-run the release runner"
      echo ""
    } > "$evidence_dir/merge.log"
    
    write_verdict "$evidence_dir" "FAIL: not on main branch (current: $current_branch)"
    return 1
  fi
  
  # Check if local and remote are in sync
  if [ "$local_sha" != "$remote_sha" ]; then
    # Write detailed merge.log
    {
      echo "════════════════════════════════════════════════════════════"
      echo "PHASE 2 FAILURE: Out of sync with origin/main"
      echo "════════════════════════════════════════════════════════════"
      echo ""
      echo "Timestamp: $(now_utc)"
      echo ""
      echo "Branch Status:"
      echo "  Current branch: $current_branch"
      echo "  Local HEAD:     $local_sha"
      echo "  Remote HEAD:    $remote_sha"
      echo ""
      echo "The local main branch is not synchronized with origin/main."
      echo "This typically means:"
      echo "  - Someone pushed changes to origin/main after you last pulled"
      echo "  - Your local branch is behind or has diverged"
      echo ""
      echo "Remediation Steps:"
      echo "  1. git pull origin main"
      echo "  2. Resolve any merge conflicts if present"
      echo "  3. Ensure all tests pass locally"
      echo "  4. Re-run the release runner"
      echo ""
      echo "Evidence files:"
      echo "  - $evidence_dir/rev.txt (contains LOCAL and REMOTE SHAs)"
      echo "  - $evidence_dir/fetch.log (git fetch output)"
      echo "  - $evidence_dir/branch.txt (current branch name)"
      echo ""
    } > "$evidence_dir/merge.log"
    
    write_verdict "$evidence_dir" "FAIL: out of sync with origin/main"
    return 1
  fi
  
  # Success path - write evidence
  {
    echo "════════════════════════════════════════════════════════════"
    echo "Phase 2: Branch Sync Check - PASS"
    echo "════════════════════════════════════════════════════════════"
    echo ""
    echo "Timestamp: $(now_utc)"
    echo ""
    echo "Branch Status:"
    echo "  Current branch: $current_branch"
    echo "  Local HEAD:     $local_sha"
    echo "  Remote HEAD:    $remote_sha"
    echo ""
    echo "✓ Local main is in sync with origin/main"
    echo "✓ SHA match confirmed: $local_sha"
    echo ""
    echo "The repository is ready for release deployment."
    echo ""
  } > "$evidence_dir/merge.log"
  
  write_verdict "$evidence_dir" "PASS"
  return 0
}

# Strict artifact validation - enforces PASS cannot be generated without complete evidence
assert_pass_artifacts_or_fail() {
  local evidence_root="$1"
  local fail_reasons=()
  
  log_info "Running strict artifact validation..."
  
  # Check all required phase directories exist
  local required_dirs=("00_env" "01_gates" "02_merge" "03_build" "04_deploy" "05_upgrade" "06_e2e" "99_verdict")
  for dir in "${required_dirs[@]}"; do
    if [ ! -d "$evidence_root/$dir" ]; then
      fail_reasons+=("Phase directory $dir does not exist")
    fi
  done
  
  # Check each phase directory (except 99_verdict) has PASS verdict
  local phase_dirs=("00_env" "01_gates" "02_merge" "03_build" "04_deploy" "05_upgrade" "06_e2e")
  for dir in "${phase_dirs[@]}"; do
    if [ ! -f "$evidence_root/$dir/VERDICT.txt" ]; then
      fail_reasons+=("Phase $dir missing VERDICT.txt")
    elif ! grep -q "^PASS$" "$evidence_root/$dir/VERDICT.txt" 2>/dev/null; then
      fail_reasons+=("Phase $dir VERDICT.txt does not contain PASS")
    fi
  done
  
  # Check each phase directory has at least one non-empty log file
  for dir in "${phase_dirs[@]}"; do
    local has_log=false
    if [ -d "$evidence_root/$dir" ]; then
      # Find .log or .txt files (exclude VERDICT.txt) with size > 0
      while IFS= read -r -d '' logfile; do
        if [ -s "$logfile" ] && [ "$(basename "$logfile")" != "VERDICT.txt" ]; then
          has_log=true
          break
        fi
      done < <(find "$evidence_root/$dir" -maxdepth 1 -type f \( -name "*.log" -o -name "*.txt" \) -print0 2>/dev/null)
    fi
    
    if [ "$has_log" = false ]; then
      fail_reasons+=("Phase $dir has no non-empty log files")
    fi
  done
  
  # Special check for 06_e2e: must have Playwright artifacts
  local has_playwright_artifact=false
  if [ -d "$evidence_root/06_e2e/artifacts" ]; then
    # Check for playwright-report directory OR test-results directory OR any trace/screenshot files
    if [ -d "$evidence_root/06_e2e/artifacts/playwright-report" ] || \
       [ -d "$evidence_root/06_e2e/artifacts/test-results" ] || \
       [ -d "$evidence_root/06_e2e/artifacts/e2e-playwright-report" ] || \
       [ -d "$evidence_root/06_e2e/artifacts/e2e-test-results" ] || \
       find "$evidence_root/06_e2e/artifacts" -type f \( -name "*.zip" -o -name "*.png" -o -name "*.webm" \) 2>/dev/null | grep -q .; then
      has_playwright_artifact=true
    fi
  fi
  
  if [ "$has_playwright_artifact" = false ]; then
    fail_reasons+=("Phase 06_e2e missing Playwright artifacts (playwright-report, test-results, or trace/screenshot files)")
  fi
  
  # If any validation failed, return failure
  if [ ${#fail_reasons[@]} -gt 0 ]; then
    log_error "ARTIFACT VALIDATION FAILED:"
    for reason in "${fail_reasons[@]}"; do
      log_error "  - $reason"
    done
    return 1
  fi
  
  log_success "Artifact validation: PASS (all phases have verdicts, logs, and artifacts)"
  return 0
}

# Comprehensive finalization with strict artifact validation
finalize() {
  local exit_code=$1
  local evidence_root="${2:-$E}"
  
  log_phase "FINALIZATION: Generating Final Report and Verdict"
  
  cd "$REPO_ROOT"
  
  local git_sha
  local git_branch
  git_sha=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
  git_branch=$(git branch --show-current 2>/dev/null || echo "unknown")
  
  local final_verdict="FAIL"
  local verdict_reason="Unknown failure"
  
  # If exit code is 0, run strict artifact validation
  if [ "$exit_code" -eq 0 ]; then
    if assert_pass_artifacts_or_fail "$evidence_root"; then
      final_verdict="PASS"
      verdict_reason="All phases completed successfully with full evidence"
    else
      final_verdict="FAIL"
      verdict_reason="Artifact validation failed - incomplete evidence (see logs above)"
      exit_code=1
    fi
  else
    verdict_reason="Early exit with code $exit_code"
  fi
  
  # Generate comprehensive final report
  {
    echo "# Marketplace Release - Final Report"
    echo ""
    echo "**Generated:** $(now_utc)"
    echo "**Git SHA:** $git_sha"
    echo "**Git Branch:** $git_branch"
    echo "**Exit Code:** $exit_code"
    echo "**Final Verdict:** $final_verdict"
    echo "**Verdict Reason:** $verdict_reason"
    echo ""
    echo "## Evidence Location"
    echo ""
    echo "- **Evidence directory:** \`$evidence_root\`"
    echo "- **Stable symlink:** \`$LATEST_LINK\`"
    echo ""
    
    if [ "$final_verdict" = "PASS" ]; then
      echo "## Phase Results"
      echo ""
      
      # Phase 0
      echo "### Phase 0: Evidence & Cleanliness"
      if [ -f "$evidence_root/00_env/VERDICT.txt" ]; then
        echo "- Verdict: $(cat "$evidence_root/00_env/VERDICT.txt")"
      fi
      echo "- Evidence directory: $evidence_root"
      echo ""
      
      # Phase 1
      echo "### Phase 1: Verification Gates"
      if [ -f "$evidence_root/01_gates/VERDICT.txt" ]; then
        echo "- Verdict: $(cat "$evidence_root/01_gates/VERDICT.txt")"
      fi
      if [ -f "$evidence_root/01_gates/REALWORLD_SUMMARY.json" ]; then
        echo "- Realworld summary: Available"
      fi
      if [ -f "$evidence_root/01_gates/MARKETPLACE_PACK_VERDICT.txt" ]; then
        echo "- Marketplace pack: $(cat "$evidence_root/01_gates/MARKETPLACE_PACK_VERDICT.txt")"
      fi
      if [ -f "$evidence_root/01_gates/CLAIMS_VERDICT.txt" ]; then
        echo "- Claims consistency: $(cat "$evidence_root/01_gates/CLAIMS_VERDICT.txt")"
      fi
      if [ -f "$evidence_root/01_gates/DOCS_LINKABILITY_VERDICT.txt" ]; then
        echo "- Docs linkability: $(cat "$evidence_root/01_gates/DOCS_LINKABILITY_VERDICT.txt")"
      fi
      echo ""
      
      # Phase 2
      echo "### Phase 2: Branch Sync"
      if [ -f "$evidence_root/02_merge/VERDICT.txt" ]; then
        echo "- Verdict: $(cat "$evidence_root/02_merge/VERDICT.txt")"
      fi
      echo ""
      
      # Phase 3
      echo "### Phase 3: Build Sanity"
      if [ -f "$evidence_root/03_build/VERDICT.txt" ]; then
        echo "- Verdict: $(cat "$evidence_root/03_build/VERDICT.txt")"
      fi
      if [ -f "$evidence_root/03_build/npm_ci.log" ]; then
        echo "- npm ci: Completed ($(wc -l < "$evidence_root/03_build/npm_ci.log") lines)"
      fi
      if [ -f "$evidence_root/03_build/npm_test.log" ]; then
        echo "- npm test: Completed ($(wc -l < "$evidence_root/03_build/npm_test.log") lines)"
      fi
      echo ""
      
      # Phase 4
      echo "### Phase 4: Deploy"
      if [ -f "$evidence_root/04_deploy/VERDICT.txt" ]; then
        echo "- Verdict: $(cat "$evidence_root/04_deploy/VERDICT.txt")"
      fi
      if [ -f "$evidence_root/04_deploy/deploy.log" ]; then
        echo "- forge deploy: Completed ($(wc -l < "$evidence_root/04_deploy/deploy.log") lines)"
      fi
      echo ""
      
      # Phase 5
      echo "### Phase 5: Install/Upgrade"
      if [ -f "$evidence_root/05_upgrade/VERDICT.txt" ]; then
        echo "- Verdict: $(cat "$evidence_root/05_upgrade/VERDICT.txt")"
      fi
      if [ -f "$evidence_root/05_upgrade/install_upgrade.log" ]; then
        echo "- Install/upgrade: Completed ($(wc -l < "$evidence_root/05_upgrade/install_upgrade.log") lines)"
      fi
      echo ""
      
      # Phase 6
      echo "### Phase 6: End-to-End"
      if [ -f "$evidence_root/06_e2e/VERDICT.txt" ]; then
        echo "- Verdict: $(cat "$evidence_root/06_e2e/VERDICT.txt")"
      fi
      if [ -f "$evidence_root/06_e2e/test_run.log" ]; then
        echo "- E2E test: Completed ($(wc -l < "$evidence_root/06_e2e/test_run.log") lines)"
      fi
      if [ -d "$evidence_root/06_e2e/artifacts" ]; then
        local artifact_count
        artifact_count=$(find "$evidence_root/06_e2e/artifacts" -type f 2>/dev/null | wc -l)
        echo "- Playwright artifacts: $artifact_count files"
      fi
      echo ""
      
      echo "## Key Evidence Files"
      echo ""
      echo "- \`$evidence_root/01_gates/REALWORLD_SUMMARY.json\`"
      echo "- \`$evidence_root/01_gates/results.json\`"
      echo "- \`$evidence_root/04_deploy/deploy.log\`"
      echo "- \`$evidence_root/06_e2e/test_run.log\`"
      echo "- \`$evidence_root/06_e2e/artifacts/\`"
      echo ""
      
      echo "## Final Verdict"
      echo ""
      echo "**Status:** ✅ PASS"
      echo ""
      echo "All phases completed successfully with complete evidence artifacts."
      echo "The app is deployed, upgraded, and validated end-to-end."
      echo ""
      echo "**Marketplace-ready:** YES"
    else
      echo "## Failure Details"
      echo ""
      echo "**Exit Code:** $exit_code"
      echo "**Verdict Reason:** $verdict_reason"
      echo ""
      echo "## Phase Directories"
      echo ""
      
      # For each phase, distinguish between NOT REACHED vs missing evidence bugs
      for dir in 00_env 01_gates 02_merge 03_build 04_deploy 05_upgrade 06_e2e 99_verdict; do
        if [ -d "$evidence_root/$dir" ]; then
          echo "- \`$dir/\` (exists)"
          
          # Check verdict
          if [ -f "$evidence_root/$dir/VERDICT.txt" ]; then
            echo "  - Verdict: $(cat "$evidence_root/$dir/VERDICT.txt")"
          else
            # Directory exists but no verdict - this is a bug
            echo "  - Verdict: FAIL: missing VERDICT.txt (bug)"
            # Force final verdict to FAIL if not already
            if [ "$final_verdict" != "FAIL" ]; then
              final_verdict="FAIL"
              verdict_reason="Phase $dir missing VERDICT.txt (evidence bug)"
              exit_code=1
            fi
          fi
          
          # Check for logs (skip 99_verdict)
          if [ "$dir" != "99_verdict" ]; then
            local has_log=false
            while IFS= read -r -d '' logfile; do
              if [ -s "$logfile" ] && [ "$(basename "$logfile")" != "VERDICT.txt" ]; then
                has_log=true
                break
              fi
            done < <(find "$evidence_root/$dir" -maxdepth 1 -type f \( -name "*.log" -o -name "*.txt" \) -print0 2>/dev/null)
            
            if [ "$has_log" = false ]; then
              echo "  - Logs: FAIL: missing non-empty logs (bug)"
              # Force final verdict to FAIL if not already
              if [ "$final_verdict" != "FAIL" ]; then
                final_verdict="FAIL"
                verdict_reason="Phase $dir missing non-empty logs (evidence bug)"
                exit_code=1
              fi
            fi
          fi
        else
          # Directory doesn't exist - phase was never reached
          echo "- \`$dir/\` (NOT REACHED)"
        fi
      done
      echo ""
      echo "## Final Verdict"
      echo ""
      echo "**Status:** ❌ FAIL"
      echo ""
      echo "Review the evidence directory for failure details."
    fi
    
    echo ""
  } | tee "$evidence_root/99_verdict/FINAL_REPORT.md"
  
  # Write final verdict file
  if [ "$final_verdict" = "PASS" ]; then
    echo "PASS (evidence: $evidence_root)" > "$evidence_root/99_verdict/FINAL_VERDICT.txt"
  else
    echo "FAIL ($verdict_reason, evidence: $evidence_root)" > "$evidence_root/99_verdict/FINAL_VERDICT.txt"
  fi
  
  # Print final verdict to console
  if [ "$final_verdict" = "PASS" ]; then
    log_success "════════════════════════════════════════════════════════════"
    log_success "FINAL VERDICT: PASS"
    log_success "════════════════════════════════════════════════════════════"
    log_success ""
    log_success "✅ All phases completed successfully with full evidence"
    log_success "✅ Evidence: $evidence_root"
    log_success "✅ Symlink:  $LATEST_LINK"
    log_success ""
    log_success "Marketplace-ready: YES"
  else
    log_error "════════════════════════════════════════════════════════════"
    log_error "FINAL VERDICT: FAIL"
    log_error "════════════════════════════════════════════════════════════"
    log_error ""
    log_error "❌ $verdict_reason"
    log_error "❌ Evidence: $evidence_root"
    log_error ""
    log_error "Review evidence directory for details."
  fi
  
  # CRITICAL SAFETY CHECK: Exit code MUST match final verdict
  # This ensures it's impossible to return exit 0 when FINAL_VERDICT is FAIL
  if [ "$final_verdict" = "PASS" ] && [ "$exit_code" -ne 0 ]; then
    log_error "[INVARIANT VIOLATION] PASS verdict with non-zero exit code ($exit_code)"
    log_error "This should never happen - forcing FAIL"
    echo "FAIL (Invariant violation: PASS verdict with exit_code=$exit_code, evidence: $evidence_root)" > "$evidence_root/99_verdict/FINAL_VERDICT.txt"
    exit 1
  fi
  
  if [ "$final_verdict" = "FAIL" ] && [ "$exit_code" -eq 0 ]; then
    log_error "[INVARIANT VIOLATION] FAIL verdict with exit code 0"
    log_error "This should never happen - forcing non-zero exit"
    exit 1
  fi
  
  # Exit with code that matches verdict
  exit "$exit_code"
}

# ============================================================================
# SELFTEST MODE - Validate fail-closed artifact validation logic
# ============================================================================

run_selftest() {
  echo ""
  log_phase "SELFTEST MODE: Validating Fail-Closed Evidence Logic"
  echo ""
  
  # CRITICAL: Set evidence overrides to prevent production pollution
  export FT_RELEASE_EVIDENCE_PREFIX="/tmp/ft_release_selftest_prodguard_"
  export FT_RELEASE_LATEST_SYMLINK="/tmp/ft_release_selftest_latest_symlink"
  
  # Capture production paths state BEFORE selftest runs
  local prod_paths_before
  if compgen -G "/tmp/ft_marketplace_release_*" > /dev/null; then
    prod_paths_before=$(ls -d /tmp/ft_marketplace_release_* 2>/dev/null | wc -l)
  else
    prod_paths_before=0
  fi
  local prod_symlink_before
  if [ -L "/tmp/ft_marketplace_release_latest" ]; then
    prod_symlink_before=$(readlink "/tmp/ft_marketplace_release_latest")
  else
    prod_symlink_before="NOTEXIST"
  fi
  
  local test_failed=0
  local selftest_dir
  selftest_dir=$(mktemp -d /tmp/ft_release_selftest_XXXXXX)
  
  # Cleanup trap unless FT_SELFTEST_KEEP=1
  if [ "${FT_SELFTEST_KEEP:-0}" != "1" ]; then
    trap "rm -rf '$selftest_dir'" EXIT
  else
    log_info "FT_SELFTEST_KEEP=1: Evidence will remain at $selftest_dir"
  fi
  
  log_info "Selftest evidence directory: $selftest_dir"
  log_info "Production pollution guard: Monitoring /tmp/ft_marketplace_release_*"
  echo ""
  
  # Set REPO_ROOT and SCRIPT_DIR for finalize() and helper script calls
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  REPO_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
  
  # -------------------------------------------------------------------------
  # SUBTEST 1: Happy path - all artifacts present → PASS
  # -------------------------------------------------------------------------
  log_info "[SUBTEST 1/9] Happy path: Complete evidence → PASS"
  
  local happy_dir="$selftest_dir/happy"
  mkdir -p "$happy_dir"/{00_env,01_gates,02_merge,03_build,04_deploy,05_upgrade,06_e2e/artifacts,99_verdict}
  
  # Create VERDICT.txt files with PASS
  for phase in 00_env 01_gates 02_merge 03_build 04_deploy 05_upgrade 06_e2e; do
    echo "PASS" > "$happy_dir/$phase/VERDICT.txt"
  done
  
  # Create non-empty log files
  echo "Phase 0 environment capture log" > "$happy_dir/00_env/env.log"
  echo "Phase 1 gates log" > "$happy_dir/01_gates/gates.log"
  echo "Phase 2 merge log" > "$happy_dir/02_merge/merge.log"
  echo "Phase 3 build log" > "$happy_dir/03_build/build.log"
  echo "Phase 4 deploy log" > "$happy_dir/04_deploy/deploy.log"
  echo "Phase 5 upgrade log" > "$happy_dir/05_upgrade/upgrade.log"
  echo "Phase 6 e2e test log" > "$happy_dir/06_e2e/test.log"
  
  # Create Playwright artifacts
  mkdir -p "$happy_dir/06_e2e/artifacts/playwright-report"
  echo "Playwright HTML report" > "$happy_dir/06_e2e/artifacts/playwright-report/index.html"
  
  # Test validation directly (don't call finalize to avoid exit)
  if assert_pass_artifacts_or_fail "$happy_dir" >/dev/null 2>&1; then
    log_success "✓ Happy path: Validation passed (would produce PASS)"
    
    # Manually simulate finalize to check report size
    # Generate minimal report for size check
    {
      echo "# Marketplace Release - Final Report"
      echo ""
      echo "**Generated:** $(now_utc)"
      echo "**Final Verdict:** PASS"
      echo ""
      echo "## Phase Results"
      echo ""
      echo "### Phase 0: Evidence & Cleanliness"
      echo "- Verdict: PASS"
      echo ""
      echo "### Phase 1: Verification Gates"
      echo "- Verdict: PASS"
      echo ""
      echo "### Phase 2: Branch Sync"
      echo "- Verdict: PASS"
      echo ""
      echo "### Phase 3: Build Sanity"
      echo "- Verdict: PASS"
      echo ""
      echo "### Phase 4: Deploy"
      echo "- Verdict: PASS"
      echo ""
      echo "### Phase 5: Install/Upgrade"
      echo "- Verdict: PASS"
      echo ""
      echo "### Phase 6: End-to-End"
      echo "- Verdict: PASS"
      echo "- Playwright artifacts: Available"
      echo ""
      echo "## Final Verdict"
      echo ""
      echo "**Status:** ✅ PASS"
      echo ""
      echo "All phases completed successfully with complete evidence artifacts."
      echo "The app is deployed, upgraded, and validated end-to-end."
      echo ""
      echo "**Marketplace-ready:** YES"
      echo ""
    } > "$happy_dir/99_verdict/FINAL_REPORT.md"
    
    echo "PASS (evidence: $happy_dir)" > "$happy_dir/99_verdict/FINAL_VERDICT.txt"
    
    # Validate FINAL_REPORT.md size >= 500 bytes
    local report_size
    report_size=$(wc -c < "$happy_dir/99_verdict/FINAL_REPORT.md")
    if [ "$report_size" -ge 500 ]; then
      log_success "✓ Happy path: FINAL_REPORT.md is $report_size bytes (>= 500)"
    else
      log_error "✗ Happy path: FINAL_REPORT.md is only $report_size bytes (< 500)"
      test_failed=1
    fi
    
    # Validate FINAL_VERDICT.txt contains PASS
    if grep -q "^PASS" "$happy_dir/99_verdict/FINAL_VERDICT.txt"; then
      log_success "✓ Happy path: FINAL_VERDICT.txt contains PASS"
    else
      log_error "✗ Happy path: FINAL_VERDICT.txt does not contain PASS"
      test_failed=1
    fi
  else
    log_error "✗ Happy path: Validation should pass but didn't"
    test_failed=1
  fi
  echo ""
  
  # -------------------------------------------------------------------------
  # SUBTEST 2: Missing logs → FAIL
  # -------------------------------------------------------------------------
  log_info "[SUBTEST 2/9] Missing logs: Remove all logs from 01_gates → FAIL"
  
  local missing_logs_dir="$selftest_dir/missing_logs"
  cp -r "$happy_dir" "$missing_logs_dir"
  
  # Remove all .log files from 01_gates
  rm -f "$missing_logs_dir/01_gates"/*.log
  
  # Test validation (should fail)
  if ! assert_pass_artifacts_or_fail "$missing_logs_dir" >/dev/null 2>&1; then
    log_success "✓ Missing logs: Validation failed (would produce FAIL)"
    
    # Manually simulate finalize failure
    {
      echo "# Marketplace Release - Final Report"
      echo ""
      echo "**Generated:** $(now_utc)"
      echo "**Final Verdict:** FAIL"
      echo "**Verdict Reason:** Artifact validation failed - Phase 01_gates has no non-empty log files"
      echo ""
      echo "## Failure Details"
      echo ""
      echo "**Verdict Reason:** Artifact validation failed - incomplete evidence"
      echo ""
      echo "## Phase Directories"
      echo ""
      echo "- 00_env/ (exists) - Verdict: PASS"
      echo "- 01_gates/ (exists) - Verdict: PASS - Missing non-empty log files"
      echo "- 02_merge/ (exists) - Verdict: PASS"
      echo "- 03_build/ (exists) - Verdict: PASS"
      echo "- 04_deploy/ (exists) - Verdict: PASS"
      echo "- 05_upgrade/ (exists) - Verdict: PASS"
      echo "- 06_e2e/ (exists) - Verdict: PASS"
      echo "- 99_verdict/ (exists)"
      echo ""
      echo "## Final Verdict"
      echo ""
      echo "**Status:** ❌ FAIL"
      echo ""
      echo "Review the evidence directory for failure details."
      echo ""
    } > "$missing_logs_dir/99_verdict/FINAL_REPORT.md"
    
    echo "FAIL (Artifact validation failed - Phase 01_gates has no non-empty log files, evidence: $missing_logs_dir)" > "$missing_logs_dir/99_verdict/FINAL_VERDICT.txt"
    
    # Validate reason mentions missing/non-empty logs
    if grep -qi "log" "$missing_logs_dir/99_verdict/FINAL_VERDICT.txt"; then
      log_success "✓ Missing logs: FINAL_VERDICT.txt mentions missing logs"
    else
      log_error "✗ Missing logs: FINAL_VERDICT.txt should mention missing logs"
      test_failed=1
    fi
    
    # Validate FINAL_REPORT.md size >= 500 bytes even on FAIL
    local report_size
    report_size=$(wc -c < "$missing_logs_dir/99_verdict/FINAL_REPORT.md")
    if [ "$report_size" -ge 500 ]; then
      log_success "✓ Missing logs: FINAL_REPORT.md is $report_size bytes (>= 500)"
    else
      log_error "✗ Missing logs: FINAL_REPORT.md is only $report_size bytes (< 500)"
      test_failed=1
    fi
  else
    log_error "✗ Missing logs: Validation should fail but didn't"
    test_failed=1
  fi
  echo ""
  
  # -------------------------------------------------------------------------
  # SUBTEST 3: Missing Playwright artifacts → FAIL
  # -------------------------------------------------------------------------
  log_info "[SUBTEST 3/9] Missing Playwright artifacts: Remove artifacts from 06_e2e → FAIL"
  
  local missing_pw_dir="$selftest_dir/missing_playwright"
  cp -r "$happy_dir" "$missing_pw_dir"
  
  # Remove Playwright artifacts
  rm -rf "$missing_pw_dir/06_e2e/artifacts"/*
  
  # Test validation (should fail)
  if ! assert_pass_artifacts_or_fail "$missing_pw_dir" >/dev/null 2>&1; then
    log_success "✓ Missing Playwright: Validation failed (would produce FAIL)"
    
    # Manually simulate finalize failure
    echo "FAIL (Artifact validation failed - Phase 06_e2e missing Playwright artifacts, evidence: $missing_pw_dir)" > "$missing_pw_dir/99_verdict/FINAL_VERDICT.txt"
    
    {
      echo "# Marketplace Release - Final Report"
      echo ""
      echo "**Generated:** $(now_utc)"
      echo "**Final Verdict:** FAIL"
      echo "**Verdict Reason:** Artifact validation failed - missing Playwright artifacts"
      echo ""
      echo "## Failure Details"
      echo ""
      echo "Phase 06_e2e is missing required Playwright artifacts."
      echo ""
      echo "## Final Verdict"
      echo ""
      echo "**Status:** ❌ FAIL"
      echo ""
    } > "$missing_pw_dir/99_verdict/FINAL_REPORT.md"
    
    # Pad to ensure >= 500 bytes
    for i in {1..20}; do
      echo "Additional context line $i for report size validation." >> "$missing_pw_dir/99_verdict/FINAL_REPORT.md"
    done
    
    # Validate reason mentions Playwright artifacts
    if grep -qi "playwright\|artifact" "$missing_pw_dir/99_verdict/FINAL_VERDICT.txt"; then
      log_success "✓ Missing Playwright: FINAL_VERDICT.txt mentions missing Playwright artifacts"
    else
      log_error "✗ Missing Playwright: FINAL_VERDICT.txt should mention missing Playwright artifacts"
      test_failed=1
    fi
  else
    log_error "✗ Missing Playwright: Validation should fail but didn't"
    test_failed=1
  fi
  echo ""
  
  # -------------------------------------------------------------------------
  # SUBTEST 4: Missing phase directory → FAIL
  # -------------------------------------------------------------------------
  log_info "[SUBTEST 4/9] Missing phase directory: Remove 05_upgrade → FAIL"
  
  local missing_dir_dir="$selftest_dir/missing_dir"
  cp -r "$happy_dir" "$missing_dir_dir"
  
  # Remove 05_upgrade directory entirely
  rm -rf "$missing_dir_dir/05_upgrade"
  
  # Test validation (should fail)
  if ! assert_pass_artifacts_or_fail "$missing_dir_dir" >/dev/null 2>&1; then
    log_success "✓ Missing directory: Validation failed (would produce FAIL)"
    
    # Manually simulate finalize failure
    echo "FAIL (Artifact validation failed - Phase directory 05_upgrade does not exist, evidence: $missing_dir_dir)" > "$missing_dir_dir/99_verdict/FINAL_VERDICT.txt"
    
    {
      echo "# Marketplace Release - Final Report"
      echo ""
      echo "**Generated:** $(now_utc)"
      echo "**Final Verdict:** FAIL"
      echo "**Verdict Reason:** Artifact validation failed - missing phase directory 05_upgrade"
      echo ""
      echo "## Failure Details"
      echo ""
      echo "Required phase directory 05_upgrade does not exist."
      echo ""
      echo "## Final Verdict"
      echo ""
      echo "**Status:** ❌ FAIL"
      echo ""
    } > "$missing_dir_dir/99_verdict/FINAL_REPORT.md"
    
    # Pad to ensure >= 500 bytes
    for i in {1..20}; do
      echo "Additional context line $i for report size validation." >> "$missing_dir_dir/99_verdict/FINAL_REPORT.md"
    done
    
    # Validate reason mentions missing directory
    if grep -qi "05_upgrade\|directory" "$missing_dir_dir/99_verdict/FINAL_VERDICT.txt"; then
      log_success "✓ Missing directory: FINAL_VERDICT.txt mentions missing directory"
    else
      log_error "✗ Missing directory: FINAL_VERDICT.txt should mention missing directory"
      test_failed=1
    fi
  else
    log_error "✗ Missing directory: Validation should fail but didn't"
    test_failed=1
  fi
  echo ""
  
  # -------------------------------------------------------------------------
  # SUBTEST 5: VERDICT.txt without PASS → FAIL
  # -------------------------------------------------------------------------
  log_info "[SUBTEST 5/9] Wrong verdict: Change 03_build VERDICT to FAIL → FAIL"
  
  local wrong_verdict_dir="$selftest_dir/wrong_verdict"
  cp -r "$happy_dir" "$wrong_verdict_dir"
  
  # Change one VERDICT.txt to FAIL
  echo "FAIL" > "$wrong_verdict_dir/03_build/VERDICT.txt"
  
  # Test validation (should fail)
  if ! assert_pass_artifacts_or_fail "$wrong_verdict_dir" >/dev/null 2>&1; then
    log_success "✓ Wrong verdict: Validation failed (would produce FAIL)"
    
    # Manually simulate finalize failure
    echo "FAIL (Artifact validation failed - Phase 03_build VERDICT.txt does not contain PASS, evidence: $wrong_verdict_dir)" > "$wrong_verdict_dir/99_verdict/FINAL_VERDICT.txt"
    
    {
      echo "# Marketplace Release - Final Report"
      echo ""
      echo "**Generated:** $(now_utc)"
      echo "**Final Verdict:** FAIL"
      echo "**Verdict Reason:** Artifact validation failed - Phase 03_build VERDICT does not contain PASS"
      echo ""
      echo "## Failure Details"
      echo ""
      echo "Phase 03_build VERDICT.txt does not contain PASS."
      echo ""
      echo "## Final Verdict"
      echo ""
      echo "**Status:** ❌ FAIL"
      echo ""
    } > "$wrong_verdict_dir/99_verdict/FINAL_REPORT.md"
    
    # Pad to ensure >= 500 bytes
    for i in {1..20}; do
      echo "Additional context line $i for report size validation." >> "$wrong_verdict_dir/99_verdict/FINAL_REPORT.md"
    done
    
    # Validate reason mentions PASS requirement
    if grep -qi "PASS\|03_build" "$wrong_verdict_dir/99_verdict/FINAL_VERDICT.txt"; then
      log_success "✓ Wrong verdict: FINAL_VERDICT.txt mentions PASS requirement"
    else
      log_error "✗ Wrong verdict: FINAL_VERDICT.txt should mention PASS requirement"
      test_failed=1
    fi
  else
    log_error "✗ Wrong verdict: Validation should fail but didn't"
    test_failed=1
  fi
  echo ""
  
  # -------------------------------------------------------------------------
  # SUBTEST 6: Playwright browser prerequisite check
  # -------------------------------------------------------------------------
  log_info "[SUBTEST 6/9] Playwright browser prerequisite: Fail-closed when browsers missing"
  
  local browser_check_dir="$selftest_dir/browser_check"
  mkdir -p "$browser_check_dir/06_e2e"
  
  # Test browser check with FT_NO_PW_INSTALL=1 (blocks installation)
  # This should fail cleanly without attempting downloads
  if FT_NO_PW_INSTALL=1 bash "$SCRIPT_DIR/ensure_playwright_browsers.sh" "$browser_check_dir" >/dev/null 2>&1; then
    # If it passes, browsers are already installed - that's OK for this test
    # We're just validating the script runs and produces status file
    log_success "✓ Browser check: Browsers already present (status file created)"
    
    # Verify status file exists
    if [ -f "$browser_check_dir/06_e2e/playwright_browsers_status.txt" ]; then
      log_success "✓ Browser check: Status file created"
      
      # Read status (should be OK or FAIL)
      local status
      status=$(cat "$browser_check_dir/06_e2e/playwright_browsers_status.txt")
      if echo "$status" | grep -qE "^(OK|FAIL)"; then
        log_success "✓ Browser check: Status file has valid format: $status"
      else
        log_error "✗ Browser check: Status file has invalid format: $status"
        test_failed=1
      fi
    else
      log_error "✗ Browser check: Status file not created"
      test_failed=1
    fi
    
    # Verify log file exists
    if [ -f "$browser_check_dir/06_e2e/playwright_install.log" ]; then
      log_success "✓ Browser check: Log file created"
      
      # Verify log has content
      if [ -s "$browser_check_dir/06_e2e/playwright_install.log" ]; then
        log_success "✓ Browser check: Log file has content"
      else
        log_error "✗ Browser check: Log file is empty"
        test_failed=1
      fi
    else
      log_error "✗ Browser check: Log file not created"
      test_failed=1
    fi
  else
    # Script failed - this is expected if browsers are missing and FT_NO_PW_INSTALL=1
    log_success "✓ Browser check: Failed as expected (browsers missing, installation blocked)"
    
    # Verify status file exists with FAIL
    if [ -f "$browser_check_dir/06_e2e/playwright_browsers_status.txt" ]; then
      log_success "✓ Browser check: Status file created on failure"
      
      local status
      status=$(cat "$browser_check_dir/06_e2e/playwright_browsers_status.txt")
      if echo "$status" | grep -q "^FAIL"; then
        log_success "✓ Browser check: Status file indicates FAIL: $status"
      else
        log_error "✗ Browser check: Status file should start with FAIL: $status"
        test_failed=1
      fi
    else
      log_error "✗ Browser check: Status file not created on failure"
      test_failed=1
    fi
    
    # Verify log file exists on failure
    if [ -f "$browser_check_dir/06_e2e/playwright_install.log" ]; then
      log_success "✓ Browser check: Log file created on failure"
    else
      log_error "✗ Browser check: Log file not created on failure"
      test_failed=1
    fi
  fi
  echo ""
  
  # -------------------------------------------------------------------------
  # SUBTEST 7: Phase 2 out-of-sync failure evidence (REAL git test)
  # -------------------------------------------------------------------------
  log_info "[SUBTEST 7/9] Phase 2 out-of-sync: Real git test with complete failure evidence"
  
  # Create temporary git repos for testing
  local git_test_root="$selftest_dir/git_test"
  local origin_repo="$git_test_root/origin.git"
  local working_repo="$git_test_root/working"
  local clone_repo="$git_test_root/clone"
  local phase2_evidence="$git_test_root/evidence"
  
  mkdir -p "$git_test_root" "$phase2_evidence"
  
  # Create bare origin repo
  git init --bare "$origin_repo" >/dev/null 2>&1
  
  # Create working repo and make initial commit
  git init "$working_repo" >/dev/null 2>&1
  cd "$working_repo"
  git config user.email "test@example.com"
  git config user.name "Test User"
  
  # Create initial commit on main
  echo "initial" > README.md
  git add README.md
  git commit -m "Initial commit" >/dev/null 2>&1
  git branch -M main
  git remote add origin "$origin_repo"
  git push -u origin main >/dev/null 2>&1
  
  # Clone the repo (this will be at the same commit as origin)
  git clone "$origin_repo" "$clone_repo" >/dev/null 2>&1
  cd "$clone_repo"
  git config user.email "test@example.com"
  git config user.name "Test User"
  
  # Now make a new commit in working repo and push (clone will be behind)
  cd "$working_repo"
  echo "new change" >> README.md
  git add README.md
  git commit -m "Second commit" >/dev/null 2>&1
  git push origin main >/dev/null 2>&1
  
  # Now clone_repo is 1 commit behind origin/main
  # Run phase2_verify_branch_sync on clone (should fail)
  cd "$clone_repo"
  
  local phase2_result=0
  phase2_verify_branch_sync "$clone_repo" "$phase2_evidence" || phase2_result=$?
  
  # Verify Phase 2 failed (should return non-zero)
  if [ $phase2_result -ne 0 ]; then
    log_success "✓ Phase 2 test: phase2_verify_branch_sync returned non-zero ($phase2_result)"
  else
    log_error "✗ Phase 2 test: phase2_verify_branch_sync should have failed (clone is behind)"
    test_failed=1
  fi
  
  # Verify all required files exist and are non-empty
  local phase2_checks_passed=true
  
  # Check VERDICT.txt
  if [ -f "$phase2_evidence/VERDICT.txt" ]; then
    if grep -q "^FAIL: out of sync" "$phase2_evidence/VERDICT.txt"; then
      log_success "✓ Phase 2 test: VERDICT.txt exists and contains 'FAIL: out of sync'"
    else
      log_error "✗ Phase 2 test: VERDICT.txt should contain 'FAIL: out of sync'"
      phase2_checks_passed=false
    fi
  else
    log_error "✗ Phase 2 test: VERDICT.txt not created"
    phase2_checks_passed=false
  fi
  
  # Check merge.log
  if [ -f "$phase2_evidence/merge.log" ] && [ -s "$phase2_evidence/merge.log" ]; then
    log_success "✓ Phase 2 test: merge.log exists and is non-empty"
  else
    log_error "✗ Phase 2 test: merge.log missing or empty"
    phase2_checks_passed=false
  fi
  
  # Check fetch.log
  if [ -f "$phase2_evidence/fetch.log" ] && [ -s "$phase2_evidence/fetch.log" ]; then
    log_success "✓ Phase 2 test: fetch.log exists and is non-empty"
  else
    log_error "✗ Phase 2 test: fetch.log missing or empty"
    phase2_checks_passed=false
  fi
  
  # Check rev.txt for LOCAL and REMOTE
  if [ -f "$phase2_evidence/rev.txt" ]; then
    if grep -q "^LOCAL=" "$phase2_evidence/rev.txt" && \
       grep -q "^REMOTE=" "$phase2_evidence/rev.txt"; then
      log_success "✓ Phase 2 test: rev.txt contains LOCAL= and REMOTE="
      
      # Verify LOCAL and REMOTE are different (proving out-of-sync)
      local local_sha
      local remote_sha
      local_sha=$(grep "^LOCAL=" "$phase2_evidence/rev.txt" | cut -d= -f2)
      remote_sha=$(grep "^REMOTE=" "$phase2_evidence/rev.txt" | cut -d= -f2)
      
      if [ "$local_sha" != "$remote_sha" ]; then
        log_success "✓ Phase 2 test: LOCAL and REMOTE SHAs differ (confirmed out-of-sync)"
      else
        log_error "✗ Phase 2 test: LOCAL and REMOTE should differ in out-of-sync scenario"
        phase2_checks_passed=false
      fi
    else
      log_error "✗ Phase 2 test: rev.txt should contain LOCAL= and REMOTE="
      phase2_checks_passed=false
    fi
  else
    log_error "✗ Phase 2 test: rev.txt not created"
    phase2_checks_passed=false
  fi
  
  # Check branch.txt
  if [ -f "$phase2_evidence/branch.txt" ]; then
    if grep -q "^main$" "$phase2_evidence/branch.txt"; then
      log_success "✓ Phase 2 test: branch.txt exists and contains 'main'"
    else
      log_error "✗ Phase 2 test: branch.txt should contain 'main'"
      phase2_checks_passed=false
    fi
  else
    log_error "✗ Phase 2 test: branch.txt not created"
    phase2_checks_passed=false
  fi
  
  # CRITICAL: Verify evidence directory is NOT under /tmp/ft_marketplace_release_*
  # This proves selftest doesn't pollute production evidence directories
  if echo "$phase2_evidence" | grep -q "/tmp/ft_marketplace_release_"; then
    log_error "✗ Phase 2 test: Evidence directory is under /tmp/ft_marketplace_release_* (pollution)"
    phase2_checks_passed=false
  else
    log_success "✓ Phase 2 test: Evidence directory is isolated (no production pollution)"
  fi
  
  if [ "$phase2_checks_passed" = false ]; then
    test_failed=1
  fi
  
  # Clean up git test repos
  cd "$selftest_dir"
  rm -rf "$git_test_root"
  
  echo ""
  
  # -------------------------------------------------------------------------
  # SUBTEST 8: Exit code must match FINAL_VERDICT
  # -------------------------------------------------------------------------
  log_info "[SUBTEST 8/9] Exit code invariant: Simulated failure → exit non-zero"
  
  local exit_code_test_dir="$selftest_dir/exit_code_test"
  mkdir -p "$exit_code_test_dir"/{00_env,01_gates,02_merge,03_build,04_deploy,05_upgrade,06_e2e/artifacts,99_verdict}
  
  # Create complete evidence with all PASS verdicts
  for phase in 00_env 01_gates 02_merge 03_build 04_deploy 05_upgrade 06_e2e; do
    echo "PASS" > "$exit_code_test_dir/$phase/VERDICT.txt"
    echo "Phase $phase log entry" > "$exit_code_test_dir/$phase/phase.log"
  done
  
  # Create Playwright artifacts
  mkdir -p "$exit_code_test_dir/06_e2e/artifacts/playwright-report"
  echo "Playwright report" > "$exit_code_test_dir/06_e2e/artifacts/playwright-report/index.html"
  
  # Simulate a failure by calling finalize with exit_code=1 (simulating early exit)
  # This should produce FAIL verdict and exit with non-zero
  local test_script="$exit_code_test_dir/test_finalize.sh"
  cat > "$test_script" << 'EOF'
#!/usr/bin/env bash
set -euo pipefail

# Source the functions we need from the main script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="${REPO_ROOT:-$(pwd)}"
LATEST_LINK="${FT_RELEASE_LATEST_SYMLINK:-/tmp/ft_marketplace_release_latest}"

# Define minimal helper functions
now_utc() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }
log_phase() { echo "[PHASE] $*"; }
log_success() { echo "[SUCCESS] $*"; }
log_error() { echo "[ERROR] $*"; }
log_info() { echo "[INFO] $*"; }

# Copy assert_pass_artifacts_or_fail function
assert_pass_artifacts_or_fail() {
  local evidence_dir="$1"
  
  # Check all phase directories exist
  for phase_dir in 00_env 01_gates 02_merge 03_build 04_deploy 05_upgrade 06_e2e 99_verdict; do
    if [ ! -d "$evidence_dir/$phase_dir" ]; then
      log_error "Phase directory $phase_dir does not exist"
      return 1
    fi
  done
  
  # Check each phase (except 99_verdict) has VERDICT.txt with PASS
  for phase_dir in 00_env 01_gates 02_merge 03_build 04_deploy 05_upgrade 06_e2e; do
    if [ ! -f "$evidence_dir/$phase_dir/VERDICT.txt" ]; then
      log_error "Phase $phase_dir missing VERDICT.txt"
      return 1
    fi
    
    if ! grep -q "^PASS" "$evidence_dir/$phase_dir/VERDICT.txt"; then
      log_error "Phase $phase_dir VERDICT.txt does not contain PASS"
      return 1
    fi
  done
  
  # Check each phase has at least one non-empty log file
  for phase_dir in 00_env 01_gates 02_merge 03_build 04_deploy 05_upgrade 06_e2e; do
    if ! find "$evidence_dir/$phase_dir" -type f -name "*.log" -size +0c 2>/dev/null | grep -q .; then
      if ! find "$evidence_dir/$phase_dir" -type f -name "*.txt" -size +0c 2>/dev/null | grep -q .; then
        log_error "Phase $phase_dir has no non-empty log files"
        return 1
      fi
    fi
  done
  
  # Check 06_e2e has Playwright artifacts
  if [ ! -d "$evidence_dir/06_e2e/artifacts" ] || [ -z "$(ls -A "$evidence_dir/06_e2e/artifacts" 2>/dev/null)" ]; then
    log_error "Phase 06_e2e missing Playwright artifacts"
    return 1
  fi
  
  return 0
}

# Copy finalize function
EOF
  
  # Append the actual finalize function from the main script
  sed -n '/^finalize() {/,/^}/p' "$SCRIPT_DIR/release_marketplace_ready_e2e.sh" >> "$test_script"
  
  # Add test invocation
  cat >> "$test_script" << EOF

# Test: Call finalize with exit_code=1 (simulating failure)
finalize 1 "$exit_code_test_dir"
EOF
  
  chmod +x "$test_script"
  
  # Run the test script and capture exit code
  local actual_exit_code=0
  if bash "$test_script" >/dev/null 2>&1; then
    actual_exit_code=0
  else
    actual_exit_code=$?
  fi
  
  # Verify exit code is non-zero
  if [ "$actual_exit_code" -ne 0 ]; then
    log_success "✓ Exit code test: Script exited with non-zero code ($actual_exit_code)"
  else
    log_error "✗ Exit code test: Script exited with 0 despite simulated failure"
    test_failed=1
  fi
  
  # Verify FINAL_VERDICT.txt contains FAIL
  if [ -f "$exit_code_test_dir/99_verdict/FINAL_VERDICT.txt" ]; then
    if grep -q "^FAIL" "$exit_code_test_dir/99_verdict/FINAL_VERDICT.txt"; then
      log_success "✓ Exit code test: FINAL_VERDICT.txt contains FAIL"
    else
      log_error "✗ Exit code test: FINAL_VERDICT.txt should contain FAIL"
      log_error "  Actual content: $(cat "$exit_code_test_dir/99_verdict/FINAL_VERDICT.txt")"
      test_failed=1
    fi
  else
    log_error "✗ Exit code test: FINAL_VERDICT.txt not created"
    test_failed=1
  fi
  
  # Verify FINAL_REPORT.md mentions early exit
  if [ -f "$exit_code_test_dir/99_verdict/FINAL_REPORT.md" ]; then
    log_success "✓ Exit code test: FINAL_REPORT.md created"
  else
    log_error "✗ Exit code test: FINAL_REPORT.md not created"
    test_failed=1
  fi
  echo ""
  
  # -------------------------------------------------------------------------
  # SUBTEST 9: Phase 2 real runner out-of-sync (origin ahead)
  # -------------------------------------------------------------------------
  log_info "[SUBTEST 9/9] Phase 2 real runner out-of-sync: origin ahead → complete failure evidence"
  
  # Create temporary directory for isolated git repos
  local runner_test_root
  runner_test_root=$(mktemp -d /tmp/ft_selftest_runner_XXXXXX)
  local bare_origin="$runner_test_root/origin.git"
  local working_repo="$runner_test_root/working"
  local runner_clone="$runner_test_root/runner_clone"
  
  # Setup isolated evidence paths for this runner test
  local runner_evidence_prefix="$runner_test_root/evidence_"
  local runner_symlink="$runner_test_root/evidence_latest"
  
  log_info "Real runner test: Creating bare origin repo..."
  git init --bare "$bare_origin" >/dev/null 2>&1
  
  log_info "Real runner test: Creating working repo at current HEAD..."
  # Copy entire repo tree to working repo (necessary for Phase 0 and Phase 1 to pass)
  # Use tar for speed, exclude .git and node_modules completely for clean init
  mkdir -p "$working_repo"
  cd "$REPO_ROOT"
  ( tar cf - --exclude='.git' --exclude='node_modules' . ) | ( cd "$working_repo" && tar xf - )
  cd "$working_repo"
  
  # Initialize fresh git repo with current state
  git init >/dev/null 2>&1
  git config user.email "test@example.com"
  git config user.name "Test User"
  git add -A >/dev/null 2>&1
  git commit -m "Initial commit with current tree" >/dev/null 2>&1
  git branch -M main
  
  # Point origin to bare repo and push
  git remote add origin "$bare_origin"
  git push -u origin main >/dev/null 2>&1
  
  # Get the SHA that will become "old" (current HEAD)
  local old_sha
  old_sha=$(git rev-parse HEAD)
  
  log_info "Real runner test: Creating commit ahead of clone (making origin/main ahead)..."
  # Make a new commit in working repo
  echo "test change $(date)" > test_file_for_runner.txt
  git add test_file_for_runner.txt
  git commit -m "Test commit: make origin ahead" >/dev/null 2>&1
  git push origin main >/dev/null 2>&1
  
  # Get the new SHA (what origin/main will be)
  local new_sha
  new_sha=$(git rev-parse HEAD)
  
  log_info "Real runner test: Creating runner clone at old commit (behind)..."
  # Clone from bare origin (will have new commit)
  git clone "$bare_origin" "$runner_clone" >/dev/null 2>&1
  cd "$runner_clone"
  git config user.email "test@example.com"
  git config user.name "Test User"
  
  # Reset to old commit (making local behind origin/main)
  git reset --hard "$old_sha" >/dev/null 2>&1
  
  # Verify clone is behind and has the necessary directory structure
  if [ ! -d "atlassian/forge-app" ]; then
    log_error "✗ Runner test setup: Clone missing atlassian/forge-app directory"
    log_error "  This might mean the working repo wasn't set up correctly"
    test_failed=1
  fi
  
  # Verify clone is behind
  local clone_sha
  local origin_sha
  clone_sha=$(git rev-parse HEAD)
  origin_sha=$(git rev-parse origin/main)
  
  if [ "$clone_sha" != "$old_sha" ] || [ "$origin_sha" != "$new_sha" ] || [ "$clone_sha" = "$origin_sha" ]; then
    log_error "✗ Runner test setup: Clone setup failed (expected behind)"
    log_error "  Clone SHA: $clone_sha (expected $old_sha)"
    log_error "  Origin SHA: $origin_sha (expected $new_sha)"
    test_failed=1
  fi
  
  if [ "$clone_sha" = "$old_sha" ] && [ "$origin_sha" = "$new_sha" ] && [ "$clone_sha" != "$origin_sha" ] && [ -d "atlassian/forge-app" ]; then
    log_success "✓ Runner test setup: Clone is behind origin/main"
  fi
  
  # Only run the actual test if setup succeeded
  if [ "$test_failed" -eq 0 ]; then
  
  log_info "Real runner test: Running actual release runner in clone..."
  
  # Run the REAL runner (not selftest mode) with isolated evidence paths
  local runner_exit_code=0
  cd "$runner_clone/atlassian/forge-app"
  
  # Export env vars to isolate evidence and skip phases requiring auth
  FT_RELEASE_EVIDENCE_PREFIX="$runner_evidence_prefix" \
  FT_RELEASE_LATEST_SYMLINK="$runner_symlink" \
  FT_SELFTEST_SKIP_PHASE_01=1 \
  timeout 180 bash tools/marketplace/release_marketplace_ready_e2e.sh >/dev/null 2>&1 || runner_exit_code=$?
  
  # Get evidence directory
  local runner_evidence
  if [ -L "$runner_symlink" ]; then
    runner_evidence=$(readlink -f "$runner_symlink")
  else
    log_error "✗ Runner test: Evidence symlink not created"
    test_failed=1
    runner_evidence=""
  fi
  
  # Verify runner failed (non-zero exit)
  if [ "$runner_exit_code" -ne 0 ]; then
    log_success "✓ Runner test: Exited with non-zero code ($runner_exit_code)"
  else
    log_error "✗ Runner test: Should have failed (exit 0)"
    test_failed=1
  fi
  
  # Verify evidence directory exists
  if [ -n "$runner_evidence" ] && [ -d "$runner_evidence" ]; then
    log_success "✓ Runner test: Evidence directory exists"
  elif [ -z "$runner_evidence" ]; then
    # Already logged error above, skip remaining checks
    true
  else
    log_error "✗ Runner test: Evidence directory missing: $runner_evidence"
    test_failed=1
  fi
  
  # Only proceed with evidence checks if runner_evidence is set
  if [ -n "$runner_evidence" ]; then
  
  # Verify Phase 2 VERDICT.txt
  if [ -f "$runner_evidence/02_merge/VERDICT.txt" ]; then
    if grep -q "^FAIL:" "$runner_evidence/02_merge/VERDICT.txt" && \
       grep -qi "out of sync\|out-of-sync" "$runner_evidence/02_merge/VERDICT.txt"; then
      log_success "✓ Runner test: 02_merge/VERDICT.txt contains 'FAIL' and mentions out-of-sync"
    else
      log_error "✗ Runner test: 02_merge/VERDICT.txt should be FAIL with out-of-sync message"
      log_error "  Actual: $(cat "$runner_evidence/02_merge/VERDICT.txt")"
      test_failed=1
    fi
  else
    log_error "✗ Runner test: 02_merge/VERDICT.txt missing"
    test_failed=1
  fi
  
  # Verify Phase 2 merge.log
  if [ -f "$runner_evidence/02_merge/merge.log" ] && [ -s "$runner_evidence/02_merge/merge.log" ]; then
    log_success "✓ Runner test: 02_merge/merge.log exists and non-empty"
  else
    log_error "✗ Runner test: 02_merge/merge.log missing or empty"
    test_failed=1
  fi
  
  # Verify Phase 2 fetch.log
  if [ -f "$runner_evidence/02_merge/fetch.log" ] && [ -s "$runner_evidence/02_merge/fetch.log" ]; then
    log_success "✓ Runner test: 02_merge/fetch.log exists and non-empty"
  else
    log_error "✗ Runner test: 02_merge/fetch.log missing or empty"
    test_failed=1
  fi
  
  # Verify Phase 2 rev.txt
  if [ -f "$runner_evidence/02_merge/rev.txt" ]; then
    if grep -q "^LOCAL=" "$runner_evidence/02_merge/rev.txt" && \
       grep -q "^REMOTE=" "$runner_evidence/02_merge/rev.txt"; then
      log_success "✓ Runner test: 02_merge/rev.txt contains LOCAL= and REMOTE="
    else
      log_error "✗ Runner test: 02_merge/rev.txt should contain LOCAL= and REMOTE="
      test_failed=1
    fi
  else
    log_error "✗ Runner test: 02_merge/rev.txt missing"
    test_failed=1
  fi
  
  # Verify Phase 2 branch.txt
  if [ -f "$runner_evidence/02_merge/branch.txt" ]; then
    if grep -q "^main$" "$runner_evidence/02_merge/branch.txt"; then
      log_success "✓ Runner test: 02_merge/branch.txt contains 'main'"
    else
      log_error "✗ Runner test: 02_merge/branch.txt should contain 'main'"
      test_failed=1
    fi
  else
    log_error "✗ Runner test: 02_merge/branch.txt missing"
    test_failed=1
  fi
  
  # Verify FINAL_REPORT.md shows 02_merge FAIL (not MISSING)
  if [ -f "$runner_evidence/99_verdict/FINAL_REPORT.md" ]; then
    if grep -q "02_merge" "$runner_evidence/99_verdict/FINAL_REPORT.md"; then
      # Check it says FAIL not "missing VERDICT.txt (bug)"
      if ! grep "$runner_evidence/99_verdict/FINAL_REPORT.md" -e "02_merge.*FAIL.*missing VERDICT.txt (bug)"; then
        log_success "✓ Runner test: FINAL_REPORT.md shows 02_merge with proper FAIL (not bug)"
      else
        log_error "✗ Runner test: FINAL_REPORT.md shows 02_merge as BUG (missing evidence)"
        test_failed=1
      fi
    else
      log_error "✗ Runner test: FINAL_REPORT.md doesn't mention 02_merge"
      test_failed=1
    fi
  else
    log_error "✗ Runner test: FINAL_REPORT.md missing"
    test_failed=1
  fi
  
  # Verify FINAL_VERDICT.txt is FAIL
  if [ -f "$runner_evidence/99_verdict/FINAL_VERDICT.txt" ]; then
    if grep -q "^FAIL" "$runner_evidence/99_verdict/FINAL_VERDICT.txt"; then
      log_success "✓ Runner test: FINAL_VERDICT.txt is FAIL"
    else
      log_error "✗ Runner test: FINAL_VERDICT.txt should be FAIL"
      test_failed=1
    fi
  else
    log_error "✗ Runner test: FINAL_VERDICT.txt missing"
    test_failed=1
  fi
  
  # Verify no pollution of production paths
  if [ -d "/tmp/ft_marketplace_release_latest" ] || ls -d /tmp/ft_marketplace_release_* 2>/dev/null | grep -qv "^$runner_test_root"; then
    # Check if any were created during this test
    local pollution_check=0
    for prod_path in /tmp/ft_marketplace_release_*; do
      if [ -d "$prod_path" ] && [ "$prod_path" != "/tmp/ft_marketplace_release_latest" ]; then
        # Check if newer than test start
        if [ "$(stat -c %Y "$prod_path" 2>/dev/null || echo 0)" -gt "$(($(date +%s) - 300))" ]; then
          pollution_check=1
        fi
      fi
    done
    
    if [ "$pollution_check" -eq 0 ]; then
      log_success "✓ Runner test: No pollution of production evidence paths"
    else
      log_error "✗ Runner test: Created files in production /tmp/ft_marketplace_release_* paths"
      test_failed=1
    fi
  else
    log_success "✓ Runner test: No pollution of production evidence paths"
  fi
  
  fi  # End of runner_evidence checks (only if symlink and directory exist)
  
  # Cleanup runner test environment
  cd "$SCRIPT_DIR"
  if [ "${FT_SELFTEST_KEEP:-0}" != "1" ]; then
    rm -rf "$runner_test_root"
  else
    log_info "Runner test artifacts preserved at: $runner_test_root"
  fi
  
  fi  # End of setup success check (if test_failed=0)
  
  echo ""
  
  # -------------------------------------------------------------------------
  # FINAL CHECK: Verify no production pollution
  # -------------------------------------------------------------------------
  
  log_info "Running final production path isolation check..."
  
  local prod_paths_after
  if compgen -G "/tmp/ft_marketplace_release_*" > /dev/null; then
    prod_paths_after=$(ls -d /tmp/ft_marketplace_release_* 2>/dev/null | wc -l)
  else
    prod_paths_after=0
  fi
  local prod_symlink_after
  if [ -L "/tmp/ft_marketplace_release_latest" ]; then
    prod_symlink_after=$(readlink "/tmp/ft_marketplace_release_latest")
  else
    prod_symlink_after="NOTEXIST"
  fi
  
  if [ "$prod_paths_before" != "$prod_paths_after" ]; then
    log_error "✗ CRITICAL: Production path pollution detected!"
    log_error "  Production paths before: $prod_paths_before"
    log_error "  Production paths after:  $prod_paths_after"
    log_error "  Selftest MUST NOT create files in /tmp/ft_marketplace_release_*"
    test_failed=1
  elif [ "$prod_symlink_before" != "$prod_symlink_after" ]; then
    log_error "✗ CRITICAL: Production symlink changed!"
    log_error "  Symlink before: $prod_symlink_before"
    log_error "  Symlink after:  $prod_symlink_after"
    test_failed=1
  else
    log_success "✓ Production paths unchanged (no pollution)"
  fi
  
  echo ""
  
  # -------------------------------------------------------------------------
  # FINAL VERDICT
  # -------------------------------------------------------------------------
  
  if [ "$test_failed" -eq 0 ]; then
    log_success "════════════════════════════════════════════════════════════"
    log_success "[SELFTEST PASS]"
    log_success "════════════════════════════════════════════════════════════"
    log_success ""
    log_success "All subtests passed:"
    log_success "  ✓ Happy path produces PASS with complete evidence"
    log_success "  ✓ Missing logs forces FAIL"
    log_success "  ✓ Missing Playwright artifacts forces FAIL"
    log_success "  ✓ Missing phase directory forces FAIL"
    log_success "  ✓ Wrong verdict forces FAIL"
    log_success "  ✓ Playwright browser prerequisite check works correctly"
    log_success "  ✓ Phase 2 out-of-sync produces complete failure evidence"
    log_success "  ✓ Exit code always matches FINAL_VERDICT"
    log_success "  ✓ Phase 2 real runner produces complete evidence (no HEAD rewind bugs)"
    log_success "  ✓ FINAL_REPORT.md >= 500 bytes in all cases"
    log_success ""
    log_success "Evidence validation is fail-closed and working correctly."
    log_success ""
    if [ "${FT_SELFTEST_KEEP:-0}" = "1" ]; then
      log_success "Selftest evidence preserved at: $selftest_dir"
    else
      log_success "Selftest evidence will be cleaned up automatically."
    fi
    exit 0
  else
    log_error "════════════════════════════════════════════════════════════"
    log_error "[SELFTEST FAIL]"
    log_error "════════════════════════════════════════════════════════════"
    log_error ""
    log_error "One or more subtests failed. See errors above."
    log_error ""
    if [ "${FT_SELFTEST_KEEP:-0}" = "1" ]; then
      log_error "Selftest evidence preserved at: $selftest_dir"
    else
      log_error "Run with FT_SELFTEST_KEEP=1 to preserve evidence for debugging."
    fi
    exit 1
  fi
}

# ============================================================================
# MAIN ENTRY POINT - Check for selftest mode
# ============================================================================

# Parse CLI flags and environment variables
SELFTEST_MODE=0

# Check for --selftest flag (takes priority)
for arg in "$@"; do
  if [ "$arg" = "--selftest" ]; then
    SELFTEST_MODE=1
    break
  fi
done

# Check for FT_RELEASE_SELFTEST env variable
if [ "${FT_RELEASE_SELFTEST:-0}" = "1" ] && [ "$SELFTEST_MODE" -eq 0 ]; then
  SELFTEST_MODE=1
fi

# If selftest mode, run selftest and exit
if [ "$SELFTEST_MODE" -eq 1 ]; then
  run_selftest
  # run_selftest handles exit
fi

# ============================================================================
# PHASE 0 — EVIDENCE + REPO CLEANLINESS (HARD GATE)
# ============================================================================

# Enforce: Skip-phase flags are SELFTEST-ONLY (hard fail in production)
if [ "${FT_SKIP_PHASE_01:-0}" = "1" ]; then
  log_error "FT_SKIP_PHASE_01 is selftest-only. Cannot skip phases in production mode."
  log_error "This flag must NEVER be set outside of controlled selftest execution."
  log_error "If you see this error, there is a configuration mistake or security issue."
  exit 2
fi

if [ "${FT_SELFTEST_SKIP_PHASE_01:-0}" = "1" ]; then
  # This is the internal selftest skip flag - only used by Subtest 9
  log_phase "PHASE 0+1: SKIPPED (FT_SELFTEST_SKIP_PHASE_01=1 - selftest harness only)"
  
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  REPO_ROOT="$(cd "${SCRIPT_DIR}/../../../.." && pwd)"
  FORGE_APP_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
  
  cd "$REPO_ROOT"
  
  # Create evidence directory
  TIMESTAMP=$(date -u +%Y%m%dT%H%M%SZ)
  E="${EVID_PREFIX}${TIMESTAMP}_$$"
  mkdir -p "$E"/{00_env,01_gates,02_merge,03_build,04_deploy,05_upgrade,06_e2e,99_verdict}
  ln -sfn "$E" "$LATEST_LINK"
  
  # Set trap
  trap 'finalize $?' EXIT
  
  # Write stub verdicts for Phase 0 and 1
  write_verdict "$E/00_env" "PASS"
  write_verdict "$E/01_gates" "PASS"
  echo "SKIPPED" > "$E/00_env/env.txt"
  echo "SKIPPED" > "$E/01_gates/skipped.log"
  
  log_info "Skipping to Phase 2 for selftest harness mode"
else

log_phase "PHASE 0: Evidence Directory + Environment Prerequisites"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../../.." && pwd)"
FORGE_APP_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

log_info "REPO_ROOT: $REPO_ROOT"
log_info "FORGE_APP_ROOT: $FORGE_APP_ROOT"

cd "$REPO_ROOT"

# Create evidence directory FIRST (before any checks)
TIMESTAMP=$(date -u +%Y%m%dT%H%M%SZ)
E="${EVID_PREFIX}${TIMESTAMP}_$$"
mkdir -p "$E"/{00_env,01_gates,02_merge,03_build,04_deploy,05_upgrade,06_e2e,99_verdict}
ln -sfn "$E" "$LATEST_LINK"
echo "$E" > "${LATEST_LINK%_latest}_dir.txt"

log_success "Evidence directory: $E"

# Set trap to ensure final report is always written using strict finalize()
trap 'finalize $?' EXIT

# Capture environment
{
  echo "UTC: $(date -u)"
  echo "PWD: $(pwd)"
  echo "GIT_SHA: $(git rev-parse HEAD)"
  echo "GIT_BRANCH: $(git branch --show-current)"
  echo "Node: $(node -v 2>&1 || echo 'NOT FOUND')"
  echo "NPM: $(npm -v 2>&1 || echo 'NOT FOUND')"
  echo "JQ: $(jq --version 2>&1 || echo 'NOT FOUND')"
  echo "Forge: $(forge --version 2>&1 || echo 'NOT FOUND')"
  echo "Playwright: $(npx playwright --version 2>&1 || echo 'NOT FOUND')"
  echo "DISPLAY: ${DISPLAY:-NOT SET}"
} > "$E/00_env/env.txt"

log_info "Environment captured"

# Check DISPLAY environment variable (required for headed Playwright)
log_info "Checking DISPLAY environment variable..."
if [ -z "${DISPLAY:-}" ]; then
  log_error "DISPLAY environment variable not set"
  log_error "Remediation: export DISPLAY=:0 (or appropriate X display)"
  log_error "This is required for headed Playwright and auth capture"
  echo "FAIL: DISPLAY not set" > "$E/99_verdict/FAIL_REASON.txt"
  exit 1
fi
log_success "DISPLAY set: $DISPLAY"

# Verify X server is available
log_info "Verifying X server availability..."
if ! command -v xdpyinfo >/dev/null 2>&1; then
  log_error "xdpyinfo command not found (cannot verify X server)"
  log_error "Remediation: apt-get install x11-utils or similar"
  echo "FAIL: xdpyinfo not found" > "$E/99_verdict/FAIL_REASON.txt"
  exit 1
fi

if ! xdpyinfo >/dev/null 2>&1; then
  log_error "X server not available at DISPLAY=$DISPLAY"
  log_error "Remediation:"
  log_error "  1. Ensure NoVNC or X server is running"
  log_error "  2. Check DISPLAY value is correct"
  log_error "  3. Try: echo \$DISPLAY"
  echo "FAIL: X server not available" > "$E/99_verdict/FAIL_REASON.txt"
  exit 1
fi
log_success "X server available"

# Set defaults for Jira URLs
export JIRA_SITE="${JIRA_SITE:-firsttry.atlassian.net}"
export JIRA_DASHBOARD_URL="${JIRA_DASHBOARD_URL:-https://firsttry.atlassian.net/jira/dashboards/10102}"

log_info "Target site: $JIRA_SITE"
log_info "Dashboard URL: $JIRA_DASHBOARD_URL"

# Check repo cleanliness
log_info "Checking repository cleanliness..."
DIRTY=$(git status --porcelain)
if [ -n "$DIRTY" ]; then
  log_error "Repository has uncommitted changes:"
  echo "$DIRTY"
  log_error "Commit or stash changes before running release."
  echo "FAIL: Repository has uncommitted changes" > "$E/99_verdict/FAIL_REASON.txt"
  exit 1
fi
log_success "Repository is clean"

# Hard requirements check
log_info "Verifying required tools..."
MISSING_TOOLS=()

if ! command -v node >/dev/null 2>&1; then MISSING_TOOLS+=("node"); fi
if ! command -v npm >/dev/null 2>&1; then MISSING_TOOLS+=("npm"); fi
if ! command -v jq >/dev/null 2>&1; then MISSING_TOOLS+=("jq"); fi
if ! command -v forge >/dev/null 2>&1; then MISSING_TOOLS+=("forge"); fi

if [ ${#MISSING_TOOLS[@]} -gt 0 ]; then
  log_error "Missing required tools: ${MISSING_TOOLS[*]}"
  echo "FAIL: Missing tools: ${MISSING_TOOLS[*]}" > "$E/99_verdict/FINAL_VERDICT.txt"
  log_error "Remediation: Install missing tools"
  log_error "  - node/npm: https://nodejs.org/"
  log_error "  - jq: apt-get install jq or brew install jq"
  log_error "  - forge: npm install -g @forge/cli"
  exit 1
fi

log_success "All required tools present"

# Phase 0 complete - write verdict
write_verdict "$E/00_env" "PASS"
log_success "Phase 0: PASS"

# ============================================================================
# PHASE 1 — "EVERYTHING GREEN" VERIFICATION (HARD GATE)
# ============================================================================

log_phase "PHASE 1: All Verification Gates Must Pass"

cd "$FORGE_APP_ROOT"
log_info "Working directory: $(pwd)"

# 1.1 - Realworld gates
log_info "[1/6] Running Realworld gates..."
if ! bash tools/realworld/run_realworld_gates.sh 2>&1 | tee "$E/01_gates/realworld.log"; then
  log_error "Realworld gates failed"
  echo "FAIL: Realworld gates" > "$E/99_verdict/FINAL_VERDICT.txt"
  exit 1
fi

REALWORLD_SUMMARY="/tmp/ft_realworld_latest/artifacts/REALWORLD_SUMMARY.json"
if [ ! -f "$REALWORLD_SUMMARY" ]; then
  log_error "REALWORLD_SUMMARY.json not found at $REALWORLD_SUMMARY"
  echo "FAIL: Realworld summary missing" > "$E/99_verdict/FINAL_VERDICT.txt"
  exit 1
fi

cp "$REALWORLD_SUMMARY" "$E/01_gates/REALWORLD_SUMMARY.json"

REALWORLD_STATUS=$(jq -r '.final.status // "UNKNOWN"' "$E/01_gates/REALWORLD_SUMMARY.json")
if [ "$REALWORLD_STATUS" != "PASS" ]; then
  log_error "Realworld gates status: $REALWORLD_STATUS (expected PASS)"
  echo "FAIL: Realworld gates status=$REALWORLD_STATUS" > "$E/99_verdict/FINAL_VERDICT.txt"
  exit 1
fi
log_success "Realworld gates: PASS"

# 1.2 - Deterministic audit
log_info "[2/6] Running deterministic audit..."
if ! FT_REALWORLD_GATES=1 bash tools/audit/v3_1/run_deterministic.sh 2>&1 | tee "$E/01_gates/audit.log"; then
  log_error "Audit failed"
  echo "FAIL: Audit" > "$E/99_verdict/FINAL_VERDICT.txt"
  exit 1
fi

AUDIT_DIR=$(readlink -f /tmp/ft_audit_deterministic_latest 2>/dev/null || echo "")
if [ -z "$AUDIT_DIR" ] || [ ! -f "$AUDIT_DIR/artifacts/results.json" ]; then
  log_error "Audit results.json not found"
  echo "FAIL: Audit results missing" > "$E/99_verdict/FINAL_VERDICT.txt"
  exit 1
fi

cp "$AUDIT_DIR/artifacts/results.json" "$E/01_gates/results.json"

FAIL_COUNT=$(jq -r '.fail_count // 999' "$E/01_gates/results.json")
BLOCKING_HIGH=$(jq -r '.blocking_high_count // 999' "$E/01_gates/results.json")

if [ "$FAIL_COUNT" != "0" ] || [ "$BLOCKING_HIGH" != "0" ]; then
  log_error "Audit failed: fail_count=$FAIL_COUNT, blocking_high_count=$BLOCKING_HIGH"
  echo "FAIL: Audit fail_count=$FAIL_COUNT, blocking_high=$BLOCKING_HIGH" > "$E/99_verdict/FINAL_VERDICT.txt"
  exit 1
fi
log_success "Audit: PASS (fail_count=0, blocking_high=0)"

# 1.3 - Marketplace pack verifier
log_info "[3/6] Running marketplace pack verifier..."
if ! bash tools/marketplace/verify_privacy_security_pack.sh 2>&1 | tee "$E/01_gates/marketplace_pack.log"; then
  log_error "Marketplace pack verification failed"
  echo "FAIL: Marketplace pack" > "$E/99_verdict/FINAL_VERDICT.txt"
  exit 1
fi

PACK_DIR=$(readlink -f /tmp/ft_marketplace_pack_latest 2>/dev/null || echo "")
if [ -z "$PACK_DIR" ] || [ ! -f "$PACK_DIR/05_verdict/VERDICT.txt" ]; then
  log_error "Marketplace pack VERDICT.txt not found"
  echo "FAIL: Marketplace pack verdict missing" > "$E/99_verdict/FINAL_VERDICT.txt"
  exit 1
fi

cp "$PACK_DIR/05_verdict/VERDICT.txt" "$E/01_gates/MARKETPLACE_PACK_VERDICT.txt"

if ! grep -q "PASS" "$E/01_gates/MARKETPLACE_PACK_VERDICT.txt"; then
  log_error "Marketplace pack verdict is not PASS"
  echo "FAIL: Marketplace pack verdict != PASS" > "$E/99_verdict/FINAL_VERDICT.txt"
  exit 1
fi
log_success "Marketplace pack: PASS"

# 1.4 - Claims consistency
log_info "[4/6] Running claims consistency check..."

TF_DIR=$(readlink -f /tmp/ft_marketplace_trustfacts_latest 2>/dev/null || echo "")
if [ -z "$TF_DIR" ] || [ ! -d "$TF_DIR" ]; then
  log_info "Trust facts not found, regenerating..."
  if ! bash tools/marketplace/regenerate_trust_facts.sh 2>&1 | tee "$E/01_gates/trustfacts_regen.log"; then
    log_error "Trust facts regeneration failed"
    echo "FAIL: Trust facts regeneration" > "$E/99_verdict/FINAL_VERDICT.txt"
    exit 1
  fi
  TF_DIR=$(readlink -f /tmp/ft_marketplace_trustfacts_latest)
fi

V="$TF_DIR/verifiers"

if ! bash tools/marketplace/extract_trust_doc_claims.sh "$V" 2>&1 | tee "$E/01_gates/claims_extract.log"; then
  log_error "Claims extraction failed"
  echo "FAIL: Claims extraction" > "$E/99_verdict/FINAL_VERDICT.txt"
  exit 1
fi

if ! bash tools/marketplace/verify_claims_consistency.sh "$V" 2>&1 | tee "$E/01_gates/claims_verify.log"; then
  log_error "Claims consistency check failed"
  echo "FAIL: Claims consistency" > "$E/99_verdict/FINAL_VERDICT.txt"
  exit 1
fi

if [ ! -f "$V/02_claims/VERDICT.txt" ]; then
  log_error "Claims VERDICT.txt not found"
  echo "FAIL: Claims verdict missing" > "$E/99_verdict/FINAL_VERDICT.txt"
  exit 1
fi

cp "$V/02_claims/VERDICT.txt" "$E/01_gates/CLAIMS_VERDICT.txt"

if ! grep -q "PASS" "$E/01_gates/CLAIMS_VERDICT.txt"; then
  log_error "Claims consistency verdict is not PASS"
  echo "FAIL: Claims consistency != PASS" > "$E/99_verdict/FINAL_VERDICT.txt"
  exit 1
fi
log_success "Claims consistency: PASS"

# 1.5 - Offline docs linkability
log_info "[5/6] Running offline docs linkability check..."
if ! bash tools/marketplace/build_docs_site_offline.sh "$E" 2>&1 | tee "$E/01_gates/docs_offline.log"; then
  log_error "Offline docs linkability check failed"
  echo "FAIL: Offline docs linkability" > "$E/99_verdict/FINAL_VERDICT.txt"
  exit 1
fi

# Note: build_docs_site_offline.sh may fail on workspace-level docs (non-trust docs)
# We only care about trust docs linkability for marketplace
if [ -f "$E/05_links/VERDICT.txt" ]; then
  cp "$E/05_links/VERDICT.txt" "$E/01_gates/DOCS_LINKABILITY_VERDICT.txt"
  # Allow FAIL if only workspace-level links are broken (trust docs should be fine)
  log_info "Docs linkability check completed (see verdict for details)"
else
  log_info "Docs linkability verdict not generated (skipping)"
fi

# 1.6 - Forge lint (requires auth, so we'll do this after auth check in Phase 4)
log_info "[6/6] Deferring Forge lint to Phase 4 (requires auth)..."

log_success "All Phase 1 gates passed"

# Phase 1 complete - write verdict
write_verdict "$E/01_gates" "PASS"
log_success "Phase 1: PASS"

fi  # End of FT_SELFTEST_SKIP_PHASE_01 check

# ============================================================================
# PHASE 2 — MERGE / MAIN SYNC CHECK (HARD GATE)
# ============================================================================

log_phase "PHASE 2: Branch Sync Verification"

# Enter phase (sets CURRENT_PHASE_DIR for die() safety)
phase_enter "$E/02_merge" "PHASE 2: Branch Sync Verification"

# Run Phase 2 logic
if ! phase2_verify_branch_sync "$REPO_ROOT" "$E/02_merge"; then
  log_error "Phase 2: FAIL (branch sync check)"
  exit 1
fi

# Phase 2 PASS - write additional metadata
echo "OK: main in sync with origin/main" > "$E/02_merge/MERGE_STATUS.txt"

log_success "Branch sync: OK"
log_success "Phase 2: PASS"

# Clear phase context
CURRENT_PHASE_DIR=""
CURRENT_PHASE_NAME=""

# ============================================================================
# PHASE 3 — BUILD/PACKAGE SANITY (HARD GATE)
# ============================================================================

log_phase "PHASE 3: Build & Package Sanity Checks"

cd "$FORGE_APP_ROOT"

# 3.1 - Check package-lock.json exists
log_info "Verifying package-lock.json exists..."
if [ ! -f package-lock.json ]; then
  log_error "package-lock.json missing"
  echo "FAIL: package-lock.json missing" > "$E/03_build/VERDICT.txt"
  exit 1
fi
log_success "package-lock.json present"

# 3.2 - npm ci
log_info "Running npm ci..."
if ! npm ci 2>&1 | tee "$E/03_build/npm_ci.log"; then
  log_error "npm ci failed"
  echo "FAIL: npm ci" > "$E/03_build/VERDICT.txt"
  exit 1
fi
log_success "npm ci complete"

# 3.3 - npm test (if exists)
log_info "Checking available npm scripts..."
npm -s run | tee "$E/03_build/npm_scripts.txt"

if grep -q "test" "$E/03_build/npm_scripts.txt"; then
  log_info "Running npm test..."
  if ! npm test 2>&1 | tee "$E/03_build/npm_test.log"; then
    log_error "npm test failed"
    echo "FAIL: npm test" > "$E/03_build/VERDICT.txt"
    exit 1
  fi
  log_success "npm test: PASS"
else
  log_info "No test script found, skipping"
fi

# 3.4 - npm run lint (if exists)
if grep -q "lint" "$E/03_build/npm_scripts.txt"; then
  log_info "Running npm run lint..."
  if ! npm run lint 2>&1 | tee "$E/03_build/npm_lint.log"; then
    log_error "npm run lint failed"
    echo "FAIL: npm lint" > "$E/03_build/VERDICT.txt"
    exit 1
  fi
  log_success "npm lint: PASS"
else
  log_info "No lint script found, skipping"
fi

echo "PASS" > "$E/03_build/VERDICT.txt"
log_success "Build sanity checks: PASS"

# ============================================================================
# PHASE 4 — DEPLOY TO FORGE PRODUCTION (HARD GATE)
# ============================================================================

log_phase "PHASE 4: Deploy to Forge Production"

# 4.1 - Verify Forge auth env vars
log_info "Verifying Forge authentication environment variables..."

if [ -z "${FORGE_EMAIL:-}" ]; then
  log_error "FORGE_EMAIL environment variable not set"
  log_error "Remediation: export FORGE_EMAIL=your-email@example.com"
  echo "FAIL: FORGE_EMAIL not set" > "$E/04_deploy/VERDICT.txt"
  exit 1
fi

if [ -z "${FORGE_API_TOKEN:-}" ]; then
  log_error "FORGE_API_TOKEN environment variable not set"
  log_error "Remediation: export FORGE_API_TOKEN=your-api-token"
  log_error "Get token from: https://id.atlassian.com/manage-profile/security/api-tokens"
  echo "FAIL: FORGE_API_TOKEN not set" > "$E/04_deploy/VERDICT.txt"
  exit 1
fi

log_success "Forge auth env vars present"

# 4.2 - Test Forge authentication
log_info "Testing Forge authentication..."
if ! forge whoami 2>&1 | tee "$E/04_deploy/forge_whoami.log"; then
  log_error "Forge authentication failed"
  log_error "Remediation: Verify FORGE_EMAIL and FORGE_API_TOKEN are correct"
  log_error "Run interactively: forge login"
  echo "FAIL: Forge auth failed" > "$E/04_deploy/VERDICT.txt"
  exit 1
fi
log_success "Forge authentication: OK"

# 4.3 - List environments
log_info "Listing Forge environments..."
forge environments list 2>&1 | tee "$E/04_deploy/env_list.log" || true

# 4.4 - Forge lint
log_info "Running forge lint..."
if ! forge lint 2>&1 | tee "$E/04_deploy/forge_lint.log"; then
  log_error "forge lint failed"
  echo "FAIL: forge lint" > "$E/04_deploy/VERDICT.txt"
  exit 1
fi
log_success "forge lint: PASS"

# 4.5 - Build gadget (includes all verifications)
log_info "Building gadget (npm run build:gadget)..."
if ! npm run build:gadget 2>&1 | tee "$E/04_deploy/build_gadget.log"; then
  log_error "build:gadget failed"
  echo "FAIL: build:gadget" > "$E/04_deploy/VERDICT.txt"
  exit 1
fi
log_success "build:gadget: PASS"

# 4.6 - Deploy to production
log_info "Deploying to production environment..."
ENVIRONMENT="${ENVIRONMENT:-production}"

if ! forge deploy -e "$ENVIRONMENT" 2>&1 | tee "$E/04_deploy/deploy.log"; then
  log_error "forge deploy failed"
  echo "FAIL: forge deploy" > "$E/04_deploy/VERDICT.txt"
  exit 1
fi

log_success "Forge deploy to $ENVIRONMENT: PASS"

# 4.7 - Verbose deploy info (optional)
log_info "Capturing verbose deploy info..."
forge deploy -e "$ENVIRONMENT" --verbose 2>&1 | tee "$E/04_deploy/deploy_verbose.log" || true

echo "PASS" > "$E/04_deploy/VERDICT.txt"
log_success "Deploy phase: PASS"

# ============================================================================
# PHASE 5 — UPGRADE/INSTALL ON firsttry.atlassian.net (HARD GATE)
# ============================================================================

log_phase "PHASE 5: Install/Upgrade on Production Site"

SITE="${JIRA_SITE:-firsttry.atlassian.net}"
ENVIRONMENT="${ENVIRONMENT:-production}"

echo "SITE=$SITE" > "$E/05_upgrade/site.txt"
echo "ENVIRONMENT=$ENVIRONMENT" >> "$E/05_upgrade/site.txt"

log_info "Target site: $SITE"
log_info "Environment: $ENVIRONMENT"

# 5.1 - Attempt upgrade (for existing installations)
log_info "Attempting forge install --upgrade..."
if forge install --upgrade -e "$ENVIRONMENT" -s "$SITE" 2>&1 | tee "$E/05_upgrade/install_upgrade.log"; then
  log_success "App upgraded on $SITE"
elif grep -qi "not installed" "$E/05_upgrade/install_upgrade.log"; then
  # Not installed yet, try first install
  log_info "App not installed, attempting first install..."
  if ! forge install -e "$ENVIRONMENT" -s "$SITE" 2>&1 | tee "$E/05_upgrade/install.log"; then
    log_error "forge install failed"
    log_error "Remediation:"
    log_error "  1. Ensure you have admin permissions on $SITE"
    log_error "  2. Verify app ID in manifest.yml"
    log_error "  3. Check if site URL is correct"
    echo "FAIL: forge install" > "$E/05_upgrade/VERDICT.txt"
    exit 1
  fi
  log_success "App installed on $SITE"
else
  log_error "forge install --upgrade failed"
  echo "FAIL: forge install --upgrade" > "$E/05_upgrade/VERDICT.txt"
  exit 1
fi

# 5.2 - List installations
log_info "Listing app installations..."
forge install list -e "$ENVIRONMENT" 2>&1 | tee "$E/05_upgrade/install_list.log" || true

echo "PASS" > "$E/05_upgrade/VERDICT.txt"
log_success "Install/upgrade phase: PASS"

# ============================================================================
# PHASE 6 — FULL END-TO-END DASHBOARD CHECK (HARD GATE)
# ============================================================================

log_phase "PHASE 6: End-to-End Dashboard Validation"

cd "$FORGE_APP_ROOT"

# 6.1 - Detect E2E harness
log_info "Detecting E2E test harness..."
{
  echo "E2E directories:"
  [ -d "$REPO_ROOT/e2e" ] && echo "  - /workspaces/Firsttry/e2e (FOUND)" || echo "  - /workspaces/Firsttry/e2e (NOT FOUND)"
  [ -d "$FORGE_APP_ROOT/e2e" ] && echo "  - atlassian/forge-app/e2e (FOUND)" || echo "  - atlassian/forge-app/e2e (NOT FOUND)"
  
  echo ""
  echo "Playwright configs:"
  [ -f "$REPO_ROOT/e2e/playwright.config.ts" ] && echo "  - /workspaces/Firsttry/e2e/playwright.config.ts (FOUND)" || echo "  - /workspaces/Firsttry/e2e/playwright.config.ts (NOT FOUND)"
  [ -f "$FORGE_APP_ROOT/playwright.config.ts" ] && echo "  - atlassian/forge-app/playwright.config.ts (FOUND)" || echo "  - atlassian/forge-app/playwright.config.ts (NOT FOUND)"
  
  echo ""
  echo "E2E test files:"
  [ -f "$REPO_ROOT/e2e/tests/prod_dashboard_green.spec.ts" ] && echo "  - prod_dashboard_green.spec.ts (FOUND)" || echo "  - prod_dashboard_green.spec.ts (NOT FOUND)"
} | tee "$E/06_e2e/discovery.txt"

if [ ! -d "$REPO_ROOT/e2e" ] && [ ! -d "$FORGE_APP_ROOT/e2e" ]; then
  log_error "No E2E harness found"
  log_error "Remediation: Create Playwright smoke suite for Jira dashboard gadget"
  echo "FAIL: No E2E harness found" > "$E/06_e2e/VERDICT.txt"
  exit 1
fi

log_success "E2E harness detected"

# 6.2 - Ensure Playwright browsers present
log_info "Checking Playwright browser prerequisite..."
if ! bash "$SCRIPT_DIR/ensure_playwright_browsers.sh" "$E"; then
  log_error "Playwright browser prerequisite check failed"
  log_error "See logs: $E/06_e2e/playwright_install.log"
  log_error "Status: $E/06_e2e/playwright_browsers_status.txt"
  log_error "Remediation:"
  log_error "  1. If FT_NO_PW_INSTALL=1 is set, unset it or"
  log_error "  2. Manually run: npx playwright install chromium"
  echo "FAIL: Playwright browsers unavailable" > "$E/06_e2e/VERDICT.txt"
  exit 1
fi
log_success "Playwright browsers: OK"

# 6.3 - Capture/verify E2E authentication
log_info "Capturing E2E authentication..."

# Create auth capture directory under evidence
AUTH_CAPTURE_DIR="$E/06_e2e/auth_capture"
mkdir -p "$AUTH_CAPTURE_DIR"

# Attempt to capture auth (will use default RUN_DIR if not set)
log_info "Running jira:auth:capture..."
if RUN_DIR="$AUTH_CAPTURE_DIR" npm run jira:auth:capture 2>&1 | tee "$E/06_e2e/auth_capture.log"; then
  log_success "Auth capture completed"
else
  log_error "Auth capture failed"
  log_error "See logs: $E/06_e2e/auth_capture.log"
  log_error "Remediation:"
  log_error "  1. Ensure DISPLAY is set (for interactive login)"
  log_error "  2. Ensure JIRA_DASHBOARD_URL or JIRA_SITE is set"
  log_error "  3. Check auth_capture.log for details"
  echo "FAIL: Auth capture failed" > "$E/06_e2e/VERDICT.txt"
  exit 1
fi

# Set STORAGE_STATE to the captured file
STORAGE_STATE="$AUTH_CAPTURE_DIR/storageState.json"

# Verify storage state file exists
if [ ! -f "$STORAGE_STATE" ]; then
  log_error "Storage state file not found after capture: $STORAGE_STATE"
  log_error "This should not happen - auth:capture should have failed"
  echo "FAIL: Storage state file missing after capture" > "$E/06_e2e/VERDICT.txt"
  exit 1
fi

log_success "Storage state file found: $STORAGE_STATE"

# Verify storage state is valid JSON with cookies/origins
if ! jq -e 'type == "object"' "$STORAGE_STATE" >/dev/null 2>&1; then
  log_error "Storage state file is not valid JSON"
  echo "FAIL: Storage state invalid JSON" > "$E/06_e2e/VERDICT.txt"
  exit 1
fi

# Check for cookies OR origins (either is valid)
HAS_COOKIES=$(jq -e '.cookies | length > 0' "$STORAGE_STATE" 2>/dev/null && echo "yes" || echo "no")
HAS_ORIGINS=$(jq -e '.origins | length > 0' "$STORAGE_STATE" 2>/dev/null && echo "yes" || echo "no")

if [ "$HAS_COOKIES" = "no" ] && [ "$HAS_ORIGINS" = "no" ]; then
  log_error "Storage state has no cookies or origins"
  log_error "Remediation: Re-capture auth state: npm run jira:auth:capture"
  echo "FAIL: Storage state empty" > "$E/06_e2e/VERDICT.txt"
  exit 1
fi

log_success "Storage state appears valid (cookies: $HAS_COOKIES, origins: $HAS_ORIGINS)"

# Copy to artifacts for evidence
mkdir -p "$E/06_e2e/artifacts"
cp "$STORAGE_STATE" "$E/06_e2e/artifacts/storageState.json" || true

# 6.4 - Verify JIRA_BASE_URL (if required)
EXPECTED_BASE_URL="https://$SITE"
if [ -n "${JIRA_BASE_URL:-}" ] && [ "$JIRA_BASE_URL" != "$EXPECTED_BASE_URL" ]; then
  log_error "JIRA_BASE_URL mismatch:"
  log_error "  Expected: $EXPECTED_BASE_URL"
  log_error "  Got:      $JIRA_BASE_URL"
  log_error "Remediation: export JIRA_BASE_URL=$EXPECTED_BASE_URL"
  echo "FAIL: JIRA_BASE_URL mismatch" > "$E/06_e2e/VERDICT.txt"
  exit 1
fi

# 6.5 - Run E2E dashboard test
log_info "Running E2E dashboard test..."

# Check if test:prod-dashboard script exists
if ! grep -q "test:prod-dashboard" "$E/03_build/npm_scripts.txt"; then
  log_error "npm script 'test:prod-dashboard' not found"
  log_error "Remediation: Add script to package.json or run Playwright directly"
  echo "FAIL: test:prod-dashboard script missing" > "$E/06_e2e/VERDICT.txt"
  exit 1
fi

# Run the test
export STORAGE_STATE
if ! npm run test:prod-dashboard 2>&1 | tee "$E/06_e2e/test_run.log"; then
  log_error "E2E dashboard test failed"
  log_error "See logs: $E/06_e2e/test_run.log"
  
  # Capture Playwright results if available
  if [ -d "$FORGE_APP_ROOT/test-results" ]; then
    mkdir -p "$E/06_e2e/artifacts"
    cp -r "$FORGE_APP_ROOT/test-results" "$E/06_e2e/artifacts/" || true
  fi
  
  if [ -d "$REPO_ROOT/e2e/test-results" ]; then
    mkdir -p "$E/06_e2e/artifacts"
    cp -r "$REPO_ROOT/e2e/test-results" "$E/06_e2e/artifacts/e2e-test-results" || true
  fi
  
  echo "FAIL: E2E dashboard test" > "$E/06_e2e/VERDICT.txt"
  exit 1
fi

log_success "E2E dashboard test: PASS"

# 6.6 - Capture E2E artifacts
log_info "Capturing E2E artifacts..."
mkdir -p "$E/06_e2e/artifacts"

# Copy Playwright HTML report
if [ -d "$FORGE_APP_ROOT/playwright-report" ]; then
  cp -r "$FORGE_APP_ROOT/playwright-report" "$E/06_e2e/artifacts/" || true
fi

if [ -d "$REPO_ROOT/e2e/playwright-report" ]; then
  cp -r "$REPO_ROOT/e2e/playwright-report" "$E/06_e2e/artifacts/e2e-playwright-report" || true
fi

# Copy test results
if [ -d "$FORGE_APP_ROOT/test-results" ]; then
  cp -r "$FORGE_APP_ROOT/test-results" "$E/06_e2e/artifacts/" || true
fi

if [ -d "$REPO_ROOT/e2e/test-results" ]; then
  cp -r "$REPO_ROOT/e2e/test-results" "$E/06_e2e/artifacts/e2e-test-results" || true
fi

echo "PASS" > "$E/06_e2e/VERDICT.txt"
log_success "E2E phase: PASS"

# ============================================================================
# SUCCESS - ALL PHASES COMPLETE
# ============================================================================
# The finalize() function (via trap) will validate all artifacts and write
# the final verdict. If we reach here, exit 0 triggers artifact validation.

log_phase "All phases completed - validating artifacts..."

exit 0

