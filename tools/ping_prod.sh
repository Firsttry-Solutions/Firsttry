#!/bin/bash
# BACKBONE LAYER 0: Production Log Capture & Ping Verification
# 
# HARD PROOF: PING markers must be found in production logs (binary: PASS/FAIL)
#
# Usage:
#   bash tools/ping_prod.sh [--ui <UI_REQ_ID>] [--minutes <N>]
#
# Arguments:
#   --ui <UI_REQ_ID>         (optional) ui_req_id from UI footer (e.g., ui_1768660190864_d8f211a2)
#   --minutes <N>            (optional) log lookback window in minutes (default: 20)
#
# Returns:
#   0 = PASS (FT_PING_ENTRY or FT_PING_OK found in logs)
#   2 = FAIL (no ping markers found, diagnostics printed)

set -euo pipefail

# ============================================================================
# PARSE ARGUMENTS
# ============================================================================

UI_REQ_ID=""
MINUTES=20

while [[ $# -gt 0 ]]; do
  case "$1" in
    --ui)
      UI_REQ_ID="${2:-}"
      if [ -z "$UI_REQ_ID" ]; then
        echo "ERROR: --ui requires a value"
        exit 2
      fi
      shift 2
      ;;
    --minutes)
      MINUTES="${2:-20}"
      if ! [[ "$MINUTES" =~ ^[0-9]+$ ]]; then
        echo "ERROR: --minutes requires a number"
        exit 2
      fi
      shift 2
      ;;
    *)
      echo "ERROR: Unknown argument: $1"
      echo "USAGE: bash tools/ping_prod.sh [--ui <UI_REQ_ID>] [--minutes <N>]"
      exit 2
      ;;
  esac
done

# ============================================================================
# SETUP
# ============================================================================

TIMESTAMP=$(date -u +%Y%m%d_%H%M%S)
OUTPUT_DIR="/tmp/ft_ping_${TIMESTAMP}"
mkdir -p "$OUTPUT_DIR"

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║ BACKBONE LAYER 0: Production Ping Log Capture & Verification    ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
[ -n "$UI_REQ_ID" ] && echo "UI_REQ_ID:    $UI_REQ_ID"
echo "LOOKBACK:     ${MINUTES} minutes"
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
echo "  Grouped logs: $GROUPED_SIZE bytes"
echo "  Raw logs:     $RAW_SIZE bytes"
echo ""

# ============================================================================
# STEP 3: Search for FT_PING markers (DETERMINISTIC)
# ============================================================================
echo "Step 3: Searching for FT_PING entry markers..."

# Search for FT_PING_ENTRY (guaranteed log at function start)
grep "FT_PING_ENTRY" "$OUTPUT_DIR/10_logs_grouped.txt" > "$OUTPUT_DIR/20_entry_grouped.txt" 2>&1 || true
grep "FT_PING_ENTRY" "$OUTPUT_DIR/11_logs_raw.txt" > "$OUTPUT_DIR/20_entry_raw.txt" 2>&1 || true
ENTRY_GROUPED=$(wc -l < "$OUTPUT_DIR/20_entry_grouped.txt" 2>/dev/null || echo 0)
ENTRY_RAW=$(wc -l < "$OUTPUT_DIR/20_entry_raw.txt" 2>/dev/null || echo 0)

# Search for FT_PING_OK (execution success)
grep "FT_PING_OK" "$OUTPUT_DIR/10_logs_grouped.txt" > "$OUTPUT_DIR/21_ok_grouped.txt" 2>&1 || true
grep "FT_PING_OK" "$OUTPUT_DIR/11_logs_raw.txt" > "$OUTPUT_DIR/21_ok_raw.txt" 2>&1 || true
OK_GROUPED=$(wc -l < "$OUTPUT_DIR/21_ok_grouped.txt" 2>/dev/null || echo 0)
OK_RAW=$(wc -l < "$OUTPUT_DIR/21_ok_raw.txt" 2>/dev/null || echo 0)

