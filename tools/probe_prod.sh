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
#   1 = ERROR (invalid arguments, placeholder nonce, etc.)

set -euo pipefail

# ============================================================================
# SAFE COUNTER HELPER: Always returns a number, never crashes
# ============================================================================
count_fixed() {
  # $1 = fixed-string pattern to search for
  # $2 = file path to search in
  local pat="$1"
  local file="$2"
  
  if [ ! -f "$file" ]; then
    echo "0"
    return 0
  fi
  
  # Use rg with fixed-string matching, count lines, strip whitespace
  local count
  count=$(rg -F "$pat" "$file" 2>/dev/null | wc -l | tr -d ' ')
  echo "${count:-0}"
}

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
  exit 1
fi

# CRITICAL: Refuse placeholder nonces (< > or PASTE markers)
case "$PROBE_NONCE" in
  *"<PASTE_NONCE>"*|*"PASTE_NONCE"*|*"<"*|*">"*|*"<nonce>"*|*"nonce>"*)
    echo "❌ ERROR: nonce looks like a placeholder: $PROBE_NONCE"
    echo ""
    echo "USAGE: bash tools/probe_prod.sh --nonce <PROBE_NONCE> [--ui <UI_REQ_ID>] [--minutes <N>]"
    echo ""
    echo "Examples:"
    echo "  bash tools/probe_prod.sh --nonce probe_1768662844441_af14b920"
    echo "  bash tools/probe_prod.sh --nonce probe_1768662844441_af14b920 --ui ui_1768660190864_d8f211a2"
    exit 1
    ;;
esac

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

# Store paths in variables for later use
GROUPED_LOG="$OUTPUT_DIR/10_logs_grouped.txt"
RAW_LOG="$OUTPUT_DIR/11_logs_raw.txt"

# GROUPED format
echo "  Fetching grouped logs..."
timeout 120 forge logs --environment production --limit 8000 --since "${MINUTES}m" --grouped > "$GROUPED_LOG" 2>&1 || true

# RAW format (no grouping, might have different formatting)
echo "  Fetching raw logs..."
timeout 120 forge logs --environment production --limit 8000 --since "${MINUTES}m" > "$RAW_LOG" 2>&1 || true

# Show log capture sizes
GROUPED_SIZE=$(wc -c < "$GROUPED_LOG" 2>/dev/null || echo 0)
RAW_SIZE=$(wc -c < "$RAW_LOG" 2>/dev/null || echo 0)
echo "  Grouped logs: $GROUPED_SIZE bytes"
echo "  Raw logs:     $RAW_SIZE bytes"
echo ""

# ============================================================================
# STEP 3: Search for markers using deterministic fixed-string patterns
# ============================================================================
echo "Step 3: Searching for FT_PROBE markers and nonce..."

# Define all search patterns (safe, deterministic)
PAT_MARKER="FT_PROBE_MARKER"
PAT_ENTRY="FT_PROBE_ENTRY"
PAT_OK="FT_PROBE_OK"
PAT_ERR="FT_PROBE_ERR"
PAT_JSON_NONCE="\"ui_local_probe_nonce\":\"$PROBE_NONCE\""

# Initialize ALL counters (prevents unset variable errors)
MARKER_GROUPED=0
MARKER_RAW=0
ENTRY_GROUPED=0
ENTRY_RAW=0
OK_GROUPED=0
OK_RAW=0
ERR_GROUPED=0
ERR_RAW=0
NONCE_GROUPED=0
NONCE_RAW=0
PROBE_ANY_GROUPED=0
PROBE_ANY_RAW=0

# Count FT_PROBE_MARKER occurrences (structured JSON)
MARKER_GROUPED=$(count_fixed "$PAT_MARKER" "$GROUPED_LOG")
MARKER_RAW=$(count_fixed "$PAT_MARKER" "$RAW_LOG")

# Count nonce in JSON context (PRIMARY PASS condition)
NONCE_GROUPED=$(count_fixed "$PAT_JSON_NONCE" "$GROUPED_LOG")
NONCE_RAW=$(count_fixed "$PAT_JSON_NONCE" "$RAW_LOG")

# Count phase markers for diagnostics
ENTRY_GROUPED=$(count_fixed "$PAT_ENTRY" "$GROUPED_LOG")
ENTRY_RAW=$(count_fixed "$PAT_ENTRY" "$RAW_LOG")
OK_GROUPED=$(count_fixed "$PAT_OK" "$GROUPED_LOG")
OK_RAW=$(count_fixed "$PAT_OK" "$RAW_LOG")
ERR_GROUPED=$(count_fixed "$PAT_ERR" "$GROUPED_LOG")
ERR_RAW=$(count_fixed "$PAT_ERR" "$RAW_LOG")

# Count any PROBE markers (fallback diagnostic)
PROBE_ANY_GROUPED=$((ENTRY_GROUPED + OK_GROUPED + ERR_GROUPED))
PROBE_ANY_RAW=$((ENTRY_RAW + OK_RAW + ERR_RAW))

echo "  FT_PROBE_MARKER (grouped): $MARKER_GROUPED"
echo "  FT_PROBE_MARKER (raw):     $MARKER_RAW"
echo "  JSON nonce match (grouped): $NONCE_GROUPED"
echo "  JSON nonce match (raw):     $NONCE_RAW"
echo ""
echo "  Phase markers (diagnostics):"
echo "    FT_PROBE_ENTRY (grouped/raw): $ENTRY_GROUPED / $ENTRY_RAW"
echo "    FT_PROBE_OK (grouped/raw):     $OK_GROUPED / $OK_RAW"
echo "    FT_PROBE_ERR (grouped/raw):    $ERR_GROUPED / $ERR_RAW"
echo ""

