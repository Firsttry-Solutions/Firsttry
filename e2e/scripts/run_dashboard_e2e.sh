#!/bin/bash
set -euo pipefail

# ============================================================================
# PHASE 5: E2E TEST RUNNER WITH ARTIFACT COLLECTION & PROOF GENERATION
# ============================================================================
#
# Purpose: Execute Playwright E2E tests with comprehensive artifact collection
#
# Features:
#   - Create timestamped /tmp RUN_DIR for this test run
#   - Validate required environment variables
#   - Run Playwright tests
#   - Collect artifacts (screenshots, HTML, JSON)
#   - Generate summary proof document
#   - Copy summary to repo root
#   - Exit non-zero if test fails (fail fast)
#
# Usage:
#   export JIRA_SITE="https://firsttry.atlassian.net"
#   export DASHBOARD_URL="https://firsttry.atlassian.net/jira/dashboards/10102"
#   export GADGET_TITLE_CONTAINS="Firsttry: Audit Evidence for Jira"
#   bash e2e/scripts/run_dashboard_e2e.sh
#
# Hard Rules:
#   - All artifacts saved to RUN_DIR with timestamps
#   - Summary always copied to repo root as DASHBOARD_E2E_PROOF_SUMMARY.md
#   - Test failure → exit 1 (fail fast)
#   - Never commit artifacts or auth to git

# ============================================================================
# SECTION A: SETUP
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
E2E_ROOT="${REPO_ROOT}/e2e"
ARTIFACTS_DIR="${E2E_ROOT}/artifacts"

# Create timestamped RUN_DIR in /tmp
RUN_TIMESTAMP=$(date -u +"%Y%m%d_%H%M%S_UTC")
RUN_DIR="/tmp/e2e_test_${RUN_TIMESTAMP}"
mkdir -p "${RUN_DIR}"

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║  PHASE 5: E2E TEST RUNNER                                     ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
echo "Run Directory: ${RUN_DIR}"
echo "E2E Root: ${E2E_ROOT}"
echo "Artifacts Directory: ${ARTIFACTS_DIR}"
echo ""

# ============================================================================
# SECTION B: VALIDATE ENVIRONMENT VARIABLES
# ============================================================================

echo "[VALIDATION] Checking required environment variables..."

if [[ -z "${JIRA_SITE:-}" ]]; then
  echo "✗ ERROR: JIRA_SITE not set"
  echo "  Example: export JIRA_SITE='https://firsttry.atlassian.net'"
  exit 1
fi

if [[ -z "${DASHBOARD_URL:-}" ]]; then
  echo "✗ ERROR: DASHBOARD_URL not set"
  echo "  Example: export DASHBOARD_URL='https://firsttry.atlassian.net/jira/dashboards/10102'"
  exit 1
fi

if [[ -z "${GADGET_TITLE_CONTAINS:-}" ]]; then
  echo "✗ ERROR: GADGET_TITLE_CONTAINS not set"
  echo "  Example: export GADGET_TITLE_CONTAINS='Firsttry: Audit Evidence for Jira'"
  exit 1
fi

echo "[VALIDATION] ✓ All required env vars set"
echo "  JIRA_SITE: ${JIRA_SITE}"
echo "  DASHBOARD_URL: ${DASHBOARD_URL}"
echo "  GADGET_TITLE_CONTAINS: ${GADGET_TITLE_CONTAINS}"
echo ""

# ============================================================================
# SECTION C: CHECK AUTH STATE
# ============================================================================

echo "[AUTH] Checking authentication state..."

if [[ ! -f "${E2E_ROOT}/.auth/storageState.json" ]]; then
  echo "✗ ERROR: Authentication not yet performed"
  echo "  First, run: node ${E2E_ROOT}/scripts/auth_login.mjs"
  exit 1
fi

echo "[AUTH] ✓ storageState.json found"
echo ""

# ============================================================================
# SECTION D: CLEAN ARTIFACTS DIRECTORY
# ============================================================================