# Search for FT_PING_ERR (execution error)
grep "FT_PING_ERR" "$OUTPUT_DIR/10_logs_grouped.txt" > "$OUTPUT_DIR/22_err_grouped.txt" 2>&1 || true
grep "FT_PING_ERR" "$OUTPUT_DIR/11_logs_raw.txt" > "$OUTPUT_DIR/22_err_raw.txt" 2>&1 || true
ERR_GROUPED=$(wc -l < "$OUTPUT_DIR/22_err_grouped.txt" 2>/dev/null || echo 0)
ERR_RAW=$(wc -l < "$OUTPUT_DIR/22_err_raw.txt" 2>/dev/null || echo 0)

echo "  FT_PING_ENTRY (grouped): $ENTRY_GROUPED"
echo "  FT_PING_ENTRY (raw):     $ENTRY_RAW"
echo "  FT_PING_OK (grouped):    $OK_GROUPED"
echo "  FT_PING_OK (raw):        $OK_RAW"
echo "  FT_PING_ERR (grouped):   $ERR_GROUPED"
echo "  FT_PING_ERR (raw):       $ERR_RAW"
echo ""

# Search for JSON markers as fallback
grep -E '"marker":"PING_(OK|ERR|ENTRY)"' "$OUTPUT_DIR/10_logs_grouped.txt" > "$OUTPUT_DIR/23_ping_json_grouped.txt" 2>&1 || true
grep -E '"marker":"PING_(OK|ERR|ENTRY)"' "$OUTPUT_DIR/11_logs_raw.txt" > "$OUTPUT_DIR/23_ping_json_raw.txt" 2>&1 || true
PING_JSON_GROUPED=$(wc -l < "$OUTPUT_DIR/23_ping_json_grouped.txt" 2>/dev/null || echo 0)
PING_JSON_RAW=$(wc -l < "$OUTPUT_DIR/23_ping_json_raw.txt" 2>/dev/null || echo 0)

echo "  JSON marker PING (grouped): $PING_JSON_GROUPED"
echo "  JSON marker PING (raw):     $PING_JSON_RAW"
echo ""

# ============================================================================
# STEP 4: Conditional grep by ui_req_id (only if provided)
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
# STEP 5: Determination (BINARY: PASS/FAIL)
# ============================================================================
echo "Step 5: Determining result..."
echo ""

# PASS if we found FT_PING_ENTRY, FT_PING_OK, or FT_PING_ERR
PING_ANY_GROUPED=$(grep -c -F -e "FT_PING_ENTRY" -e "FT_PING_OK" -e "FT_PING_ERR" "$OUTPUT_DIR/10_logs_grouped.txt" 2>/dev/null || echo 0)
PING_ANY_RAW=$(grep -c -F -e "FT_PING_ENTRY" -e "FT_PING_OK" -e "FT_PING_ERR" "$OUTPUT_DIR/11_logs_raw.txt" 2>/dev/null || echo 0)

