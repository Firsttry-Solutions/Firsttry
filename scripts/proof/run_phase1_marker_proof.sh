#!/bin/bash
# run_phase1_marker_proof.sh
# STRICT: Real browser console.log marker proof via noVNC headed browser
# Exit 0 ONLY if REAL marker line found in console.log with valid JSON + build identity match

set -euo pipefail

PROOF_DIR="/tmp/phase1_marker_proof_$$"
mkdir -p "$PROOF_DIR"

echo "════════════════════════════════════════════════════════════════════"
echo "PHASE1 SUCCESS MARKER PROOF (STRICT - HEADED BROWSER VIA NOVNC)"
echo "════════════════════════════════════════════════════════════════════"
echo ""

# Expected SHAs of current HEAD
EXPECT_SHA=$(cd /workspaces/Firsttry && git rev-parse --short=7 HEAD)
EXPECT_FULL=$(cd /workspaces/Firsttry && git rev-parse HEAD)
echo "[PROOF] Expected UI build SHA7:  $EXPECT_SHA"
echo "[PROOF] Expected UI build SHA40: $EXPECT_FULL"
echo ""

# Set environment
export JIRA_BASE_URL="https://firsttry.atlassian.net"
export JIRA_DASHBOARD_URL="https://firsttry.atlassian.net/jira/dashboards/10102"
unset FT_FORCE_FORGE_CONSOLE_ERROR || true
export FT_ASSERT_DETERMINISTIC_HASH=1
export FT_DETERMINISTIC_IFRAME_SRC_HASH_ONLY=1

cd /workspaces/Firsttry/atlassian/forge-app

echo "[PROOF] Starting Playwright via noVNC headed browser (manual login required)..."
echo "[PROOF] noVNC URL will be displayed in output - forward port as PRIVATE in Codespaces"
echo ""

# Run Playwright via noVNC runner
NOVNC_RUNNER_SCRIPT="./scripts/proof/run_playwright_with_novnc.sh"
TEST_OUTPUT="$PROOF_DIR/test_output.txt"
TEST_EXIT=0

if bash "$NOVNC_RUNNER_SCRIPT" 2>&1 | tee "$TEST_OUTPUT"; then
  TEST_EXIT=0
else
  TEST_EXIT=$?
fi

echo ""
echo "[PROOF] Test exit code: $TEST_EXIT"
echo ""

# Extract OUT_DIR from test output or fallback to last directory
OUT_DIR=""
if grep -q "LATEST_OUT_DIR=" "$TEST_OUTPUT"; then  
  OUT_DIR=$(grep "LATEST_OUT_DIR=" "$TEST_OUTPUT" | tail -1 | sed 's/.*LATEST_OUT_DIR=\([^ ]*\).*/\1/')
fi

# If exit code > 1, test runner failed (but we still check for evidence)
if [ -z "$OUT_DIR" ]; then
  # Fallback: latest pw_dash_diag directory
  OUT_DIR="$(ls -1dt /tmp/pw_dash_diag_* 2>/dev/null | head -1 || true)"
fi

if [ -z "$OUT_DIR" ]; then
  echo "[PROOF] ❌ FAILED: No output directory found (test may not have run successfully)"
  echo "[PROOF] Check above output for Playwright errors or authentication issues"
  exit 1
fi

echo "[PROOF] Output directory: $OUT_DIR"
echo ""

# Verify console.log exists
CONSOLE_FILE="$OUT_DIR/console.log"
if [ ! -f "$CONSOLE_FILE" ]; then
  echo "[PROOF] ❌ FAILED: Console log not found at $CONSOLE_FILE"
  echo "[PROOF] Available files in $OUT_DIR:"
  ls -lah "$OUT_DIR" || true
  exit 1
fi

CONSOLE_SIZE=$(wc -c < "$CONSOLE_FILE")
echo "[PROOF] Console log size: $CONSOLE_SIZE bytes"
echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# CHECK 0: Network failure allowlist gate
# ═════════════════════════════════════════════════════════════════════════════════

echo "[CHECK 0] Validating network.log against allowlist"

NETWORK_FILE="$OUT_DIR/network.log"
if [ ! -f "$NETWORK_FILE" ]; then
  echo "         ⚠ Network log not found (may proceed if no network failures)"
