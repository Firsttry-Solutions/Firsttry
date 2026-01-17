#!/bin/bash
# FORENSIC_PROBE: Production Log Capture & Correlation Verification
# 
# Usage: bash tools/probe_prod.sh <UI_REQ_ID> <PROBE_NONCE>
# 
# This script captures production logs and verifies the probe was logged
# and can be grepped by nonce (definitive proof of correlation).

set -euo pipefail

# Arguments
UI_REQ_ID="${1:-}"
PROBE_NONCE="${2:-}"

if [ -z "$UI_REQ_ID" ] || [ -z "$PROBE_NONCE" ]; then
  echo "USAGE: bash tools/probe_prod.sh <UI_REQ_ID> <PROBE_NONCE>"
  echo ""
  echo "Arguments:"
  echo "  UI_REQ_ID:   ui_req_id shown in gadget footer (e.g., ui_1768660190864_d8f211a2)"
  echo "  PROBE_NONCE: probe_nonce from Run Probe diagnostics (e.g., probe_1768662844441_af14b9209c)"
  exit 1
fi

# Create timestamped output directory
TIMESTAMP=$(date -u +%Y%m%d_%H%M%S)
OUTPUT_DIR="/tmp/ft_probe_${TIMESTAMP}"
mkdir -p "$OUTPUT_DIR"

echo "================================"
echo "FORENSIC_PROBE Production Capture"
echo "================================"
echo ""
echo "UI_REQ_ID:   $UI_REQ_ID"
echo "PROBE_NONCE: $PROBE_NONCE"
echo "Output dir:  $OUTPUT_DIR"
echo ""

cd "$(dirname "${BASH_SOURCE[0]}")/.."
cd atlassian/forge-app

# ============================================================================
# STEP 1: Environment proof (who is deploying, what was deployed)
# ============================================================================
echo "1) Capturing environment proof..."

forge whoami > "$OUTPUT_DIR/00_whoami.txt" 2>&1 || echo "forge whoami failed" > "$OUTPUT_DIR/00_whoami.txt"
forge install list --environment production > "$OUTPUT_DIR/01_install_list.txt" 2>&1 || echo "forge install list failed" > "$OUTPUT_DIR/01_install_list.txt"
git rev-parse HEAD > "$OUTPUT_DIR/02_git_head.txt" 2>&1 || echo "unknown" > "$OUTPUT_DIR/02_git_head.txt"
git rev-parse --short=7 HEAD >> "$OUTPUT_DIR/02_git_head.txt" 2>&1 || true

# ============================================================================
# STEP 2: Log capture (broad + time-windowed)
# ============================================================================
echo "2) Capturing production logs (this may take 30-60 seconds)..."

# WAY 1: Broad grouped logs
echo "   - Fetching 5000 grouped logs..."
timeout 90 forge logs --environment production --limit 5000 --grouped > "$OUTPUT_DIR/10_logs_grouped.txt" 2>&1 || {
  EXIT_CODE=$?
  if [ $EXIT_CODE -eq 124 ]; then
    echo "   WARNING: forge logs timed out (124). Logs may be incomplete."
  else
    echo "   WARNING: forge logs failed with code $EXIT_CODE. Logs may be incomplete."
  fi
}

# WAY 2: Recent time window (if supported)
echo "   - Fetching logs from last 2 hours..."
timeout 90 forge logs --environment production --since 2h --limit 5000 --grouped > "$OUTPUT_DIR/11_logs_since_2h.txt" 2>&1 || {
  EXIT_CODE=$?
  if [ $EXIT_CODE -eq 124 ]; then
    echo "   WARNING: forge logs --since timed out (124)"
  else
    echo "   INFO: --since flag not supported or returned error (not critical)"
  fi
}

# ============================================================================
# STEP 3: Grep for correlation proof
# ============================================================================
echo "3) Grepping for correlation markers..."

# Any PROBE marker
grep '"marker":"PROBE"' "$OUTPUT_DIR/10_logs_grouped.txt" 2>/dev/null | head -200 > "$OUTPUT_DIR/20_probe_any.txt" || true
echo "   - PROBE markers found: $(wc -l < "$OUTPUT_DIR/20_probe_any.txt")"

# By nonce (definitive)
grep "$PROBE_NONCE" "$OUTPUT_DIR/10_logs_grouped.txt" 2>/dev/null | head -200 > "$OUTPUT_DIR/21_probe_by_nonce.txt" || true
echo "   - Lines matching nonce: $(wc -l < "$OUTPUT_DIR/21_probe_by_nonce.txt")"

# By ui_req_id (should match nonce if correlation works)
grep "$UI_REQ_ID" "$OUTPUT_DIR/10_logs_grouped.txt" 2>/dev/null | head -200 > "$OUTPUT_DIR/22_probe_by_ui_req_id.txt" || true
echo "   - Lines matching ui_req_id: $(wc -l < "$OUTPUT_DIR/22_probe_by_ui_req_id.txt")"

# ============================================================================
# STEP 4: Deterministic verdict
# ============================================================================
echo ""
echo "================================"
echo "VERIFICATION RESULTS"
echo "================================"

NONCE_COUNT=$(wc -l < "$OUTPUT_DIR/21_probe_by_nonce.txt")
UI_COUNT=$(wc -l < "$OUTPUT_DIR/22_probe_by_ui_req_id.txt")

if [ "$NONCE_COUNT" -gt 0 ]; then
  echo "✅ PASS: Nonce found in production logs"
  echo ""
  echo "First matching PROBE line:"
  echo "---"
  head -1 "$OUTPUT_DIR/21_probe_by_nonce.txt"
  echo "---"
  echo ""
  echo "This PROVES:"
  echo "  1. Probe resolver was invoked"
  echo "  2. Backend logged the correlation data"
  echo "  3. forge logs is returning the production stream"
  echo ""
  echo "Grep commands for manual verification:"
  echo "  timeout 60 forge logs --environment production --limit 1000 | grep '$PROBE_NONCE'"
  echo "  timeout 60 forge logs --environment production --limit 1000 | grep '$UI_REQ_ID'"
  exit 0
else
  echo "❌ FAIL: Nonce NOT found in production logs"
  echo ""
  echo "This means ONE of:"
  echo "  1. Probe resolver was NOT invoked (UI issue)"
  echo "  2. Probe was invoked but NOT logged (backend issue)"
  echo "  3. Probe code not running (deploy issue)"
  echo "  4. forge logs not returning production stream (auth/env issue)"
  echo ""
  echo "Diagnostic info saved to: $OUTPUT_DIR"
  echo "Review these files:"
  echo "  - 00_whoami.txt (auth context)"
  echo "  - 01_install_list.txt (deployment status)"
  echo "  - 02_git_head.txt (code version)"
  echo "  - 10_logs_grouped.txt (production logs sample)"
  echo "  - 20_probe_any.txt (any PROBE markers)"
  echo ""
  echo "Manual test:"
  echo "  cd atlassian/forge-app"
  echo "  timeout 60 forge logs --environment production --limit 1000 | head -50"
  echo ""
  exit 2
fi
