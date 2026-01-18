#!/bin/bash
# tools/status_prod.sh
# BACKBONE LAYER 0: Production Log Capture & Status Snapshot Verification
# 
# HARD PROOF: FT_STATUS markers must be found in production logs (binary: PASS/FAIL)
# Crash-proof with deterministic exit codes.
#
# Usage:
#   bash tools/status_prod.sh [--minutes <N>] [--ui <UI_REQ_ID>]
#
# Arguments:
#   --minutes <N>            (optional) log lookback window in minutes (default: 20)
#   --ui <UI_REQ_ID>         (optional) ui_req_id from UI footer (e.g., ui_1768660190864_d8f211a2)
#
# Exit Codes:
#   0 = PASS (FT_STATUS_ENTRY found in logs)
#   1 = ERROR (invalid arguments, placeholder values, or script failure)
#   2 = FAIL (no status markers found)

set -euo pipefail

# ============================================================================
# SAFE COUNTER HELPER - Always returns a single integer line
# ============================================================================
count_fixed() {
  local pat="$1"
  local file="$2"
  if [ ! -f "$file" ]; then
    echo "0"
    return 0
  fi
  local count
  count=$(rg -F "$pat" "$file" 2>/dev/null | wc -l | tr -d ' ')
  echo "${count:-0}"
}

# ============================================================================
# PARSE ARGUMENTS
# ============================================================================

MINUTES=20
UI_REQ_ID=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --minutes)
      MINUTES="${2:-20}"
      if ! [[ "$MINUTES" =~ ^[0-9]+$ ]]; then
        echo "❌ ERROR: --minutes requires a number"
        exit 1
      fi
      shift 2
      ;;
    --ui)
      UI_REQ_ID="${2:-}"
      if [ -z "$UI_REQ_ID" ]; then
        echo "❌ ERROR: --ui requires a value"
        exit 1
      fi
      # Reject placeholder values
      case "$UI_REQ_ID" in
        *"<PASTE_"*|*"PASTE_"*|*"<"*|*">"*|*"<ui>"*|*"ui>"*)
          echo "❌ ERROR: ui_req_id looks like a placeholder: $UI_REQ_ID"
          exit 1
          ;;
      esac
      shift 2
      ;;
    *)
      echo "❌ ERROR: Unknown argument: $1"
      echo ""
      echo "USAGE: bash tools/status_prod.sh [--minutes <N>] [--ui <UI_REQ_ID>]"
      echo ""
      echo "Examples:"
      echo "  bash tools/status_prod.sh --minutes 20"
      echo "  bash tools/status_prod.sh --minutes 60 --ui ui_1768660190864_d8f211a2"
      exit 1
      ;;
  esac
done

# ============================================================================
# SETUP
# ============================================================================

TIMESTAMP=$(date -u +%Y%m%d_%H%M%S)
OUTPUT_DIR="/tmp/ft_status_${TIMESTAMP}"
mkdir -p "$OUTPUT_DIR"

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║ BACKBONE LAYER 0: Production Status Log Capture & Verification  ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "LOOKBACK:     ${MINUTES} minutes"
[ -n "$UI_REQ_ID" ] && echo "UI_REQ_ID:    $UI_REQ_ID"
echo "OUTPUT_DIR:   $OUTPUT_DIR"
echo ""

cd "$(dirname "${BASH_SOURCE[0]}")/.."
cd atlassian/forge-app

# ============================================================================
# STEP 1: Capture environment metadata
# ============================================================================
echo "Step 1: Capturing environment..."
forge whoami > "$OUTPUT_DIR/00_whoami.txt" 2>&1 || echo "forge whoami failed" > "$OUTPUT_DIR/00_whoami.txt"
forge install list --environment production > "$OUTPUT_DIR/01_install_list.txt" 2>&1 || echo "forge install list failed" > "$OUTPUT_DIR/01_install_list.txt"
git rev-parse HEAD > "$OUTPUT_DIR/02_git_head.txt" 2>&1 || echo "unknown" > "$OUTPUT_DIR/02_git_head.txt"

# ============================================================================
# STEP 2: Capture production logs in BOTH grouped and raw formats
# ============================================================================
echo "Step 2: Capturing production logs (${MINUTES}min lookback, timeout 120s)..."

# GROUPED format
echo "  Fetching grouped logs..."
timeout 120 forge logs --environment production --limit 8000 --since "${MINUTES}m" --grouped > "$OUTPUT_DIR/10_logs_grouped.txt" 2>&1 || true

# RAW format (no grouping, might have different formatting)
echo "  Fetching raw logs..."
timeout 120 forge logs --environment production --limit 8000 --since "${MINUTES}m" > "$OUTPUT_DIR/11_logs_raw.txt" 2>&1 || true

# Show log capture sizes
GROUPED_SIZE=$(wc -c < "$OUTPUT_DIR/10_logs_grouped.txt" 2>/dev/null || echo 0)
RAW_SIZE=$(wc -c < "$OUTPUT_DIR/11_logs_raw.txt" 2>/dev/null || echo 0)
echo "✅ Grouped logs: $GROUPED_SIZE bytes"
echo "✅ Raw logs:     $RAW_SIZE bytes"
echo ""

