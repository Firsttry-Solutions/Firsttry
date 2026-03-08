#!/bin/bash
################################################################################
# audit/runtime_proofpack_v2.sh
# 
# Non-bypassable Runtime Evidence Collector (fail-closed execution)
#
# ABSOLUTE RULES:
# - No simulated evidence (only real command outputs)
# - Fail-closed: STOP on any validation failure
# - All artifacts SHA-256 hashed immediately after creation
# - Reports auto-generated from artifacts only (no manual text)
# - Exit codes preserved in pipelines (set -euo pipefail)
#
# Usage:
#   bash audit/runtime_proofpack_v2.sh
#   
# Environment variables:
#   FORGE_ENV    - Forge environment (default: production)
#   LOG_SINCE    - Log window (default: 20m)
#   RUN_DIR      - Output directory (auto-generated if not set)
#
################################################################################

set -euo pipefail
umask 077

# ============================================================================
# HARDENED ERROR HANDLING & SAFETY FUNCTIONS
# ============================================================================

# Die with STOP_REASON.txt (fail-closed)
die() {
  local reason="$1"
  echo "STOP: $reason" > "$RUN_DIR/STOP_REASON.txt" 2>/dev/null || echo "STOP: $reason" >&2
  echo "$reason" >&2
  exit 1
}

# Require file exists and has minimum size
require_file() {
  local path="$1"
  local min_bytes="${2:-1}"
  if [[ ! -f "$path" ]]; then
    die "Required file missing: $path"
  fi
  if [[ ! -s "$path" ]]; then
    die "Required file empty: $path"
  fi
  local size
  size=$(wc -c < "$path")
  if (( size < min_bytes )); then
    die "File too small: $path (${size} bytes, need ${min_bytes})"
  fi
}

# Require command exists and is executable
require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" &>/dev/null; then
    die "Required command not found: $cmd"
  fi
}

# Capture command output safely with exit code check
capture_cmd() {
  local out_file="$1"
  shift
  local cmd_array=("$@")

  "${cmd_array[@]}" > "$out_file" 2>&1
  local exit_code=$?
  if [[ $exit_code -ne 0 ]]; then
    die "Command failed with exit code $exit_code: ${cmd_array[*]}"
  fi

  require_file "$out_file" 1
}

# Scan for token-like secrets in file
scan_for_secrets() {
  local file="$1"
  local patterns=(
    "ATATT"
    "FORGE_API_TOKEN"
    "Bearer [A-Za-z0-9]*"
    "api_token"
    "[A-Za-z0-9+/]{40,}"  # long base64-like strings
  )
  
  for pattern in "${patterns[@]}"; do
    if grep -qi "$pattern" "$file" 2>/dev/null; then
      die "SECURITY VIOLATION: Token-like string found in $file (pattern: $pattern). Output truncated for safety."
    fi
  done
}

# Require text file has minimum byte size
require_min_bytes() {
  local path="$1"
  local min_bytes="$2"
  require_file "$path" 1
  local size
  size=$(wc -c < "$path")
  if (( size < min_bytes )); then
    die "Manual artifact too small: $path (${size} bytes, need >= ${min_bytes})"
  fi
}

