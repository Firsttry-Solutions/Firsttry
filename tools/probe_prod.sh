#!/bin/bash
# FORENSIC_PROBE: Production Log Capture & Correlation Verification
# 
# HARD PROOF: Nonce must be found in production logs (binary: PASS/FAIL)
#
# Usage:
#   bash tools/probe_prod.sh --nonce <PROBE_NONCE> [--ui <UI_REQ_ID>] [--minutes <N>]
#
# Arguments:
#   --nonce <PROBE_NONCE>    (REQUIRED) probe_nonce from UI (e.g., probe_1768662844441_af14b920)
#   --ui <UI_REQ_ID>         (optional) ui_req_id from UI footer (e.g., ui_1768660190864_d8f211a2)
#   --minutes <N>            (optional) log lookback window in minutes (default: 20)
#
# Returns:
#   0 = PASS (nonce found in logs)
#   2 = FAIL (nonce NOT found, diagnostics printed)

set -euo pipefail

# ============================================================================
# PARSE ARGUMENTS
# ============================================================================

PROBE_NONCE=""
UI_REQ_ID=""
MINUTES=20

while [[ $# -gt 0 ]]; do
  case "$1" in
    --nonce)
      PROBE_NONCE="${2:-}"
      if [ -z "$PROBE_NONCE" ]; then
        echo "ERROR: --nonce requires a value"
        echo ""
        echo "USAGE: bash tools/probe_prod.sh --nonce <PROBE_NONCE> [--ui <UI_REQ_ID>] [--minutes <N>]"
        echo ""
        echo "Examples:"
        echo "  bash tools/probe_prod.sh --nonce probe_1768662844441_af14b920"
        echo "  bash tools/probe_prod.sh --nonce probe_1768662844441_af14b920 --ui ui_1768660190864_d8f211a2"
        echo "  bash tools/probe_prod.sh --nonce probe_1768662844441_af14b920 --minutes 30"
        exit 2
      fi
      shift 2
      ;;
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
      echo "USAGE: bash tools/probe_prod.sh --nonce <PROBE_NONCE> [--ui <UI_REQ_ID>] [--minutes <N>]"
      exit 2
      ;;
  esac
done

# CRITICAL: --nonce is required
if [ -z "$PROBE_NONCE" ]; then
  echo "ERROR: --nonce is required"
  echo "USAGE: bash tools/probe_prod.sh --nonce <PROBE_NONCE> [--ui <UI_REQ_ID>] [--minutes <N>]"
  exit 2
fi

# ============================================================================
# SETUP
# ============================================================================

TIMESTAMP=$(date -u +%Y%m%d_%H%M%S)
OUTPUT_DIR="/tmp/ft_probe_${TIMESTAMP}"
mkdir -p "$OUTPUT_DIR"

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║ FORENSIC_PROBE: Production Log Capture & Verification          ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "PROBE_NONCE:  $PROBE_NONCE"
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
# STEP 3: Search for plain-text PROBE markers (PROBE_ENTRY/PROBE_OK/PROBE_ERR)
# ============================================================================
echo "Step 3: Searching for plain-text PROBE markers..."

# Search for PROBE_ENTRY (proof of invocation)
grep -F "PROBE_ENTRY" "$OUTPUT_DIR/10_logs_grouped.txt" > "$OUTPUT_DIR/20_entry_grouped.txt" 2>&1 || true
grep -F "PROBE_ENTRY" "$OUTPUT_DIR/11_logs_raw.txt" > "$OUTPUT_DIR/20_entry_raw.txt" 2>&1 || true
ENTRY_GROUPED=$(wc -l < "$OUTPUT_DIR/20_entry_grouped.txt" 2>/dev/null || echo 0)
ENTRY_RAW=$(wc -l < "$OUTPUT_DIR/20_entry_raw.txt" 2>/dev/null || echo 0)

# Search for PROBE_OK (proof of success)
grep -F "PROBE_OK" "$OUTPUT_DIR/10_logs_grouped.txt" > "$OUTPUT_DIR/21_ok_grouped.txt" 2>&1 || true
grep -F "PROBE_OK" "$OUTPUT_DIR/11_logs_raw.txt" > "$OUTPUT_DIR/21_ok_raw.txt" 2>&1 || true
OK_GROUPED=$(wc -l < "$OUTPUT_DIR/21_ok_grouped.txt" 2>/dev/null || echo 0)
OK_RAW=$(wc -l < "$OUTPUT_DIR/21_ok_raw.txt" 2>/dev/null || echo 0)

# Search for PROBE_ERR (proof of error)
grep -F "PROBE_ERR" "$OUTPUT_DIR/10_logs_grouped.txt" > "$OUTPUT_DIR/22_err_grouped.txt" 2>&1 || true
grep -F "PROBE_ERR" "$OUTPUT_DIR/11_logs_raw.txt" > "$OUTPUT_DIR/22_err_raw.txt" 2>&1 || true
ERR_GROUPED=$(wc -l < "$OUTPUT_DIR/22_err_grouped.txt" 2>/dev/null || echo 0)
ERR_RAW=$(wc -l < "$OUTPUT_DIR/22_err_raw.txt" 2>/dev/null || echo 0)

echo "  PROBE_ENTRY (grouped): $ENTRY_GROUPED"
echo "  PROBE_ENTRY (raw):     $ENTRY_RAW"
echo "  PROBE_OK (grouped):    $OK_GROUPED"
echo "  PROBE_OK (raw):        $OK_RAW"
echo "  PROBE_ERR (grouped):   $ERR_GROUPED"
echo "  PROBE_ERR (raw):       $ERR_RAW"
echo ""

# Search for JSON markers as fallback
grep -E '"marker":"PROBE(_ERR)?"' "$OUTPUT_DIR/10_logs_grouped.txt" > "$OUTPUT_DIR/23_probe_json_grouped.txt" 2>&1 || true
grep -E '"marker":"PROBE(_ERR)?"' "$OUTPUT_DIR/11_logs_raw.txt" > "$OUTPUT_DIR/23_probe_json_raw.txt" 2>&1 || true
PROBE_JSON_GROUPED=$(wc -l < "$OUTPUT_DIR/23_probe_json_grouped.txt" 2>/dev/null || echo 0)
PROBE_JSON_RAW=$(wc -l < "$OUTPUT_DIR/23_probe_json_raw.txt" 2>/dev/null || echo 0)

echo "  JSON marker PROBE (grouped): $PROBE_JSON_GROUPED"
echo "  JSON marker PROBE (raw):     $PROBE_JSON_RAW"
echo ""

# ============================================================================
# STEP 4: Search for exact nonce (DEFINITIVE PROOF)
# ============================================================================
echo "Step 4: Searching for exact nonce: $PROBE_NONCE"

# Search with -F for literal string match (safest)
grep -F "$PROBE_NONCE" "$OUTPUT_DIR/10_logs_grouped.txt" > "$OUTPUT_DIR/21_nonce_in_grouped.txt" 2>&1 || true
grep -F "$PROBE_NONCE" "$OUTPUT_DIR/11_logs_raw.txt" > "$OUTPUT_DIR/22_nonce_in_raw.txt" 2>&1 || true

NONCE_GROUPED=$(wc -l < "$OUTPUT_DIR/21_nonce_in_grouped.txt" 2>/dev/null || echo 0)
NONCE_RAW=$(wc -l < "$OUTPUT_DIR/22_nonce_in_raw.txt" 2>/dev/null || echo 0)

echo "  Grouped logs: $NONCE_GROUPED matches"
echo "  Raw logs:     $NONCE_RAW matches"
echo ""

# ============================================================================
# STEP 5: Conditional grep by ui_req_id (only if provided)
# ============================================================================
if [ -n "$UI_REQ_ID" ]; then
  echo "Step 5: Searching for ui_req_id: $UI_REQ_ID"
  grep -F "$UI_REQ_ID" "$OUTPUT_DIR/10_logs_grouped.txt" > "$OUTPUT_DIR/30_ui_in_grouped.txt" 2>&1 || true
  grep -F "$UI_REQ_ID" "$OUTPUT_DIR/11_logs_raw.txt" > "$OUTPUT_DIR/31_ui_in_raw.txt" 2>&1 || true
  
  UI_GROUPED=$(wc -l < "$OUTPUT_DIR/30_ui_in_grouped.txt" 2>/dev/null || echo 0)
  UI_RAW=$(wc -l < "$OUTPUT_DIR/31_ui_in_raw.txt" 2>/dev/null || echo 0)
  
  echo "  Grouped logs: $UI_GROUPED matches"
  echo "  Raw logs:     $UI_RAW matches"
  echo ""
else
  echo "Step 5: Skipping ui_req_id grep (not provided with --ui flag)"
  echo ""
fi

# ============================================================================
# STEP 6: DETERMINISTIC VERDICT (PASS/FAIL ONLY)
# ============================================================================
echo "════════════════════════════════════════════════════════════════"
echo "VERDICT"
echo "════════════════════════════════════════════════════════════════"
echo ""

# PASS if nonce found in EITHER format
if [ "$NONCE_GROUPED" -gt 0 ] || [ "$NONCE_RAW" -gt 0 ]; then
  echo "✅ PASS: Nonce found in production logs"
  echo ""
  
  # Print first matching line (prefer raw if both have matches)
  if [ "$NONCE_RAW" -gt 0 ]; then
    echo "First matching line (from raw logs):"
    head -1 "$OUTPUT_DIR/22_nonce_in_raw.txt"
  else
    echo "First matching line (from grouped logs):"
    head -1 "$OUTPUT_DIR/21_nonce_in_grouped.txt"
  fi
  
  echo ""
  echo "This PROVES:"
  echo "  ✓ UI invoked the probe resolver successfully"
  echo "  ✓ Backend generated and returned the nonce"
  echo "  ✓ Backend logged the nonce to production logs"
  echo "  ✓ Forge logs system captured and returned the production stream"
  echo ""
  echo "Output directory (for inspection): $OUTPUT_DIR"
  exit 0
  
else
  # FAIL: No nonce found
  echo "❌ FAIL: Nonce NOT found in production logs"
  echo ""
  echo "Diagnostics:"
  echo "  Total logs captured (grouped):  $GROUPED_SIZE bytes"
  echo "  Total logs captured (raw):      $RAW_SIZE bytes"
  echo "  Any PROBE markers (grouped):    $PROBE_ANY_GROUPED"
  echo "  Any PROBE markers (raw):        $PROBE_ANY_RAW"
  echo "  Nonce matches (grouped):        $NONCE_GROUPED"
  echo "  Nonce matches (raw):            $NONCE_RAW"
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
  
  if [ "$ENTRY_GROUPED" -eq 0 ] && [ "$OK_GROUPED" -eq 0 ] && [ "$ERR_GROUPED" -eq 0 ] && [ "$PROBE_JSON_GROUPED" -eq 0 ]; then
    if [ "$ENTRY_RAW" -eq 0 ] && [ "$OK_RAW" -eq 0 ] && [ "$ERR_RAW" -eq 0 ] && [ "$PROBE_JSON_RAW" -eq 0 ]; then
      echo "⚠ WARNING: No PROBE markers found at all (PROBE_ENTRY/PROBE_OK/PROBE_ERR/JSON)"
      echo "  Possible causes:"
      echo "    - Probe resolver not invoked from UI"
      echo "    - Backend not deployed (wrong version with new markers)"
      echo "    - Backend not logging properly"
      echo ""
      echo "  Action: Check UI button exists, click it, verify backend deployment has PROBE_ENTRY/PROBE_OK/PROBE_ERR logging"
    fi
  fi
  
  echo ""
  echo "Output directory (for inspection): $OUTPUT_DIR"
  echo "Files for inspection:"
  echo "  20_probe_any_grouped.txt  - All PROBE markers (grouped)"
  echo "  23_probe_any_raw.txt      - All PROBE markers (raw)"
  echo "  10_logs_grouped.txt       - Full grouped logs (${GROUPED_SIZE} bytes)"
  echo "  11_logs_raw.txt           - Full raw logs (${RAW_SIZE} bytes)"
  
  if [ -n "$UI_REQ_ID" ]; then
    echo "  30_ui_in_grouped.txt      - Lines matching ui_req_id (grouped)"
    echo "  31_ui_in_raw.txt          - Lines matching ui_req_id (raw)"
  fi
  
  exit 2
fi