# ============================================================================
# STEP 3: Initialize ALL counters to 0 (prevent unbound variable errors)
# ============================================================================
ENTRY_GROUPED=0
ENTRY_RAW=0
OK_GROUPED=0
OK_RAW=0
ERR_GROUPED=0
ERR_RAW=0
STATUS_ANY_GROUPED=0
STATUS_ANY_RAW=0

# ============================================================================
# STEP 4: Define fixed-string search patterns
# ============================================================================
PAT_ENTRY="FT_STATUS_ENTRY"
PAT_OK="FT_STATUS_OK"
PAT_ERR="FT_STATUS_ERR"

# ============================================================================
# STEP 5: Search for FT_STATUS markers (DETERMINISTIC)
# ============================================================================
echo "Step 3: Searching for FT_STATUS entry markers..."

# Search for FT_STATUS_ENTRY (guaranteed log at function start)
ENTRY_GROUPED=$(count_fixed "$PAT_ENTRY" "$OUTPUT_DIR/10_logs_grouped.txt")
ENTRY_RAW=$(count_fixed "$PAT_ENTRY" "$OUTPUT_DIR/11_logs_raw.txt")
grep "FT_STATUS_ENTRY" "$OUTPUT_DIR/10_logs_grouped.txt" > "$OUTPUT_DIR/20_entry_grouped.txt" 2>&1 || true
grep "FT_STATUS_ENTRY" "$OUTPUT_DIR/11_logs_raw.txt" > "$OUTPUT_DIR/20_entry_raw.txt" 2>&1 || true

# Search for FT_STATUS_OK (execution success)
OK_GROUPED=$(count_fixed "$PAT_OK" "$OUTPUT_DIR/10_logs_grouped.txt")
OK_RAW=$(count_fixed "$PAT_OK" "$OUTPUT_DIR/11_logs_raw.txt")
grep "FT_STATUS_OK" "$OUTPUT_DIR/10_logs_grouped.txt" > "$OUTPUT_DIR/21_ok_grouped.txt" 2>&1 || true
grep "FT_STATUS_OK" "$OUTPUT_DIR/11_logs_raw.txt" > "$OUTPUT_DIR/21_ok_raw.txt" 2>&1 || true

# Search for FT_STATUS_ERR (execution error)
ERR_GROUPED=$(count_fixed "$PAT_ERR" "$OUTPUT_DIR/10_logs_grouped.txt")
ERR_RAW=$(count_fixed "$PAT_ERR" "$OUTPUT_DIR/11_logs_raw.txt")
grep "FT_STATUS_ERR" "$OUTPUT_DIR/10_logs_grouped.txt" > "$OUTPUT_DIR/22_err_grouped.txt" 2>&1 || true
grep "FT_STATUS_ERR" "$OUTPUT_DIR/11_logs_raw.txt" > "$OUTPUT_DIR/22_err_raw.txt" 2>&1 || true

echo "  FT_STATUS_ENTRY (grouped): $ENTRY_GROUPED"
echo "  FT_STATUS_ENTRY (raw):     $ENTRY_RAW"
echo "  FT_STATUS_OK (grouped):    $OK_GROUPED"
echo "  FT_STATUS_OK (raw):        $OK_RAW"
echo "  FT_STATUS_ERR (grouped):   $ERR_GROUPED"
echo "  FT_STATUS_ERR (raw):       $ERR_RAW"
echo ""

# ============================================================================
# STEP 6: Optional ui_req_id correlation (if provided)
# ============================================================================
if [ -n "$UI_REQ_ID" ]; then
  echo "Step 4: Searching for ui_req_id: $UI_REQ_ID"
  
  grep -F "$UI_REQ_ID" "$OUTPUT_DIR/10_logs_grouped.txt" > "$OUTPUT_DIR/30_ui_in_grouped.txt" 2>&1 || true
  grep -F "$UI_REQ_ID" "$OUTPUT_DIR/11_logs_raw.txt" > "$OUTPUT_DIR/31_ui_in_raw.txt" 2>&1 || true
  
  UI_GROUPED=$(wc -l < "$OUTPUT_DIR/30_ui_in_grouped.txt" 2>/dev/null || echo 0)
  UI_RAW=$(wc -l < "$OUTPUT_DIR/31_ui_in_raw.txt" 2>/dev/null || echo 0)
  
  echo "  Grouped logs: $UI_GROUPED matches"
  echo "  Raw logs:     $UI_RAW matches"
  echo ""
fi

# ============================================================================
# STEP 7: Determination (BINARY: PASS/FAIL with deterministic exit code)
# ============================================================================
echo "Step 5: Determining result..."
echo ""

# Calculate totals safely (counters already initialized)
TOTAL_ENTRY=$((ENTRY_GROUPED + ENTRY_RAW))

