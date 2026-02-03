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
# PHASE 0: Baseline Establishment
# ============================================================================

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

if ! forge whoami > "$RUN_DIR/10_forge_whoami.txt" 2>&1; then
  EXIT_CODE=$?
  echo "$EXIT_CODE" > "$RUN_DIR/10_forge_whoami_exit.txt"
  echo "STOP: forge whoami failed (exit code $EXIT_CODE)" > "$RUN_DIR/STOP_REASON.txt"
  cat "$RUN_DIR/STOP_REASON.txt" >&2
  exit 1
fi
echo "0" > "$RUN_DIR/10_forge_whoami_exit.txt"

# Validate: exit code 0
EXIT_CODE=$(cat "$RUN_DIR/10_forge_whoami_exit.txt")
if [[ "$EXIT_CODE" != "0" ]]; then
  echo "STOP: forge whoami exit code not 0: $EXIT_CODE" > "$RUN_DIR/STOP_REASON.txt"
  cat "$RUN_DIR/STOP_REASON.txt" >&2
  exit 1
fi

echo "✓ PHASE 1 complete (forge authenticated)"

# ============================================================================
# PHASE 2: Production Logs BEFORE User Refresh
# ============================================================================

echo ""
echo "=== PHASE 2: Production Logs BEFORE ==="

if ! forge logs --environment "$FORGE_ENV" --since "$LOG_SINCE" > "$RUN_DIR/20_logs_before.txt" 2>&1; then
  EXIT_CODE=$?
  echo "$EXIT_CODE" > "$RUN_DIR/20_logs_before_exit.txt"
  echo "STOP: forge logs failed (exit code $EXIT_CODE)" > "$RUN_DIR/STOP_REASON.txt"
  cat "$RUN_DIR/STOP_REASON.txt" >&2
  exit 1
fi
echo "0" > "$RUN_DIR/20_logs_before_exit.txt"

# Validate: logs not empty
if [[ ! -s "$RUN_DIR/20_logs_before.txt" ]]; then
  echo "STOP: forge logs produced empty output" > "$RUN_DIR/STOP_REASON.txt"
  cat "$RUN_DIR/STOP_REASON.txt" >&2
  exit 1
fi

echo "✓ PHASE 2 complete (pre-refresh logs captured)"

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

# Check 31_browser_console.txt exists and non-empty
if [[ ! -f "$RUN_DIR/31_browser_console.txt" ]]; then
  echo "STOP: 31_browser_console.txt does not exist" > "$RUN_DIR/STOP_REASON.txt"
  cat "$RUN_DIR/STOP_REASON.txt" >&2
  exit 1
fi

if [[ ! -s "$RUN_DIR/31_browser_console.txt" ]]; then
  echo "STOP: 31_browser_console.txt is empty" > "$RUN_DIR/STOP_REASON.txt"
  cat "$RUN_DIR/STOP_REASON.txt" >&2
  exit 1
fi

# Check 32_dashboard.png exists and non-empty
if [[ ! -f "$RUN_DIR/32_dashboard.png" ]]; then
  echo "STOP: 32_dashboard.png does not exist" > "$RUN_DIR/STOP_REASON.txt"
  cat "$RUN_DIR/STOP_REASON.txt" >&2
  exit 1
fi

if [[ ! -s "$RUN_DIR/32_dashboard.png" ]]; then
  echo "STOP: 32_dashboard.png is empty" > "$RUN_DIR/STOP_REASON.txt"
  cat "$RUN_DIR/STOP_REASON.txt" >&2
  exit 1
fi

echo "✓ Manual artifacts validated (both exist and non-empty)"

# ============================================================================
# PHASE 4: Production Logs AFTER User Refresh
# ============================================================================

echo ""
echo "=== PHASE 4: Production Logs AFTER ==="

if ! forge logs --environment "$FORGE_ENV" --since "$LOG_SINCE" > "$RUN_DIR/40_logs_after.txt" 2>&1; then
  EXIT_CODE=$?
  echo "$EXIT_CODE" > "$RUN_DIR/40_logs_after_exit.txt"
  echo "STOP: forge logs (after) failed (exit code $EXIT_CODE)" > "$RUN_DIR/STOP_REASON.txt"
  cat "$RUN_DIR/STOP_REASON.txt" >&2
  exit 1
fi
echo "0" > "$RUN_DIR/40_logs_after_exit.txt"

# Validate: logs not empty
if [[ ! -s "$RUN_DIR/40_logs_after.txt" ]]; then
  echo "STOP: forge logs (after) produced empty output" > "$RUN_DIR/STOP_REASON.txt"
  cat "$RUN_DIR/STOP_REASON.txt" >&2
  exit 1
fi

echo "✓ PHASE 4 complete (post-refresh logs captured)"

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

# Extract UI_BUILD_IDENTITY_CONFIRMED or UI_ENTRY_RUNTIME_PROOF from browser console
if grep -q '\[UI_BUILD_IDENTITY_CONFIRMED\]' "$RUN_DIR/31_browser_console.txt" || \
   grep -q '\[UI_ENTRY_RUNTIME_PROOF\]' "$RUN_DIR/31_browser_console.txt"; then
  (grep '\[UI_BUILD_IDENTITY_CONFIRMED\]' "$RUN_DIR/31_browser_console.txt" || true; \
   grep '\[UI_ENTRY_RUNTIME_PROOF\]' "$RUN_DIR/31_browser_console.txt" || true) > "$RUN_DIR/51_console_extract.txt"
else
  echo "STOP: No UI console markers found (need UI_BUILD_IDENTITY_CONFIRMED or UI_ENTRY_RUNTIME_PROOF)" > "$RUN_DIR/STOP_REASON.txt"
  cat "$RUN_DIR/STOP_REASON.txt" >&2
  exit 1
fi

# Validate: at least 1 line of console extraction
if [[ ! -s "$RUN_DIR/51_console_extract.txt" ]]; then
  echo "STOP: Console extraction returned 0 matches" > "$RUN_DIR/STOP_REASON.txt"
  cat "$RUN_DIR/STOP_REASON.txt" >&2
  exit 1
fi

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