echo "[CLEANUP] Cleaning artifacts directory..."
rm -rf "${ARTIFACTS_DIR}"
mkdir -p "${ARTIFACTS_DIR}"
echo "[CLEANUP] ✓ Artifacts directory ready"
echo ""

# ============================================================================
# SECTION E: RUN PLAYWRIGHT TESTS
# ============================================================================

echo "[TEST] Running Playwright E2E tests..."
echo ""

cd "${REPO_ROOT}"

# Run tests with environment variables
STORAGE_STATE="${E2E_ROOT}/.auth/storageState.json" \
  JIRA_SITE="${JIRA_SITE}" \
  DASHBOARD_URL="${DASHBOARD_URL}" \
  GADGET_TITLE_CONTAINS="${GADGET_TITLE_CONTAINS}" \
  npx playwright test \
  --config="${E2E_ROOT}/playwright.config.ts" \
  --reporter=list \
  2>&1 | tee "${RUN_DIR}/test_output.log"

TEST_EXIT_CODE=$?

echo ""
echo "[TEST] Test exit code: ${TEST_EXIT_CODE}"
echo ""

# ============================================================================
# SECTION F: COLLECT ARTIFACTS
# ============================================================================

echo "[ARTIFACTS] Collecting test artifacts..."

# Copy all artifacts from e2e/artifacts/ to RUN_DIR
if [[ -d "${ARTIFACTS_DIR}" && $(ls -A "${ARTIFACTS_DIR}") ]]; then
  cp -r "${ARTIFACTS_DIR}"/* "${RUN_DIR}/" 2>/dev/null || true
  echo "[ARTIFACTS] ✓ Copied artifacts to RUN_DIR"
else
  echo "[ARTIFACTS] ⚠ No artifacts found in ${ARTIFACTS_DIR}"
fi

# Copy playwright-report if it exists
if [[ -d "${E2E_ROOT}/playwright-report" ]]; then
  cp -r "${E2E_ROOT}/playwright-report" "${RUN_DIR}/" 2>/dev/null || true
  echo "[ARTIFACTS] ✓ Copied playwright-report"
fi

# Copy test-results if they exist
if [[ -d "${E2E_ROOT}/test-results" ]]; then
  cp -r "${E2E_ROOT}/test-results" "${RUN_DIR}/" 2>/dev/null || true
  echo "[ARTIFACTS] ✓ Copied test-results"
fi

# Copy test output log
echo "[ARTIFACTS] ✓ Copied test_output.log"

echo ""

# ============================================================================
# SECTION G: GENERATE PROOF SUMMARY
# ============================================================================

echo "[PROOF] Generating proof summary..."

PROOF_FILE="${RUN_DIR}/PROOF_SUMMARY.md"
cat > "${PROOF_FILE}" << 'PROOF_EOF'
# Jira Dashboard Gadget E2E Test Proof

## Metadata

- **Test Date**: $(date -u)
- **Test Run ID**: $RUN_TIMESTAMP
- **Jira Site**: $JIRA_SITE
- **Dashboard URL**: $DASHBOARD_URL
- **Gadget Title**: $GADGET_TITLE_CONTAINS
- **Test Status**: $([ $TEST_EXIT_CODE -eq 0 ] && echo "✓ PASS" || echo "✗ FAIL")

## Artifacts Generated

All proof artifacts have been saved to: `$RUN_DIR`

### Test Output
- **test_output.log** - Complete test execution log with all console messages

### Screenshots & HTML
- **06_gadget_viewport_screenshot.png** - Gadget iframe screenshot
- **07_full_page_screenshot.png** - Full dashboard screenshot
- **05_gadget_iframe_html.html** - Gadget iframe DOM
- **08_dashboard_html.html** - Full dashboard DOM

### Analysis Data
- **00_env.json** - Environment variables used
- **01_iframes.json** - All iframes found on page
- **02_console_messages.json** - Console output (log/warn/error)
- **03_page_errors.json** - JavaScript errors
- **04_network_requests.json** - HTTP requests and responses
- **09_ui_labels_found.json** - UI labels detected

### Playwright Report
- **playwright-report/** - Full Playwright HTML report

## Next Steps

1. **View Detailed Report**:
   ```bash
   cd $RUN_DIR
   npx playwright show-report
   ```

2. **Copy Proof to Repo Root** (for GitOps):
   ```bash
   cp $PROOF_FILE $REPO_ROOT/DASHBOARD_E2E_PROOF.md
   ```

3. **Verify No Secrets Committed**:
   ```bash
   git status
   # .auth/ and artifacts/ should NOT be staged
   ```

## Verification Checklist

- [ ] All 11 artifacts present
- [ ] Screenshots show expected gadget
- [ ] Console messages show no errors
- [ ] Network requests show no 401/403/5xx
- [ ] UI labels (≥4 of 8) detected
- [ ] test_output.log shows PASS

PROOF_EOF

# Replace placeholders with actual values
sed -i "s|\$RUN_TIMESTAMP|${RUN_TIMESTAMP}|g" "${PROOF_FILE}"
sed -i "s|\$JIRA_SITE|${JIRA_SITE}|g" "${PROOF_FILE}"
sed -i "s|\$DASHBOARD_URL|${DASHBOARD_URL}|g" "${PROOF_FILE}"
sed -i "s|\$GADGET_TITLE_CONTAINS|${GADGET_TITLE_CONTAINS}|g" "${PROOF_FILE}"
sed -i "s|\$RUN_DIR|${RUN_DIR}|g" "${PROOF_FILE}"
sed -i "s|\$REPO_ROOT|${REPO_ROOT}|g" "${PROOF_FILE}"
sed -i "s|\$(date -u)|$(date -u)|g" "${PROOF_FILE}"
sed -i "s|\$TEST_EXIT_CODE|${TEST_EXIT_CODE}|g" "${PROOF_FILE}"
if [[ $TEST_EXIT_CODE -eq 0 ]]; then
  sed -i 's|\$\(TEST_EXIT_CODE\)|0|g' "${PROOF_FILE}"
fi

echo "[PROOF] ✓ Proof summary written"
echo ""

# ============================================================================
# SECTION H: COPY SUMMARY TO REPO ROOT
# ============================================================================

echo "[REPO] Copying proof summary to repo root..."

SUMMARY_FILE="${ARTIFACTS_DIR}/10_summary.md"
if [[ -f "${SUMMARY_FILE}" ]]; then
  cp "${SUMMARY_FILE}" "${REPO_ROOT}/DASHBOARD_E2E_PROOF_SUMMARY.md"
  echo "[REPO] ✓ Copied to DASHBOARD_E2E_PROOF_SUMMARY.md"
else
  echo "[REPO] ⚠ Summary not found in artifacts"
fi

echo ""

# ============================================================================
# SECTION I: PRINT ARTIFACT MANIFEST
# ============================================================================

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║  ARTIFACT MANIFEST                                            ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
echo "All artifacts saved to: ${RUN_DIR}"
echo ""
echo "Contents:"
echo ""

find "${RUN_DIR}" -type f -exec ls -lh {} \; | awk '{print "  " $9 " (" $5 ")"}' | sort

echo ""

# ============================================================================
# SECTION J: FINAL SUMMARY & EXIT
# ============================================================================

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║  TEST SUMMARY                                                 ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

if [[ $TEST_EXIT_CODE -eq 0 ]]; then
  echo "✓ ALL TESTS PASSED"
  echo ""
  echo "Proof artifacts are ready in: ${RUN_DIR}"
  echo ""
  echo "Next: Run 'npx playwright show-report' to view detailed HTML report"
  echo ""
else
  echo "✗ TEST FAILED (exit code: ${TEST_EXIT_CODE})"
  echo ""
  echo "Debug artifacts are available in: ${RUN_DIR}"
  echo "Check test_output.log for details"
  echo ""
fi

exit $TEST_EXIT_CODE