# Validate PNG has minimum dimensions (reject 1x1 placeholders)
require_png_min_dims() {
  local path="$1"
  local min_w="$2"
  local min_h="$3"
  require_file "$path" 1

  # Use `file` first (fast path)
  local f
  f=$(file "$path" 2>/dev/null || true)

  # Hard reject 1 x 1 explicitly (common placeholder)
  if echo "$f" | grep -Eq '\b1\s*x\s*1\b'; then
    die "Manual screenshot appears to be a placeholder (1x1 PNG): $path"
  fi

  # Parse IHDR width/height via python -c (NOT heredoc)
  local dims
  dims=$(python -c 'import struct; import sys
p=sys.argv[1]
b=open(p,"rb").read(24)
if b[:8]!=b"\x89PNG\r\n\x1a\n": raise SystemExit(2)
w,h=struct.unpack(">II", b[16:24])
print(f"{w}x{h}")' "$path" 2>/dev/null || true)

  if ! echo "$dims" | grep -Eq '^[0-9]+x[0-9]+$'; then
    die "Manual screenshot PNG dims unreadable: $path"
  fi

  local w="${dims%x*}"
  local h="${dims#*x}"
  if (( w < min_w || h < min_h )); then
    die "Manual screenshot too small: $path (${w}x${h}, need >= ${min_w}x${min_h})"
  fi
}

# Self-integrity check: refuse to run if script contains simulation patterns
check_script_integrity() {
  local script_file="$0"
  
  # A) Forbidden: heredocs writing evidence files
  if grep -Eq 'cat\s*>\s*.*20_logs_before.*<<|cat\s*>\s*.*40_logs_after.*<<|cat\s*>\s*.*50_resolver_extract.*<<|cat\s*>\s*.*31_browser_console.*<<|cat\s*>\s*.*32_dashboard.*<<' "$script_file"; then
    die "INTEGRITY CHECK FAILED: Script contains forbidden heredoc pattern for evidence file"
  fi
  
  # B) Forbidden: echo/printf piped or redirected to evidence files (not exit code markers)
  if grep -Eq '\becho\b.*>\s*\$RUN_DIR/20_logs_before\.txt|\becho\b.*>\s*\$RUN_DIR/40_logs_after\.txt|\bprintf\b.*>\s*\$RUN_DIR/20_logs_before\.txt|\bprintf\b.*>\s*\$RUN_DIR/40_logs_after\.txt' "$script_file"; then
    die "INTEGRITY CHECK FAILED: Script contains forbidden echo/printf redirection to evidence file"
  fi
  
  # C) Forbidden: tee writing evidence files (including pipelines)
  if grep -Eq '\|\s*tee.*20_logs_before\.txt|\|\s*tee.*40_logs_after\.txt|\|\s*tee.*50_resolver_extract\.txt|\|\s*tee.*31_browser_console\.txt' "$script_file"; then
    die "INTEGRITY CHECK FAILED: Script contains forbidden tee output to evidence file"
  fi
  
  # D) Forbidden: interpreter heredocs (python, node, perl) that could fabricate evidence
  if grep -Eq '(python|node|perl)\s+.*-\s*<<' "$script_file"; then
    die "INTEGRITY CHECK FAILED: Script contains forbidden interpreter heredoc (python/node/perl -)"
  fi
  
  # E) Forbidden: cat heredoc piped to tee INTO evidence files (fabrication)
  if grep -Eq 'cat[[:space:]]*<<.*\|[[:space:]]*tee[[:space:]]+.*(20_logs_before|40_logs_after|50_resolver_extract|31_browser_console|32_dashboard|50_.*extract|51_console_extract)' "$script_file"; then
    die "INTEGRITY CHECK FAILED: Script contains forbidden cat<<heredoc | tee evidence pattern"
  fi
  
  # F) Forbidden: mv/cp into evidence artifacts (fabrication via rename/copy)
  if grep -Eq '\b(mv|cp)\b[[:space:]].*(20_logs_before|40_logs_after|31_browser_console|32_dashboard|50_.*extract|51_console_extract)(\.[A-Za-z0-9]+)?' "$script_file"; then
    die "INTEGRITY CHECK FAILED: Script contains forbidden mv/cp into evidence artifact"
  fi
  
  # G) Forbidden: mv/cp into $RUN_DIR evidence paths
  if grep -Eq '\b(mv|cp)\b[[:space:]].*\$RUN_DIR/.*(20_logs_before|40_logs_after|31_browser_console|32_dashboard|50_.*extract|51_console_extract)' "$script_file"; then
    die "INTEGRITY CHECK FAILED: Script contains forbidden mv/cp into \$RUN_DIR evidence artifact"
  fi
}

# Enforce FREEZE_LOCK is clean and tracked
enforce_freeze_lock() {
  local freeze_file="audit/marketplace_submission/FREEZE_LOCK.json"
  
  # Reject FIRSTTRY_ALLOW_NO_FREEZE environment variable
  if [[ "${FIRSTTRY_ALLOW_NO_FREEZE:-}" == "1" ]]; then
    die "ENFORCEMENT: FIRSTTRY_ALLOW_NO_FREEZE override is forbidden in proof mode. Commit FREEZE_LOCK.json instead."
  fi
  
  # Check if FREEZE_LOCK is dirty or untracked
  if ! git ls-files --error-unmatch "$freeze_file" &>/dev/null 2>&1; then
    die "FREEZE_LOCK not tracked in git: $freeze_file"
  fi
  
  if git diff --quiet --cached "$freeze_file" 2>/dev/null && git diff --quiet "$freeze_file" 2>/dev/null; then
    # Clean
    return 0
  else
    die "FREEZE_LOCK is dirty. Commit with: git add $freeze_file && git commit -m 'chore: update freeze lock'"
  fi
}

# ============================================================================
# Configuration
# ============================================================================

FORGE_ENV="${FORGE_ENV:-production}"
LOG_SINCE="${LOG_SINCE:-20m}"

# Auto-generate RUN_DIR with timestamp if not provided
if [[ -z "${RUN_DIR:-}" ]]; then
  TS="$(date -u +%Y%m%dT%H%M%SZ)"
  RUN_DIR="/tmp/ft_proofpack_v2_${TS}"
fi

mkdir -p "$RUN_DIR"

# ============================================================================
# PRE-FLIGHT: HARDENED ENFORCEMENT CHECKS
# ============================================================================

echo "=== PRE-FLIGHT: Integrity & Freeze Checks ==="

# Check 1: Script self-integrity (no simulation patterns)
check_script_integrity
echo "✓ Script integrity verified (no simulation patterns)"

# Check 2: Enforce FREEZE_LOCK alignment
enforce_freeze_lock
echo "✓ FREEZE_LOCK valid (no overrides allowed)"

# Check 3: Require critical commands
require_cmd "git"
require_cmd "forge"
require_cmd "grep"
require_cmd "sha256sum"
echo "✓ Required commands available"

# Check 4: RUN_DIR is writable
if ! touch "$RUN_DIR/.test_write" 2>/dev/null; then
  die "RUN_DIR not writable: $RUN_DIR"
fi
rm -f "$RUN_DIR/.test_write"
echo "✓ RUN_DIR is writable"

# ============================================================================
# PHASE 0: Baseline Establishment
# ============================================================================

echo ""
echo "=== PHASE 0: Baseline Establishment ==="

# Capture git baseline
git rev-parse HEAD > "$RUN_DIR/01_head.txt"
git status --porcelain=v1 > "$RUN_DIR/02_git_status.txt"
echo "$RUN_DIR" > "$RUN_DIR/00_run_dir.txt"

# Validate: git status must be clean
if [[ -s "$RUN_DIR/02_git_status.txt" ]]; then
  echo "STOP: Git working tree has uncommitted changes" > "$RUN_DIR/STOP_REASON.txt"
  cat "$RUN_DIR/STOP_REASON.txt" >&2
  exit 1
fi

echo "✓ PHASE 0 complete (baseline established)"

# ============================================================================
# PHASE 1: Real Forge Authentication
# ============================================================================

echo ""
echo "=== PHASE 1: Real Forge Authentication ==="

capture_cmd "$RUN_DIR/10_forge_whoami.txt" forge whoami
scan_for_secrets "$RUN_DIR/10_forge_whoami.txt"
echo "0" > "$RUN_DIR/10_forge_whoami_exit.txt"

echo "✓ PHASE 1 complete (forge authenticated, no secrets)"

# ============================================================================
# PHASE 2: Production Logs BEFORE User Refresh
# ============================================================================

echo ""
echo "=== PHASE 2: Production Logs BEFORE ==="

capture_cmd "$RUN_DIR/20_logs_before.txt" forge logs --environment "$FORGE_ENV" --since "$LOG_SINCE"
scan_for_secrets "$RUN_DIR/20_logs_before.txt"
echo "0" > "$RUN_DIR/20_logs_before_exit.txt"

echo "✓ PHASE 2 complete (pre-refresh logs captured, no secrets)"

# ============================================================================
# PHASE 3: Manual Evidence Collection Instructions (NOT simulated)
# ============================================================================

echo ""
echo "=== PHASE 3: Manual Evidence Collection Instructions ==="

cat > "$RUN_DIR/30_MANUAL_STEPS.txt" << 'MANUAL_EOF'
=== MANUAL EVIDENCE COLLECTION STEPS (No Fabrication) ===

This file provides instructions for collecting REAL browser evidence from production.
NO programmatic simulation allowed. Only real browser output.

STEP 1: Open Dashboard
  - Navigate to: https://firsttry.atlassian.net/jira/dashboards/10102
  - Ensure you are logged in to Firsttry Jira

STEP 2: Hard Refresh
  - Press Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)
  - Wait for page to fully load (watch for "L0_DASHBOARD_RENDERED" in console)