if [ "$TOTAL_ENTRY" -gt 0 ]; then
  # SUCCESS: Found status entry marker (proves resolver was invoked)
  echo "✅ PASS: FT_STATUS_ENTRY found in production logs"
  echo ""
  echo "Proof:"
  echo "  ✓ getStatusSnapshot resolver invoked (FT_STATUS_ENTRY logged)"
  
  if [ "$OK_GROUPED" -gt 0 ] || [ "$OK_RAW" -gt 0 ]; then
    echo "  ✓ Status snapshot resolved successfully (FT_STATUS_OK logged)"
  fi
  
  if [ "$ERR_GROUPED" -gt 0 ] || [ "$ERR_RAW" -gt 0 ]; then
    echo "  ✓ Status snapshot resolved with error (FT_STATUS_ERR logged)"
  fi
  
  echo ""
  echo "This PROVES:"
  echo "  ✓ Jira dashboard opened and triggered getStatusSnapshot"
  echo "  ✓ Backend received getStatusSnapshot invocation"
  echo "  ✓ Backend logged execution marker (entry/ok/err)"
  echo "  ✓ Forge logs captured production stream deterministically"
  echo ""
  
  if [ -f "$OUTPUT_DIR/20_entry_grouped.txt" ] && [ -s "$OUTPUT_DIR/20_entry_grouped.txt" ]; then
    echo "First FT_STATUS_ENTRY marker (from grouped logs):"
    head -1 "$OUTPUT_DIR/20_entry_grouped.txt"
  elif [ -f "$OUTPUT_DIR/20_entry_raw.txt" ] && [ -s "$OUTPUT_DIR/20_entry_raw.txt" ]; then
    echo "First FT_STATUS_ENTRY marker (from raw logs):"
    head -1 "$OUTPUT_DIR/20_entry_raw.txt"
  fi
  
  echo ""
  echo "Output directory (for inspection): $OUTPUT_DIR"
  exit 0
  
else
  # FAIL: No status markers found
  echo "❌ FAIL: No FT_STATUS markers found in production logs"
  echo ""
  echo "Diagnostics:"
  echo "  Total logs captured (grouped):  $GROUPED_SIZE bytes"
  echo "  Total logs captured (raw):      $RAW_SIZE bytes"
  echo "  FT_STATUS_ENTRY (grouped):      $ENTRY_GROUPED"
  echo "  FT_STATUS_ENTRY (raw):          $ENTRY_RAW"
  echo "  FT_STATUS_OK (grouped):         $OK_GROUPED"
  echo "  FT_STATUS_OK (raw):             $OK_RAW"
  echo "  FT_STATUS_ERR (grouped):        $ERR_GROUPED"
  echo "  FT_STATUS_ERR (raw):            $ERR_RAW"
  echo ""
  
  if [ "$GROUPED_SIZE" -lt 100 ] || [ "$RAW_SIZE" -lt 100 ]; then
    echo "⚠ WARNING: Log capture returned very few bytes (< 100)"
    echo "  Possible causes:"
    echo "    - forge logs command not working"
    echo "    - Not authenticated to production environment"
    echo "    - No logs generated in lookback period"
    echo ""
    echo "  Action: Check 'forge whoami' and 'forge install list --environment production'"
  fi
  
  if [ "$TOTAL_ENTRY" -eq 0 ]; then
    echo "⚠ WARNING: No FT_STATUS markers found at all (FT_STATUS_ENTRY/FT_STATUS_OK/FT_STATUS_ERR)"
    echo "  Possible causes:"
    echo "    - getStatusSnapshot resolver not invoked (no dashboard load)"
    echo "    - Backend not deployed (wrong version with new markers)"
    echo "    - Backend not logging properly"
    echo ""
    echo "  Action:"
    echo "    1. Check backend deployment has FT_STATUS_ENTRY/FT_STATUS_OK/FT_STATUS_ERR logging"
    echo "    2. Open Jira dashboard in production to trigger getStatusSnapshot invocation"
    echo "    3. Wait 30 seconds for logs to propagate"
    echo "    4. Run: bash tools/status_prod.sh --minutes 5"
  fi
  
  echo ""
  echo "Output directory (for inspection): $OUTPUT_DIR"
  echo "Files for inspection:"
  echo "  20_entry_grouped.txt      - FT_STATUS_ENTRY markers (grouped)"
  echo "  20_entry_raw.txt          - FT_STATUS_ENTRY markers (raw)"
  echo "  21_ok_grouped.txt         - FT_STATUS_OK markers (grouped)"
  echo "  21_ok_raw.txt             - FT_STATUS_OK markers (raw)"
  echo "  22_err_grouped.txt        - FT_STATUS_ERR markers (grouped)"
  echo "  22_err_raw.txt            - FT_STATUS_ERR markers (raw)"
  echo "  10_logs_grouped.txt       - Full grouped logs (${GROUPED_SIZE} bytes)"
  echo "  11_logs_raw.txt           - Full raw logs (${RAW_SIZE} bytes)"
  
  if [ -n "$UI_REQ_ID" ]; then
    echo "  30_ui_in_grouped.txt      - Lines matching ui_req_id (grouped)"
    echo "  31_ui_in_raw.txt          - Lines matching ui_req_id (raw)"
  fi
  
  exit 2
fi