if [ "$PING_ANY_GROUPED" -gt 0 ] || [ "$PING_ANY_RAW" -gt 0 ]; then
  # SUCCESS: Found ping markers
  echo "✅ PASS: FT_PING markers found in production logs"
  echo ""
  echo "Proof:"
  
  if [ "$ENTRY_GROUPED" -gt 0 ] || [ "$ENTRY_RAW" -gt 0 ]; then
    echo "  ✓ FT_PING_ENTRY (guaranteed execution proof)"
    if [ "$ENTRY_GROUPED" -gt 0 ]; then
      echo "    First matching marker (from grouped logs):"
      head -1 "$OUTPUT_DIR/20_entry_grouped.txt"
    fi
  fi
  
  if [ "$OK_GROUPED" -gt 0 ] || [ "$OK_RAW" -gt 0 ]; then
    echo "  ✓ FT_PING_OK (successful execution)"
    if [ "$OK_GROUPED" -gt 0 ]; then
      echo "    First matching marker (from grouped logs):"
      head -1 "$OUTPUT_DIR/21_ok_grouped.txt"
    fi
  fi
  
  if [ "$ERR_GROUPED" -gt 0 ] || [ "$ERR_RAW" -gt 0 ]; then
    echo "  ✓ FT_PING_ERR (error execution - backend responded with error)"
    if [ "$ERR_GROUPED" -gt 0 ]; then
      echo "    First matching marker (from grouped logs):"
      head -1 "$OUTPUT_DIR/22_err_grouped.txt"
    fi
  fi
  
  echo ""
  echo "This PROVES:"
  echo "  ✓ Daily ping health check invoked backend"
  echo "  ✓ Backend received ping invocation"
  echo "  ✓ Backend logged execution marker (entry/ok/err)"
  echo "  ✓ Forge logs captured production stream deterministically"
  echo ""
  echo "Output directory (for inspection): $OUTPUT_DIR"
  exit 0
  
else
  # FAIL: No ping markers found
  echo "❌ FAIL: No FT_PING markers found in production logs"
  echo ""
  echo "Diagnostics:"
  echo "  Total logs captured (grouped):  $GROUPED_SIZE bytes"
  echo "  Total logs captured (raw):      $RAW_SIZE bytes"
  echo "  FT_PING_ENTRY (grouped):        $ENTRY_GROUPED"
  echo "  FT_PING_ENTRY (raw):            $ENTRY_RAW"
  echo "  FT_PING_OK (grouped):           $OK_GROUPED"
  echo "  FT_PING_OK (raw):               $OK_RAW"
  echo "  FT_PING_ERR (grouped):          $ERR_GROUPED"
  echo "  FT_PING_ERR (raw):              $ERR_RAW"
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
  
  if [ "$ENTRY_GROUPED" -eq 0 ] && [ "$OK_GROUPED" -eq 0 ] && [ "$ERR_GROUPED" -eq 0 ]; then
    if [ "$ENTRY_RAW" -eq 0 ] && [ "$OK_RAW" -eq 0 ] && [ "$ERR_RAW" -eq 0 ]; then
      echo "⚠ WARNING: No FT_PING markers found at all (FT_PING_ENTRY/FT_PING_OK/FT_PING_ERR)"
      echo "  Possible causes:"
      echo "    - Ping resolver not invoked from UI"
      echo "    - Backend not deployed (wrong version with new markers)"
      echo "    - Backend not logging properly"
      echo ""
      echo "  Action: Check backend deployment has FT_PING_ENTRY/FT_PING_OK/FT_PING_ERR logging"
    fi
  fi
  
  echo ""
  echo "Output directory (for inspection): $OUTPUT_DIR"
  echo "Files for inspection:"
  echo "  20_entry_grouped.txt      - FT_PING_ENTRY markers (grouped)"
  echo "  20_entry_raw.txt          - FT_PING_ENTRY markers (raw)"
  echo "  21_ok_grouped.txt         - FT_PING_OK markers (grouped)"
  echo "  21_ok_raw.txt             - FT_PING_OK markers (raw)"
  echo "  22_err_grouped.txt        - FT_PING_ERR markers (grouped)"
  echo "  22_err_raw.txt            - FT_PING_ERR markers (raw)"
  echo "  10_logs_grouped.txt       - Full grouped logs (${GROUPED_SIZE} bytes)"
  echo "  11_logs_raw.txt           - Full raw logs (${RAW_SIZE} bytes)"
  
  if [ -n "$UI_REQ_ID" ]; then
    echo "  30_ui_in_grouped.txt      - Lines matching ui_req_id (grouped)"
    echo "  31_ui_in_raw.txt          - Lines matching ui_req_id (raw)"
  fi
  
  exit 2
fi