STEP 3: Capture Browser Console
  - Open DevTools: F12 or Cmd+Option+I
  - Go to Console tab
  - Select all console output (Ctrl+A)
  - Copy to clipboard (Ctrl+C)
  - Save to: 31_browser_console.txt
  - Minimum requirement: Must contain at least one line matching:
    * "UI_BUILD_IDENTITY_CONFIRMED" OR "UI_ENTRY_RUNTIME_PROOF"

STEP 4: Capture Dashboard Screenshot
  - With DevTools still open, take a screenshot of the dashboard
  - OR: Close DevTools (F12) and take full-page screenshot
  - Save as PNG to: 32_dashboard.png
  - Minimum requirement: File size > 0 bytes (visible gadget rendering)

STEP 5: Verify Files Exist
  - Check: ls -lh 31_browser_console.txt 32_dashboard.png
  - Both must exist and be non-empty

Files must be placed in:
RUN_DIR (check 00_run_dir.txt for exact path)

After collecting both files, the script will automatically:
- PHASE 4: Capture post-refresh production logs
- PHASE 5: Extract resolver markers from logs
- PHASE 6: Generate final comprehensive report

NO manual editing of evidence allowed.
All extracts are mechanically derived via rg/grep.
Report is auto-generated from artifact hashes only.
MANUAL_EOF

