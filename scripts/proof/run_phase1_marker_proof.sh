#!/bin/bash
# run_phase1_marker_proof.sh
# Proof: Verify Phase1 success marker [PHASE1_ACCESS_SCAN_OK] is returned in payload

set -e

PROOF_DIR="/tmp/phase1_marker_proof_$$"
mkdir -p "$PROOF_DIR"

echo "═════════════════════════════════════════════════════════════════════"
echo "PHASE1 SUCCESS MARKER PROOF"
echo "═════════════════════════════════════════════════════════════════════"
echo ""

# Set environment
export JIRA_BASE_URL="https://firsttry.atlassian.net"
export JIRA_DASHBOARD_URL="https://firsttry.atlassian.net/jira/dashboards/10102"
unset FT_FORCE_FORGE_CONSOLE_ERROR
export FT_ASSERT_DETERMINISTIC_HASH=1
export FT_DETERMINISTIC_IFRAME_SRC_HASH_ONLY=1

cd /workspaces/Firsttry/atlassian/forge-app

echo "[PROOF] Running Playwright dashboard diagnostics (NO-INJECTION)..."
echo ""

# Run the Playwright test
if npx playwright test dashboard-phase1-diagnostics.spec.ts --no-header 2>&1 | tee "$PROOF_DIR/test_output.txt"; then
  TEST_EXIT=0
else
  TEST_EXIT=$?
fi

echo ""
echo "Test exit code: $TEST_EXIT"
echo ""

# Extract the output directory
OUT_DIR="$(ls -1dt /tmp/pw_dash_diag_* 2>/dev/null | head -1)"
if [ -z "$OUT_DIR" ]; then
  echo "[PROOF] ❌ No output directory found (test may not have completed)"
  exit 1
fi

echo "[PROOF] Output directory: $OUT_DIR"
echo ""

# Check for console log file
CONSOLE_FILE="$OUT_DIR/console.log"
if [ ! -f "$CONSOLE_FILE" ]; then
  echo "[PROOF] ❌ Console log not found at $CONSOLE_FILE"
  exit 1
fi

echo "[PROOF] Console log size: $(wc -c < "$CONSOLE_FILE") bytes"
echo ""

# === CHECK 1: Must find marker [PHASE1_ACCESS_SCAN_OK] ===
echo "[CHECK 1] Searching for marker: [PHASE1_ACCESS_SCAN_OK]"
MARKER_HITS=$(grep -c "\[PHASE1_ACCESS_SCAN_OK\]" "$CONSOLE_FILE" || true)
if [ "$MARKER_HITS" -gt 0 ]; then
  echo "         ✅ FOUND: $MARKER_HITS occurrence(s)"
  echo ""
  echo "         Marker lines:"
  grep "\[PHASE1_ACCESS_SCAN_OK\]" "$CONSOLE_FILE" | head -5 | sed 's/^/         /'
else
  echo "         ❌ FAILED: Marker not found"
  echo ""
  echo "[PROOF] Full console output (last 100 lines):"
  tail -100 "$CONSOLE_FILE"
  exit 1
fi

echo ""

# === CHECK 2: Must NOT find failure marker [PHASE1_ACCESS_SCAN_FAILED] ===
echo "[CHECK 2] Searching for failure marker: [PHASE1_ACCESS_SCAN_FAILED]"
FAIL_HITS=$(grep -c "\[PHASE1_ACCESS_SCAN_FAILED\]" "$CONSOLE_FILE" || true)
if [ "$FAIL_HITS" -eq 0 ]; then
  echo "         ✅ PASSED: No failure markers found"
else
  echo "         ❌ FAILED: Found $FAIL_HITS failure marker(s)"
  grep "\[PHASE1_ACCESS_SCAN_FAILED\]" "$CONSOLE_FILE" | head -5 | sed 's/^/         /'
  exit 1
fi

echo ""

# === CHECK 3: Marker JSON must be parseable ===
echo "[CHECK 3] Validating marker JSON format"
MARKER_LINE=$(grep "\[PHASE1_ACCESS_SCAN_OK\]" "$CONSOLE_FILE" | head -1)
if [[ $MARKER_LINE =~ \[PHASE1_ACCESS_SCAN_OK\][[:space:]]*(\{.*\}) ]]; then
  MARKER_JSON="${BASH_REMATCH[1]}"
  if echo "$MARKER_JSON" | jq . >/dev/null 2>&1; then
    echo "         ✅ PASSED: JSON is valid"
    echo "         ✅ PASSED: marker = $(echo "$MARKER_JSON" | jq -r '.marker')"
    echo "         ✅ PASSED: action = $(echo "$MARKER_JSON" | jq -r '.action')"
  else
    echo "         ❌ FAILED: JSON parsing failed"
    echo "         JSON: $MARKER_JSON"
    exit 1
  fi
else
  echo "         ❌ FAILED: Could not extract JSON from marker line"
  echo "         Line: $MARKER_LINE"
  exit 1
fi

echo ""

# === FINAL VERDICT ===
echo "═════════════════════════════════════════════════════════════════════"
if [ "$TEST_EXIT" -eq 0 ] && [ "$MARKER_HITS" -gt 0 ] && [ "$FAIL_HITS" -eq 0 ]; then
  echo "✅ PHASE1 SUCCESS MARKER PROOF: PASSED"
  echo ""
  echo "Proof Summary:"
  echo "  • Marker [PHASE1_ACCESS_SCAN_OK] found: YES ($MARKER_HITS occurrence)"
  echo "  • Failure marker [PHASE1_ACCESS_SCAN_FAILED] found: NO"
  echo "  • Marker JSON valid: YES"
  echo "  • Test exit code: $TEST_EXIT (success)"
  echo "  • Output directory: $OUT_DIR"
  echo ""
  
  # Save proof artifacts
  cp "$CONSOLE_FILE" /tmp/phase1_marker_proof_console.log
  echo "$MARKER_JSON" > /tmp/phase1_marker_proof_json.json
  
  echo "Proof artifacts saved:"
  echo "  • /tmp/phase1_marker_proof_console.log"
  echo "  • /tmp/phase1_marker_proof_json.json"
  echo "  • /tmp/phase1_marker_proof.log (this output)"
  
  exit 0
else
  echo "❌ PHASE1 SUCCESS MARKER PROOF: FAILED"
  echo ""
  echo "Proof Summary:"
  echo "  • Marker [PHASE1_ACCESS_SCAN_OK] found: $([ "$MARKER_HITS" -gt 0 ] && echo "YES" || echo "NO")"
  echo "  • Failure marker [PHASE1_ACCESS_SCAN_FAILED] found: $([ "$FAIL_HITS" -gt 0 ] && echo "YES" || echo "NO")"
  echo "  • Test exit code: $TEST_EXIT"
  echo "  • Output directory: $OUT_DIR"
  echo ""
  
  # Save debug output
  cp "$CONSOLE_FILE" /tmp/phase1_marker_proof_console_FAILED.log
  tail -200 "$CONSOLE_FILE" > /tmp/phase1_marker_proof_FAILED.log
  
  exit 1
fi
