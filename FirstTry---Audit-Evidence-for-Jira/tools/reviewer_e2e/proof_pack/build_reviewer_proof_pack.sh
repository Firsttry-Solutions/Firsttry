#!/usr/bin/env bash
#
# build_reviewer_proof_pack.sh
# 
# Builds a tamper-evident reviewer E2E evidence pack with SHA256 manifest.
# 
# Usage:
#   ./build_reviewer_proof_pack.sh
# 
# Requirements:
#   - JIRA_BASE_URL environment variable
#   - JIRA_DASHBOARD_URL environment variable
#   - Valid authentication in tests/playwright/.auth/storageState.json
# 
# Output:
#   - Evidence pack in /tmp/ft_reviewer_e2e_YYYYMMDDTHHMMSSZ/
#   - Manifest with SHA256 hashes of all files
#   - PROOF_PACK_SHA256.txt (hash of the manifest)
#   - FINAL_VERDICT.txt (PASS/FAIL)
# 
# Exit codes:
#   0 - Test PASSED, evidence pack created
#   1 - Test FAILED, evidence pack created (with failure evidence)
#   2 - Fatal error (missing env vars, auth not found, etc.)
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"

# ============================================================================
# Configuration
# ============================================================================
RUN_ID="ft_reviewer_e2e_$(date -u +%Y%m%dT%H%M%SZ)"
EVIDENCE_DIR="/tmp/${RUN_ID}"
MANIFEST_FILE="${EVIDENCE_DIR}/manifest.sha256"
PACK_HASH_FILE="${EVIDENCE_DIR}/PROOF_PACK_SHA256.txt"
FINAL_VERDICT_FILE="${EVIDENCE_DIR}/FINAL_VERDICT.txt"

echo "============================================================"
echo "Reviewer E2E Evidence Pack Builder"
echo "============================================================"
echo "Run ID: ${RUN_ID}"
echo "Evidence dir: ${EVIDENCE_DIR}"
echo ""

# ============================================================================
# Preflight checks
# ============================================================================
echo "[PREFLIGHT] Checking requirements..."

if [[ -z "${JIRA_BASE_URL:-}" ]]; then
  echo "ERROR: JIRA_BASE_URL environment variable is required"
  exit 2
fi

if [[ -z "${JIRA_DASHBOARD_URL:-}" ]]; then
  echo "ERROR: JIRA_DASHBOARD_URL environment variable is required"
  exit 2
fi

AUTH_FILE="${REPO_ROOT}/tests/playwright/.auth/storageState.json"
if [[ ! -f "${AUTH_FILE}" ]]; then
  echo "ERROR: Authentication file not found: ${AUTH_FILE}"
  echo "Run: npx playwright auth login --config=playwright.reviewer.config.ts"
  exit 2
fi

PLAYWRIGHT_CONFIG="${REPO_ROOT}/playwright.reviewer.config.ts"
if [[ ! -f "${PLAYWRIGHT_CONFIG}" ]]; then
  echo "ERROR: Playwright config not found: ${PLAYWRIGHT_CONFIG}"
  exit 2
fi

TEST_SPEC="${REPO_ROOT}/tests/playwright/reviewer_dashboard_e2e.spec.ts"
if [[ ! -f "${TEST_SPEC}" ]]; then
  echo "ERROR: Test spec not found: ${TEST_SPEC}"
  exit 2
fi

echo "✓ JIRA_BASE_URL: ${JIRA_BASE_URL}"
echo "✓ JIRA_DASHBOARD_URL: ${JIRA_DASHBOARD_URL}"
echo "✓ Auth file: ${AUTH_FILE} ($(stat -c%s "${AUTH_FILE}" 2>/dev/null || stat -f%z "${AUTH_FILE}") bytes)"
echo "✓ Playwright config: ${PLAYWRIGHT_CONFIG}"
echo "✓ Test spec: ${TEST_SPEC}"
echo ""

# ============================================================================
# Create evidence directory
# ============================================================================
echo "[SETUP] Creating evidence directory structure..."
mkdir -p "${EVIDENCE_DIR}"
echo "✓ Evidence directory created: ${EVIDENCE_DIR}"
echo ""

# ============================================================================
# Run test
# ============================================================================
echo "[TEST] Running reviewer dashboard E2E test..."
echo ""

cd "${REPO_ROOT}"

export FT_REVIEWER_EVIDENCE_DIR="${EVIDENCE_DIR}"
export JIRA_BASE_URL="${JIRA_BASE_URL}"
export JIRA_DASHBOARD_URL="${JIRA_DASHBOARD_URL}"

TEST_EXIT_CODE=0
npx playwright test \
  --config="${PLAYWRIGHT_CONFIG}" \
  "${TEST_SPEC}" \
  || TEST_EXIT_CODE=$?

echo ""
echo "Test exit code: ${TEST_EXIT_CODE}"
echo ""

# ============================================================================
# Parse test result
# ============================================================================
SUMMARY_FILE="${EVIDENCE_DIR}/summary.json"
if [[ ! -f "${SUMMARY_FILE}" ]]; then
  echo "ERROR: summary.json not found - test did not complete"
  echo "FAIL (no summary)" > "${FINAL_VERDICT_FILE}"
  exit 1
fi

TEST_STATUS=$(jq -r '.status' "${SUMMARY_FILE}")
echo "[RESULT] Test status: ${TEST_STATUS}"

# ============================================================================
# Generate SHA256 manifest
# ============================================================================
echo ""
echo "[MANIFEST] Generating SHA256 manifest..."

# Find all files except manifest and pack hash (stable sort order)
cd "${EVIDENCE_DIR}"
find . -type f \
  ! -name "manifest.sha256" \
  ! -name "PROOF_PACK_SHA256.txt" \
  ! -name "FINAL_VERDICT.txt" \
  | sort \
  | xargs sha256sum > "${MANIFEST_FILE}"

echo "✓ Manifest generated: ${MANIFEST_FILE}"
echo "  Files hashed: $(wc -l < "${MANIFEST_FILE}")"
echo ""

# ============================================================================
# Generate proof pack hash
# ============================================================================
echo "[HASH] Computing proof pack hash (hash of manifest)..."
PACK_HASH=$(sha256sum "${MANIFEST_FILE}" | awk '{print $1}')
echo "${PACK_HASH}" > "${PACK_HASH_FILE}"
echo "✓ Proof pack hash: ${PACK_HASH}"
echo ""

# ============================================================================
# Write final verdict
# ============================================================================
echo "[VERDICT] Writing final verdict..."
echo "${TEST_STATUS}" > "${FINAL_VERDICT_FILE}"
echo "✓ Final verdict: ${TEST_STATUS}"
echo ""

# ============================================================================
# Summary
# ============================================================================
echo "============================================================"
echo "Evidence Pack Complete"
echo "============================================================"
echo "Location: ${EVIDENCE_DIR}"
echo "Status: ${TEST_STATUS}"
echo "Pack hash: ${PACK_HASH}"
echo ""
echo "Files:"
ls -lh "${EVIDENCE_DIR}" | tail -n +2
echo ""
echo "To verify:"
echo "  ${SCRIPT_DIR}/verify_reviewer_proof_pack.sh \"${EVIDENCE_DIR}\""
echo ""

if [[ "${TEST_STATUS}" == "PASS" ]]; then
  exit 0
else
  exit 1
fi