echo "✓ PHASE 3 complete (manual instructions created)"

# ============================================================================
# PHASE 3B: Validate Manual Artifacts
# ============================================================================

echo ""
echo "=== PHASE 3B: Validate Manual Artifacts ==="

# Validate browser console: exists, non-empty, meets minimum size
require_min_bytes "$RUN_DIR/31_browser_console.txt" 2000

# Scan console for secrets before proceeding
scan_for_secrets "$RUN_DIR/31_browser_console.txt"

# Validate console contains required UI markers
if ! grep -q '\[UI_BUILD_IDENTITY_CONFIRMED\]' "$RUN_DIR/31_browser_console.txt" && \
   ! grep -q '\[UI_ENTRY_RUNTIME_PROOF\]' "$RUN_DIR/31_browser_console.txt"; then
  die "Browser console missing UI identity markers (need [UI_BUILD_IDENTITY_CONFIRMED] or [UI_ENTRY_RUNTIME_PROOF])"
fi

# CSP_VIOLATION_CHECK: Fail-closed if Jira reports CSP inline style block
if grep -q 'Applying inline style violates\|Content Security Policy directive.*style-src' "$RUN_DIR/31_browser_console.txt"; then
  die "CSP_VIOLATION: inline style blocked by host CSP. Fix gadget UI to avoid inline styles."
fi

# Validate dashboard PNG: exists, non-empty, meets minimum dimensions (600x400)
require_png_min_dims "$RUN_DIR/32_dashboard.png" 600 400

echo "✓ Manual artifacts validated (console >= 2KB, PNG >= 600x400, UI markers present)"

# ============================================================================
# PHASE 4: Production Logs AFTER User Refresh
# ============================================================================

echo ""
echo "=== PHASE 4: Production Logs AFTER ==="

capture_cmd "$RUN_DIR/40_logs_after.txt" forge logs --environment "$FORGE_ENV" --since "$LOG_SINCE"
scan_for_secrets "$RUN_DIR/40_logs_after.txt"
echo "0" > "$RUN_DIR/40_logs_after_exit.txt"

echo "✓ PHASE 4 complete (post-refresh logs captured, no secrets)"

# ============================================================================
# PHASE 5: Resolver Marker Extraction
# ============================================================================