# ============================================================================
# STEP 4: Conditional grep by ui_req_id (only if provided)
# ============================================================================
if [ -n "$UI_REQ_ID" ]; then
  echo "Step 4: Searching for ui_req_id: $UI_REQ_ID"
  
  grep -F "$UI_REQ_ID" "$GROUPED_LOG" > "$OUTPUT_DIR/30_ui_in_grouped.txt" 2>&1 || true
  grep -F "$UI_REQ_ID" "$RAW_LOG" > "$OUTPUT_DIR/31_ui_in_raw.txt" 2>&1 || true
  
  UI_GROUPED=$(wc -l < "$OUTPUT_DIR/30_ui_in_grouped.txt" 2>/dev/null || echo 0)
  UI_RAW=$(wc -l < "$OUTPUT_DIR/31_ui_in_raw.txt" 2>/dev/null || echo 0)
  
  echo "  Grouped logs: $UI_GROUPED matches"
  echo "  Raw logs:     $UI_RAW matches"
  echo ""
else
  echo "Step 4: Skipping ui_req_id grep (not provided with --ui flag)"
  echo ""
fi

# ============================================================================
# STEP 5: DETERMINISTIC VERDICT (PASS/FAIL BINARY)
# ============================================================================
echo "════════════════════════════════════════════════════════════════"
echo "VERDICT"
echo "════════════════════════════════════════════════════════════════"
echo ""

# Compute totals (all counters guaranteed to be initialized above)
TOTAL_NONCE=$((NONCE_GROUPED + NONCE_RAW))
TOTAL_MARKER=$((MARKER_GROUPED + MARKER_RAW))

# PASS if JSON nonce match found (PRIMARY condition)
if [ "$TOTAL_NONCE" -gt 0 ]; then
  echo "✅ PASS: Nonce found in production logs"
  echo ""
  echo "Proof:"
  echo "  ✓ UI nonce: $PROBE_NONCE"
  echo "  ✓ FT_PROBE_MARKER entries found: $TOTAL_MARKER"
  echo "  ✓ JSON nonce matches: $TOTAL_NONCE"
  echo "  ✓ Phase markers (entry/ok/err): $ENTRY_GROUPED+$ENTRY_RAW / $OK_GROUPED+$OK_RAW / $ERR_GROUPED+$ERR_RAW"
  echo ""
  echo "This PROVES:"
  echo "  ✓ UI generated deterministic nonce: $PROBE_NONCE"
  echo "  ✓ UI invoked probe resolver with nonce"
  echo "  ✓ Backend received and logged nonce in FT_PROBE_MARKER"
  echo "  ✓ Backend execution proven by structured JSON in logs"
  echo "  ✓ Forge logs captured production stream deterministically"
  echo ""
  echo "Output directory (for inspection): $OUTPUT_DIR"
  exit 0
fi

# FAIL: No nonce match found
echo "❌ FAIL: Nonce NOT found in production logs"
echo ""
echo "Diagnostics:"
echo "  Total logs captured (grouped):  $GROUPED_SIZE bytes"
echo "  Total logs captured (raw):      $RAW_SIZE bytes"
echo "  FT_PROBE_MARKER (grouped/raw):  $MARKER_GROUPED / $MARKER_RAW"
echo "  JSON nonce match (grouped/raw): $NONCE_GROUPED / $NONCE_RAW"
echo "  Phase markers:"
echo "    FT_PROBE_ENTRY (grouped/raw): $ENTRY_GROUPED / $ENTRY_RAW"
echo "    FT_PROBE_OK (grouped/raw):     $OK_GROUPED / $OK_RAW"
echo "    FT_PROBE_ERR (grouped/raw):    $ERR_GROUPED / $ERR_RAW"
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

if [ "$PROBE_ANY_GROUPED" -eq 0 ] && [ "$PROBE_ANY_RAW" -eq 0 ]; then
  echo "⚠ WARNING: No PROBE phase markers found at all (ENTRY/OK/ERR)"
  echo "  Possible causes:"
  echo "    - Probe resolver not invoked from UI"
  echo "    - Backend not deployed with new phase markers"
  echo "    - Backend not logging properly"
  echo ""
  echo "  Action: Verify:"
  echo "    1. Probe button exists in UI"
  echo "    2. Click probe button to trigger invocation"
  echo "    3. Verify backend deployment includes FT_PROBE_ENTRY/OK/ERR logging"
fi

echo ""
echo "Output directory (for inspection): $OUTPUT_DIR"
echo "Files for inspection:"
echo "  10_logs_grouped.txt       - Full grouped logs (${GROUPED_SIZE} bytes)"
echo "  11_logs_raw.txt           - Full raw logs (${RAW_SIZE} bytes)"
echo "  00_whoami.txt             - forge whoami output"
echo "  01_install_list.txt       - forge install list output"

if [ -n "$UI_REQ_ID" ]; then
  echo "  30_ui_in_grouped.txt      - Lines matching ui_req_id (grouped)"
  echo "  31_ui_in_raw.txt          - Lines matching ui_req_id (raw)"
fi

exit 2
