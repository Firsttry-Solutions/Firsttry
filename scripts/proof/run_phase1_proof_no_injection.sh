#!/bin/bash
# run_phase1_proof_no_injection.sh
# PHASE 5A: Verify Phase1 completes successfully with [PHASE1_ACCESS_SCAN_OK] marker (NO-INJECTION)

set -e

OUTDIR="/tmp/phase1_proof_no_injection_$$"
mkdir -p "$OUTDIR"

echo "[PHASE5A_PROOF] Starting Phase1 no-injection success proof"
echo "[PHASE5A_PROOF] Output directory: $OUTDIR"
echo ""

# Set environment for no-injection run
export JIRA_BASE_URL="https://firsttry.atlassian.net"
export JIRA_DASHBOARD_URL="https://firsttry.atlassian.net/jira/dashboards/10102"
unset FT_FORCE_FORGE_CONSOLE_ERROR
export FT_ASSERT_DETERMINISTIC_HASH=1
export FT_DETERMINISTIC_IFRAME_SRC_HASH_ONLY=1

# Run test
cd /workspaces/Firsttry/atlassian/forge-app

echo "[PHASE5A_PROOF] Running: npx playwright test dashboard-phase1-diagnostics.spec.ts"
echo ""

# Run test and capture output (using playwright directly, not vitest)
if npx playwright test dashboard-phase1-diagnostics.spec.ts 2>&1 | tee "$OUTDIR/test_output.txt"; then
  TEST_STATUS="PASS"
  TEST_EXIT=0
else
  TEST_STATUS="FAIL"
  TEST_EXIT=$?
fi

echo ""
echo "[PHASE5A_PROOF] Test completed with status: $TEST_STATUS (exit: $TEST_EXIT)"
echo ""

# Check for success marker
echo "[PHASE5A_PROOF] Checking for [PHASE1_ACCESS_SCAN_OK] marker..."
if grep -q "\[PHASE1_ACCESS_SCAN_OK\]" "$OUTDIR/test_output.txt"; then
  marker_count=$(grep -c "\[PHASE1_ACCESS_SCAN_OK\]" "$OUTDIR/test_output.txt")
  echo "[PHASE5A_PROOF] ✅ SUCCESS MARKER FOUND: $marker_count occurrence(s)"
  echo "NO_INJECTION_SUCCESS_MARKER_OK=$marker_count" >> "$OUTDIR/proof_summary.txt"
else
  echo "[PHASE5A_PROOF] ❌ SUCCESS MARKER NOT FOUND"
  echo "NO_INJECTION_SUCCESS_MARKER_FAILED=0" >> "$OUTDIR/proof_summary.txt"
fi

# Check for old error message
echo "[PHASE5A_PROOF] Checking for old error message 'Project fetch returned empty or null result'..."
if grep -q "Project fetch returned empty or null result" "$OUTDIR/test_output.txt"; then
  old_msg_count=$(grep -c "Project fetch returned empty or null result" "$OUTDIR/test_output.txt")
  echo "[PHASE5A_PROOF] ⚠️  OLD ERROR MESSAGE FOUND: $old_msg_count occurrence(s) - SHOULD BE ABSENT"
  echo "NO_INJECTION_OLD_ERROR_ABSENT_FAILED=$old_msg_count" >> "$OUTDIR/proof_summary.txt"
else
  echo "[PHASE5A_PROOF] ✅ OLD ERROR MESSAGE ABSENT (correct)"
  echo "NO_INJECTION_OLD_ERROR_ABSENT_OK=1" >> "$OUTDIR/proof_summary.txt"
fi

# Check for [PHASE1_ACCESS_SCAN_FAILED] marker
echo "[PHASE5A_PROOF] Checking for failure marker [PHASE1_ACCESS_SCAN_FAILED]..."
if grep -q "\[PHASE1_ACCESS_SCAN_FAILED\]" "$OUTDIR/test_output.txt"; then
  failed_count=$(grep -c "\[PHASE1_ACCESS_SCAN_FAILED\]" "$OUTDIR/test_output.txt")
  echo "[PHASE5A_PROOF] ❌ FAILURE MARKER FOUND: $failed_count occurrence(s) - SHOULD NOT APPEAR"
  echo "NO_INJECTION_NO_FAILURE_MARKER_FAILED=$failed_count" >> "$OUTDIR/proof_summary.txt"
else
  echo "[PHASE5A_PROOF] ✅ NO FAILURE MARKER (correct)"
  echo "NO_INJECTION_NO_FAILURE_MARKER_OK=1" >> "$OUTDIR/proof_summary.txt"
fi

echo ""
echo "[PHASE5A_PROOF] Proof summary:"
cat "$OUTDIR/proof_summary.txt"

# Final verdict
if [ "$TEST_STATUS" = "PASS" ]; then
  echo ""
  echo "✅ PHASE5A_PROOF: NO-INJECTION SUCCESS PROOF COMPLETE"
  cp "$OUTDIR/proof_summary.txt" /tmp/phase1_proof_no_injection.txt
  exit 0
else
  echo ""
  echo "❌ PHASE5A_PROOF: TEST FAILED"
  cp "$OUTDIR/test_output.txt" /tmp/phase1_proof_no_injection_output.txt
  exit 1
fi