else
  # Extract failed requests from network.log
  # Allowed patterns: /rest/internal/2/log/safe/info, /gateway/api/townsquare/, /gateway/api/watermelon/, /rest/api/3/mypreferences, mauTag
  ALLOWED_PATTERNS=("/rest/internal/2/log/safe/info" "/gateway/api/townsquare/" "/gateway/api/watermelon/" "/rest/api/3/mypreferences" "mauTag")
  
  # Count total failures in network.log (requestfailed lines)
  TOTAL_FAILURES=$(grep -c '\[response\.(4|5)[0-9]\{2\}\]\|requestfailed' "$NETWORK_FILE" || echo 0)
  ALLOWED_FAILURES=0
  DISALLOWED_FAILURES=0
  DISALLOWED_LINES=()
  
  if [ "$TOTAL_FAILURES" -gt 0 ]; then
    # Check each failure line against allowlist
    while IFS= read -r line; do
      IS_ALLOWED=0
      for pattern in "${ALLOWED_PATTERNS[@]}"; do
        if echo "$line" | grep -q "$pattern"; then
          IS_ALLOWED=1
          ((ALLOWED_FAILURES++))
          break
        fi
      done
      
      # Fail-closed: disallow forge CDN bundle failures and resolver failures
      if echo "$line" | grep -qE 'forge\.cdn\.prod\.atlassian-dev\.net|cdn\.prod\.atlassian-dev\.net.*(/app\.|gadget)|resolver|govGadget'; then
        IS_ALLOWED=0
      fi
      
      if [ "$IS_ALLOWED" -eq 0 ] && [ -n "$line" ]; then
        DISALLOWED_FAILURES=$((DISALLOWED_FAILURES + 1))
        DISALLOWED_LINES+=("$line")
      fi
    done < <(grep -E '\[response\.(4|5)[0-9]\{2\}\]|requestfailed' "$NETWORK_FILE" || true)
  fi
  
  if [ "$DISALLOWED_FAILURES" -gt 0 ]; then
    echo "         ❌ FAILED: Found $DISALLOWED_FAILURES disallowed network failures"
    echo "         Allowed: $ALLOWED_FAILURES | Disallowed: $DISALLOWED_FAILURES"
    echo "         First disallowed failures:"
    for (( i=0; i<${#DISALLOWED_LINES[@]} && i<20; i++ )); do
      echo "           ${DISALLOWED_LINES[i]}"
    done
    exit 1
  else
    echo "         ✅ PASSED: Network failures validation (allowed=$ALLOWED_FAILURES, disallowed=0)"
  fi
fi
echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# CHECK 1A: Verify UI_ENTRY_RUNTIME_PROOF binds runtime bundle to EXPECT_FULL
# ═════════════════════════════════════════════════════════════════════════════════

echo "[CHECK 1A] Verifying UI_ENTRY_RUNTIME_PROOF binds runtime bundle to EXPECT_FULL"

# Find the last UI_ENTRY_RUNTIME_PROOF line (use last occurrence)
RUNTIME_PROOF_LINE=$(grep '\[console\.log\] \[UI_ENTRY_RUNTIME_PROOF\]' "$CONSOLE_FILE" | tail -1 || true)

if [ -z "$RUNTIME_PROOF_LINE" ]; then
  echo "         ❌ FAILED: UI_ENTRY_RUNTIME_PROOF line not found in console.log"
  exit 1
fi

echo "         Found: $RUNTIME_PROOF_LINE"

# Extract JSON from the runtime proof line
RUNTIME_JSON=$(echo "$RUNTIME_PROOF_LINE" | sed 's/.*\[console\.log\] \[UI_ENTRY_RUNTIME_PROOF\] //')

if [ -z "$RUNTIME_JSON" ]; then
  echo "         ❌ FAILED: Could not extract JSON from UI_ENTRY_RUNTIME_PROOF line"
  exit 1
fi

# Parse and validate runtime proof JSON with node
RUNTIME_VALIDATION=$(cat <<'NODEEOF'
const data = JSON.parse(process.argv[1]);
const errors = [];
const expectFull = process.argv[2];
const expectSha7 = process.argv[3];

if (data.ui_entry_bundle_hash !== expectFull) {
  errors.push(`ui_entry_bundle_hash '${data.ui_entry_bundle_hash}' !== expectFull '${expectFull}'`);
}

if (!data.ui_entry_bundle_url || !data.ui_entry_bundle_url.includes(`app.${expectFull}.js`)) {
  errors.push(`ui_entry_bundle_url '${data.ui_entry_bundle_url || '(missing)'}' must contain 'app.${expectFull}.js'`);
}

if (!data.ui_git_sha || data.ui_git_sha !== expectFull) {
  errors.push(`ui_git_sha '${data.ui_git_sha || '(missing)'}' !== expectFull '${expectFull}'`);
}

if (errors.length > 0) {
  console.error(errors.join('; '));
  process.exit(1);
}

console.log(`OK: bundle_hash=${data.ui_entry_bundle_hash.substring(0,7)}, git_sha=${data.ui_git_sha.substring(0,7)}, url_contains=app.${expectSha7}.js`);
NODEEOF
)

if ! RUNTIME_OUTPUT=$(node -e "$RUNTIME_VALIDATION" "$RUNTIME_JSON" "$EXPECT_FULL" "$EXPECT_SHA" 2>&1); then
  echo "         ❌ FAILED: Runtime proof validation failed"
  echo "         $RUNTIME_OUTPUT"
  exit 1
fi

echo "         ✅ PASSED: UI_ENTRY_RUNTIME_PROOF validated"
echo "           $RUNTIME_OUTPUT"
echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# CHECK 1B: Verify build identity line (UI_BUILD_IDENTITY_CONFIRMED) contains EXPECT_FULL
# ═════════════════════════════════════════════════════════════════════════════════

echo "[CHECK 1] Verifying build identity (UI_BUILD_IDENTITY_*) contains SHA=$EXPECT_SHA"
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
# REJECT: any line containing WARN, VALIDATION, MISSING, FORMAT, PARSE, VALUE, ACTION

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
if ! echo "$MARKER_JSON" | node -e 'process.stdin.on("data", d => JSON.parse(d.toString())); process.on("error", () => process.exit(1))' 2>/dev/null; then
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

if (!data.schemaVersion || data.schemaVersion !== '1.0') {
  errors.push(`schemaVersion is '${data.schemaVersion || '(missing)'}', expected '1.0'`);
}

if (!data.buildShaShort || typeof data.buildShaShort !== 'string' || data.buildShaShort.length < 7) {
  errors.push(`buildShaShort is '${data.buildShaShort || '(missing)'}', expected string length >= 7`);
}

if (typeof data.projectsCount !== 'number') {
  errors.push(`projectsCount is '${data.projectsCount}', expected number`);
}

if (typeof data.totalUsers !== 'number') {
  errors.push(`totalUsers is '${data.totalUsers}', expected number`);
}

if (!data.riskTier || typeof data.riskTier !== 'string') {
  errors.push(`riskTier is '${data.riskTier || '(missing)'}', expected string`);
}

if (!data.snapshotId || typeof data.snapshotId !== 'string') {
  errors.push(`snapshotId is '${data.snapshotId || '(missing)'}', expected string`);
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
echo "         • schemaVersion: 1.0"
echo "         • buildShaShort: (valid)"
echo "         • projectsCount: (numeric)"
echo "         • totalUsers: (numeric)"
echo "         • riskTier: (string)"
echo "         • snapshotId: (string)"
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
# EVIDENCE BUNDLE: CREATE DETERMINISTIC REVIEWER-GRADE ZIP
# ═════════════════════════════════════════════════════════════════════════════════

echo "[EVIDENCE] Creating deterministic reviewer evidence bundle..."
echo ""

# Create evidence directory with timestamp and git SHA
EVID_TS=$(date -u +%Y%m%dT%H%M%SZ)
EVID_DIR="/tmp/phase1_reviewer_grade_evidence_${EVID_TS}_${EXPECT_SHA7}"
mkdir -p "$EVID_DIR"
echo "[EVIDENCE] EVID_DIR=${EVID_DIR}"

# Copy all evidence files (fail if any required file missing)
declare -a EVIDENCE_FILES=(
  "$TEST_OUTPUT"
  "$OUT_DIR/console.log"
  "$OUT_DIR/network.log"
  "$OUT_DIR/frames.txt"
  "$OUT_DIR/iframe-selection.txt"
)

# Conditionally include determinism hashes if they exist
if [ -f "$OUT_DIR/determinism-hashes.txt" ]; then
  EVIDENCE_FILES+=("$OUT_DIR/determinism-hashes.txt")
fi
if [ -f "$OUT_DIR/determinism-hashes.clean.txt" ]; then
  EVIDENCE_FILES+=("$OUT_DIR/determinism-hashes.clean.txt")
fi

# Copy all core evidence files
for evid_file in "${EVIDENCE_FILES[@]}"; do
  if [ ! -f "$evid_file" ]; then
    echo "[EVIDENCE] ❌ ERROR: Required evidence file not found: $evid_file"
    exit 1
  fi
  cp "$evid_file" "$EVID_DIR/"
  echo "[EVIDENCE] ✓ Copied: $(basename "$evid_file")"
done

# Conditionally include apt.log if available (fail-safe, don't require if RUN_ROOT not accessible)
RUN_ROOT_VALUE="${RUN_ROOT:-/tmp/pw_novnc_run}"
if [ -f "$RUN_ROOT_VALUE/apt.log" ]; then
  cp "$RUN_ROOT_VALUE/apt.log" "$EVID_DIR/"
  echo "[EVIDENCE] ✓ Copied: apt.log (from RUN_ROOT)"
fi

# Create manifest.json with schema and metadata
MANIFEST_FILE="$EVID_DIR/manifest.json"
cat > "$MANIFEST_FILE" <<MANIFEST_EOF
{
  "schemaVersion": "phase1-evidence-v1",
  "gitShaFull": "${EXPECT_FULL}",
  "gitShaShort": "${EXPECT_SHA7}",
  "outDir": "${OUT_DIR}",
  "proofScript": "/workspaces/Firsttry/scripts/proof/run_phase1_marker_proof.sh",
  "novncRunner": "/workspaces/Firsttry/atlassian/forge-app/scripts/proof/run_playwright_with_novnc.sh",
  "createdUtc": "${EVID_TS}",
  "includedFiles": [
    "test_output.txt",
    "console.log",
    "network.log",
    "frames.txt",
    "iframe-selection.txt",
    "determinism-hashes.txt",
    "determinism-hashes.clean.txt",
    "apt.log"
  ]
}
MANIFEST_EOF

echo "[EVIDENCE] ✓ Created: manifest.json"

# Verify manifest.json is valid JSON (fail-closed)
if ! node -e "JSON.parse(require('fs').readFileSync('$MANIFEST_FILE', 'utf-8'))" 2>/dev/null; then
  echo "[EVIDENCE] ❌ ERROR: manifest.json is not valid JSON"
  exit 1
fi

# Create ZIP archive
ZIP_FILE="${EVID_DIR}.zip"
cd /tmp
if ! zip -r -q "$ZIP_FILE" "$(basename "$EVID_DIR")" > /dev/null 2>&1; then
  echo "[EVIDENCE] ❌ ERROR: Failed to create ZIP archive"
  exit 1
fi

# Verify ZIP was created
if [ ! -f "$ZIP_FILE" ]; then
  echo "[EVIDENCE] ❌ ERROR: ZIP file not created: $ZIP_FILE"
  exit 1
fi

# Calculate ZIP SHA256 for integrity verification
ZIP_SHA256=$(sha256sum "$ZIP_FILE" | awk '{print $1}')

echo ""
echo "[EVIDENCE] ✅ EVIDENCE BUNDLE CREATED"
echo "[EVIDENCE] ZIP_PATH=${ZIP_FILE}"
echo "[EVIDENCE] ZIP_SIZE=$(du -h "$ZIP_FILE" | cut -f1)"
echo "[EVIDENCE] ZIP_SHA256=${ZIP_SHA256}"
echo ""
echo "[EVIDENCE] Reviewer verification:"
echo "[EVIDENCE]   cd /tmp && sha256sum -c <<< '${ZIP_SHA256}  $(basename "$ZIP_FILE")'"
echo ""

cd /workspaces/Firsttry

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
echo "  • All required fields present and valid"
echo "  • No failure/warn text contains marker"
echo ""
echo "Proof artifacts:"
echo "  • Console log: $CONSOLE_FILE"
echo "  • Test output: $TEST_OUTPUT"
echo "  • Evidence bundle: $ZIP_FILE"
echo "  • Evidence SHA256: $ZIP_SHA256"
echo ""

exit 0