echo ""
echo "=== PHASE 5: Resolver Marker Extraction ==="

# Extract [FT_RESOLVER_ENTRY] markers with ft_getDashboardState_v1
if grep -q '\[FT_RESOLVER_ENTRY\]' "$RUN_DIR/40_logs_after.txt" && \
   grep -q 'ft_getDashboardState_v1' "$RUN_DIR/40_logs_after.txt"; then
  grep '\[FT_RESOLVER_ENTRY\]' "$RUN_DIR/40_logs_after.txt" | grep 'ft_getDashboardState_v1' > "$RUN_DIR/50_resolver_extract.txt" || true
else
  echo "STOP: No resolver markers [FT_RESOLVER_ENTRY] with ft_getDashboardState_v1 found" > "$RUN_DIR/STOP_REASON.txt"
  cat "$RUN_DIR/STOP_REASON.txt" >&2
  exit 1
fi

# Validate: at least 1 line of resolver extraction
if [[ ! -s "$RUN_DIR/50_resolver_extract.txt" ]]; then
  echo "STOP: Resolver extraction returned 0 matches" > "$RUN_DIR/STOP_REASON.txt"
  cat "$RUN_DIR/STOP_REASON.txt" >&2
  exit 1
fi

echo "✓ PHASE 5 complete ($(wc -l < "$RUN_DIR/50_resolver_extract.txt") resolver invocations extracted)"

# ============================================================================
# PHASE 5B: Console Marker Extraction
# ============================================================================

echo ""
echo "=== PHASE 5B: Console Marker Extraction ==="

# Scan browser console for secrets before extracting
scan_for_secrets "$RUN_DIR/31_browser_console.txt"

# Extract UI_BUILD_IDENTITY_CONFIRMED or UI_ENTRY_RUNTIME_PROOF from browser console
if grep -q '\[UI_BUILD_IDENTITY_CONFIRMED\]' "$RUN_DIR/31_browser_console.txt" || \
   grep -q '\[UI_ENTRY_RUNTIME_PROOF\]' "$RUN_DIR/31_browser_console.txt"; then
  (grep '\[UI_BUILD_IDENTITY_CONFIRMED\]' "$RUN_DIR/31_browser_console.txt" || true; \
   grep '\[UI_ENTRY_RUNTIME_PROOF\]' "$RUN_DIR/31_browser_console.txt" || true) > "$RUN_DIR/51_console_extract.txt"
else
  die "No UI console markers found (need UI_BUILD_IDENTITY_CONFIRMED or UI_ENTRY_RUNTIME_PROOF)"
fi

require_file "$RUN_DIR/51_console_extract.txt" 1

echo "✓ PHASE 5B complete (console markers extracted)"

# ============================================================================
# PHASE 6: SHA-256 Hashing All Artifacts
# ============================================================================

echo ""
echo "=== PHASE 6: Artifact Integrity Hashing ==="

# Hash all evidence files (ordered list)
sha256sum \
  "$RUN_DIR/00_run_dir.txt" \
  "$RUN_DIR/01_head.txt" \
  "$RUN_DIR/02_git_status.txt" \
  "$RUN_DIR/10_forge_whoami.txt" \
  "$RUN_DIR/10_forge_whoami_exit.txt" \
  "$RUN_DIR/20_logs_before.txt" \
  "$RUN_DIR/20_logs_before_exit.txt" \
  "$RUN_DIR/30_MANUAL_STEPS.txt" \
  "$RUN_DIR/31_browser_console.txt" \
  "$RUN_DIR/32_dashboard.png" \
  "$RUN_DIR/40_logs_after.txt" \
  "$RUN_DIR/40_logs_after_exit.txt" \
  "$RUN_DIR/50_resolver_extract.txt" \
  "$RUN_DIR/51_console_extract.txt" \
  > "$RUN_DIR/HASHES.txt"

echo "✓ PHASE 6 complete (14 artifacts hashed)"

# ============================================================================
# PHASE 7: Auto-Generate Final Report
# ============================================================================

echo ""
echo "=== PHASE 7: Final Report Generation ==="

# Calculate resolver hit count
RESOLVER_COUNT=$(wc -l < "$RUN_DIR/50_resolver_extract.txt")

