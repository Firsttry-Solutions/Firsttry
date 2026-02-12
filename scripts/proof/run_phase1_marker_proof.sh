#!/bin/bash
# run_phase1_marker_proof.sh
# STRICT: Real browser console.log marker proof (not WARN text)
# Exit 0 ONLY if REAL marker line found in console.log with valid JSON + build identity match

set -euo pipefail

PROOF_DIR="/tmp/phase1_marker_proof_$$"
mkdir -p "$PROOF_DIR"

echo "════════════════════════════════════════════════════════════════════"
echo "PHASE1 SUCCESS MARKER PROOF (STRICT - REAL CONSOLE.LOG ONLY)"
echo "════════════════════════════════════════════════════════════════════"
echo ""

# Expected short SHA of current HEAD
EXPECT_SHA=$(cd /workspaces/Firsttry && git rev-parse --short=7 HEAD)
echo "[PROOF] Expected UI build SHA: $EXPECT_SHA"
echo ""

# Set environment
export JIRA_BASE_URL="https://firsttry.atlassian.net"
export JIRA_DASHBOARD_URL="https://firsttry.atlassian.net/jira/dashboards/10102"
unset FT_FORCE_FORGE_CONSOLE_ERROR || true
export FT_ASSERT_DETERMINISTIC_HASH=1
export FT_DETERMINISTIC_IFRAME_SRC_HASH_ONLY=1

cd /workspaces/Firsttry/atlassian/forge-app

echo "[PROOF] Running Playwright test (NO-INJECTION)..."
echo ""

# Run Playwright without --no-header flag
TEST_OUTPUT="$PROOF_DIR/test_output.txt"
TEST_EXIT=0
if JIRA_BASE_URL="$JIRA_BASE_URL" JIRA_DASHBOARD_URL="$JIRA_DASHBOARD_URL" \
  npx playwright test tests/playwright/dashboard-phase1-diagnostics.spec.ts 2>&1 | tee "$TEST_OUTPUT"; then
  TEST_EXIT=0
else
  TEST_EXIT=$?
fi

echo ""
echo "[PROOF] Test exit code: $TEST_EXIT"
echo ""

# Extract OUT_DIR from test output or fallback to last directory
OUT_DIR=""
if grep -q "OUT_DIR=" "$TEST_OUTPUT"; then
  OUT_DIR=$(grep "OUT_DIR=" "$TEST_OUTPUT" | tail -1 | sed 's/.*OUT_DIR=\([^ ]*\).*/\1/')
fi

if [ -z "$OUT_DIR" ]; then
  # Fallback: latest pw_dash_diag directory
  OUT_DIR="$(ls -1dt /tmp/pw_dash_diag_* 2>/dev/null | head -1 || true)"
fi

if [ -z "$OUT_DIR" ]; then
  echo "[PROOF] ❌ FAILED: No output directory found (test may not have created it)"
  exit 1
fi

echo "[PROOF] Output directory: $OUT_DIR"
echo ""

# Verify console.log exists
CONSOLE_FILE="$OUT_DIR/console.log"
if [ ! -f "$CONSOLE_FILE" ]; then
  echo "[PROOF] ❌ FAILED: Console log not found at $CONSOLE_FILE"
  exit 1
fi

CONSOLE_SIZE=$(wc -c < "$CONSOLE_FILE")
echo "[PROOF] Console log size: $CONSOLE_SIZE bytes"
echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# CHECK 1: Verify build identity line contains current short SHA
# ═════════════════════════════════════════════════════════════════════════════════

echo "[CHECK 1] Verifying build identity (UI_BUILD_IDENTITY_FINAL) contains SHA=$EXPECT_SHA"
IDENTITY_LINE=$(grep "UI_BUILD_IDENTITY_FINAL\|UI_BUILD_IDENTITY_EARLY\|UI_BUILD_IDENTITY_PROOF" "$CONSOLE_FILE" | tail -1 || true)
if [ -z "$IDENTITY_LINE" ]; then
  echo "         ❌ FAILED: UI_BUILD_IDENTITY line not found"
  exit 1
fi

if ! echo "$IDENTITY_LINE" | grep -q "$EXPECT_SHA"; then
  echo "         ❌ FAILED: Expected SHA $EXPECT_SHA not found in identity line"
  echo "         Got: $IDENTITY_LINE"
  exit 1
fi

echo "         ✅ PASSED: Build identity contains current SHA $EXPECT_SHA"
echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# CHECK 2: Find REAL console.log marker line (not WARN text)
# ═════════════════════════════════════════════════════════════════════════════════

echo "[CHECK 2] Searching for REAL console.log marker [PHASE1_ACCESS_SCAN_OK]"

# Pattern: actual console.log line (with or without line number prefix)
# Accept formats:
#   [123:][console.log] [PHASE1_ACCESS_SCAN_OK] {...}  (with line:prefix)
#   [console.log] [PHASE1_ACCESS_SCAN_OK] {...}        (without prefix)
# REJECT: any line containing WARN, VALIDATION, MISSING, FORMAT, PARSE, VALUE

MARKER_LINE=$(grep -E '^\[?([0-9]+:)?\]?\[console\.log\] \[PHASE1_ACCESS_SCAN_OK\]' "$CONSOLE_FILE" || true)

