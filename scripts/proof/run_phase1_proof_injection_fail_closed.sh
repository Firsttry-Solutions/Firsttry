#!/bin/bash
# run_phase1_proof_injection_fail_closed.sh
# PHASE 5B: Verify Phase1 fails closed when forgeConsoleErrorCount > 0 (INJECTION mode)

set -e

OUTDIR="/tmp/phase1_proof_injection_$$"
mkdir -p "$OUTDIR"

echo "[PHASE5B_PROOF] Starting Phase1 injection fail-closed proof"
echo "[PHASE5B_PROOF] Output directory: $OUTDIR"
echo ""

# Set environment for injection run
export JIRA_BASE_URL="https://firsttry.atlassian.net"
export JIRA_DASHBOARD_URL="https://firsttry.atlassian.net/jira/dashboards/10102"
export FT_FORCE_FORGE_CONSOLE_ERROR=1
export FT_ASSERT_DETERMINISTIC_HASH=1
export FT_DETERMINISTIC_IFRAME_SRC_HASH_ONLY=1

# Run test
cd /workspaces/Firsttry/atlassian/forge-app

echo "[PHASE5B_PROOF] Running: npx playwright test dashboard-phase1-diagnostics.spec.ts (with injection)"
echo ""

# Run test and capture output - EXPECT FAILURE
if npx playwright test dashboard-phase1-diagnostics.spec.ts 2>&1 | tee "$OUTDIR/test_output.txt"; then
  TEST_STATUS="PASS"
  TEST_EXIT=0
else
  TEST_STATUS="FAIL"
  TEST_EXIT=$?
fi

echo ""
echo "[PHASE5B_PROOF] Test completed with status: $TEST_STATUS (exit: $TEST_EXIT)"
echo ""

# For injection, we EXPECT the test to FAIL (exit non-zero)
# This proves fail-closed behavior is preserved
if [ $TEST_EXIT -ne 0 ]; then
  echo "[PHASE5B_PROOF] ✅ TEST FAILED AS EXPECTED (fail-closed gate working)"
  echo "INJECTION_FAIL_CLOSED_OK=1" > "$OUTDIR/proof_summary.txt"
else
  echo "[PHASE5B_PROOF] ❌ TEST PASSED UNEXPECTEDLY (fail-closed NOT working)"
  echo "INJECTION_FAIL_CLOSED_FAILED=1" > "$OUTDIR/proof_summary.txt"
fi

# Check for error injection evidence
echo "[PHASE5B_PROOF] Checking for error injection evidence..."
if grep -q "FT_FORCE_FORGE_CONSOLE_ERROR\|forgeConsoleErrorCount\|console error" "$OUTDIR/test_output.txt"; then
  echo "[PHASE5B_PROOF] ✅ INJECTION EVIDENCE FOUND"
  echo "INJECTION_EVIDENCE_FOUND=1" >> "$OUTDIR/proof_summary.txt"
else
  echo "[PHASE5B_PROOF] ⚠️  INJECTION EVIDENCE NOT EXPLICITLY LOGGED (but test failed as expected)"
  echo "INJECTION_EVIDENCE_FOUND=0" >> "$OUTDIR/proof_summary.txt"
fi

echo ""
echo "[PHASE5B_PROOF] Proof summary:"
cat "$OUTDIR/proof_summary.txt"

# Final verdict
if [ $TEST_EXIT -ne 0 ]; then
  echo ""
  echo "✅ PHASE5B_PROOF: INJECTION FAIL-CLOSED PROOF COMPLETE"
  cp "$OUTDIR/proof_summary.txt" /tmp/phase1_proof_injection.txt
  exit 0
else
  echo ""
  echo "❌ PHASE5B_PROOF: TEST DID NOT FAIL (EXPECTED FAILURE)"
  cp "$OUTDIR/test_output.txt" /tmp/phase1_proof_injection_output.txt
  exit 1
fi