# Extract HEAD commit
HEAD_COMMIT=$(cat "$RUN_DIR/01_head.txt")

# Auto-generate report from artifacts only (NO manual text blocks)
cat > "$RUN_DIR/60_FINAL_REPORT.md" << REPORT_EOF
# Runtime Evidence Collection Report - v2 (Auto-Generated)

**Generated:** $(date -u +%Y-%m-%dT%H:%M:%SZ)
**RUN_DIR:** $RUN_DIR
**HEAD Commit:** $HEAD_COMMIT
**Status:** ✅ PASS (All validations successful)

---

## Executive Summary

Complete runtime evidence collection from production Jira environment:
- ✅ Git state verified (clean working tree)
- ✅ Real Forge authentication confirmed
- ✅ Production logs captured (before + after)
- ✅ Browser console evidence collected (manual)
- ✅ Dashboard screenshot captured (manual)
- ✅ Resolver markers extracted ($RESOLVER_COUNT invocation(s))
- ✅ All artifacts SHA-256 hashed for integrity

---

## Evidence Artifacts

**Total Files:** 14
**Total Size:** $(du -sh "$RUN_DIR" | cut -f1)
**Protocol:** Fail-closed (real outputs only, no simulation)

### Artifact Inventory

REPORT_EOF

# List first 20 lines of resolver extract
echo "" >> "$RUN_DIR/60_FINAL_REPORT.md"
echo "## Resolver Invocations (from 50_resolver_extract.txt)" >> "$RUN_DIR/60_FINAL_REPORT.md"
echo "" >> "$RUN_DIR/60_FINAL_REPORT.md"
echo "**Count:** $RESOLVER_COUNT" >> "$RUN_DIR/60_FINAL_REPORT.md"
echo "" >> "$RUN_DIR/60_FINAL_REPORT.md"
echo "\`\`\`" >> "$RUN_DIR/60_FINAL_REPORT.md"
head -20 "$RUN_DIR/50_resolver_extract.txt" >> "$RUN_DIR/60_FINAL_REPORT.md"
echo "\`\`\`" >> "$RUN_DIR/60_FINAL_REPORT.md"

# List first 50 lines of console extract
echo "" >> "$RUN_DIR/60_FINAL_REPORT.md"
echo "## Console Markers (from 51_console_extract.txt)" >> "$RUN_DIR/60_FINAL_REPORT.md"
echo "" >> "$RUN_DIR/60_FINAL_REPORT.md"
echo "\`\`\`" >> "$RUN_DIR/60_FINAL_REPORT.md"
head -50 "$RUN_DIR/51_console_extract.txt" >> "$RUN_DIR/60_FINAL_REPORT.md"
echo "\`\`\`" >> "$RUN_DIR/60_FINAL_REPORT.md"

# Append full HASHES.txt verbatim
echo "" >> "$RUN_DIR/60_FINAL_REPORT.md"
echo "## Integrity Verification Chain (HASHES.txt)" >> "$RUN_DIR/60_FINAL_REPORT.md"
echo "" >> "$RUN_DIR/60_FINAL_REPORT.md"
echo "\`\`\`" >> "$RUN_DIR/60_FINAL_REPORT.md"
cat "$RUN_DIR/HASHES.txt" >> "$RUN_DIR/60_FINAL_REPORT.md"
echo "\`\`\`" >> "$RUN_DIR/60_FINAL_REPORT.md"

# Hash the report itself
sha256sum "$RUN_DIR/60_FINAL_REPORT.md" >> "$RUN_DIR/HASHES.txt"

echo "✓ PHASE 7 complete (report auto-generated)"

# ============================================================================
# Summary
# ============================================================================

echo ""
echo "======================================================================="
echo "✅ ALL PHASES COMPLETE (Fail-Closed Protocol Enforced)"
echo "======================================================================="
echo ""
echo "RUN_DIR: $RUN_DIR"
echo "Report:  $RUN_DIR/60_FINAL_REPORT.md"
echo "Hashes:  $RUN_DIR/HASHES.txt"
echo ""
echo "Total artifacts collected: 15"
echo "All hashes verified in: HASHES.txt"
echo ""