if [ -z "$MARKER_LINE" ]; then
  echo "         ❌ FAILED: No real console.log marker line found"
  echo ""
  echo "         (Checking if error/warn text contains marker string...)"
  FAKE_MARKER_COUNT=$(grep -c "PHASE1_VALIDATION_WARN\|PHASE1_MARKER_MISSING\|PHASE1_MARKER_FORMAT\|PHASE1_MARKER_PARSE\|PHASE1_MARKER_VALUE\|PHASE1_ACTION_VALUE" "$CONSOLE_FILE" || true)
  if [ "$FAKE_MARKER_COUNT" -gt 0 ]; then
    echo "         Found $FAKE_MARKER_COUNT error/warn lines with marker string (these are NOT proof)"
    echo "         Need REAL console.log line with [console.log] prefix"
  fi
  exit 1
fi

echo "         ✅ FOUND: Real console.log marker line"
echo ""

# ═════════════════════════════════════════════════════════════════════════════════
# CHECK 3: Extract and validate marker JSON
# ═════════════════════════════════════════════════════════════════════════════════

echo "[CHECK 3] Extracting and validating marker JSON"

# Extract JSON from the marker line
# Pattern: [console.log] [PHASE1_ACCESS_SCAN_OK] {...}
MARKER_JSON=$(echo "$MARKER_LINE" | sed 's/.*\[\[console\.log\]\] \[PHASE1_ACCESS_SCAN_OK\] //; s/.*\[console\.log\] \[PHASE1_ACCESS_SCAN_OK\] //')

if [ -z "$MARKER_JSON" ]; then
  echo "         ❌ FAILED: Could not extract JSON from marker line"
  echo "         Line: $MARKER_LINE"
  exit 1
fi

# Validate JSON is parseable
if ! echo "$MARKER_JSON" | node -e 'process.stdin.on("data", d => JSON.parse(d.toString()), (e) => process.exit(1))' 2>/dev/null; then
  echo "         ❌ FAILED: Marker JSON is not valid JSON"
  echo "         JSON: $MARKER_JSON"
  exit 1
fi

echo "         ✅ PASSED: JSON is valid"
echo ""

# ═════════════════════════════════════════════════════════════════════════════════
# CHECK 4: Validate marker fields
# ═════════════════════════════════════════════════════════════════════════════════

echo "[CHECK 4] Validating marker required fields"

# Parse and validate with node
VALIDATION_SCRIPT=$(cat <<'NODEEOF'
const data = JSON.parse(process.argv[1]);
const errors = [];

if (data.marker !== '[PHASE1_ACCESS_SCAN_OK]') {
  errors.push(`marker field is '${data.marker}', expected '[PHASE1_ACCESS_SCAN_OK]'`);
}

if (data.action !== 'RUN_ACCESS_REVIEW') {
  errors.push(`action field is '${data.action}', expected 'RUN_ACCESS_REVIEW'`);
}

if (!data.schemaVersion) {
  errors.push('schemaVersion field missing');
}

if (!data.buildShaShort) {
  errors.push('buildShaShort field missing');
}

if (errors.length > 0) {
  console.error(errors.join('; '));
  process.exit(1);
}

console.log('OK');
NODEEOF
)

if ! VALIDATION_OUTPUT=$(node -e "$VALIDATION_SCRIPT" "$MARKER_JSON" 2>&1); then
  echo "         ❌ FAILED: Marker validation failed"
  echo "         $VALIDATION_OUTPUT"
  exit 1
fi

echo "         ✅ PASSED: All required fields present and valid"
echo "         • marker: [PHASE1_ACCESS_SCAN_OK]"
echo "         • action: RUN_ACCESS_REVIEW"
echo "         • schemaVersion: present"
echo "         • buildShaShort: present"
echo ""

# ═════════════════════════════════════════════════════════════════════════════════
# CHECK 5: Verify marker NOT found in WARN or failure paths
# ═════════════════════════════════════════════════════════════════════════════════

echo "[CHECK 5] Verifying no WARN/FAIL text contains marker"

FAIL_MARKERS=$(grep -E '\[PHASE1_VALIDATION_WARN\].*PHASE1_ACCESS_SCAN_OK|\[PHASE1.*FAILED\]' "$CONSOLE_FILE" || true)
if [ -n "$FAIL_MARKERS" ]; then
  echo "         ❌ FAILED: Found failure/warn text with marker"
  echo "         $FAIL_MARKERS"
  exit 1
fi

echo "         ✅ PASSED: No failure/warn text contains marker"
echo ""

# ═════════════════════════════════════════════════════════════════════════════════
# FINAL VERDICT
# ═════════════════════════════════════════════════════════════════════════════════

echo "════════════════════════════════════════════════════════════════════"
echo "✅ PHASE1 SUCCESS MARKER PROOF: PASSED"
echo "════════════════════════════════════════════════════════════════════"
echo ""
echo "Proof Summary:"
echo "  • Build identity verified: SHA=$EXPECT_SHA"
echo "  • Real console.log marker found: [PHASE1_ACCESS_SCAN_OK]"
echo "  • Marker JSON valid and complete"
echo "  • Required fields present (marker, action, schemaVersion, buildShaShort)"
echo "  • No failure/warn text contains marker"
echo ""
echo "Proof artifacts:"
echo "  • Console log: $CONSOLE_FILE"
echo "  • Test output: $TEST_OUTPUT"
echo ""

exit 0

