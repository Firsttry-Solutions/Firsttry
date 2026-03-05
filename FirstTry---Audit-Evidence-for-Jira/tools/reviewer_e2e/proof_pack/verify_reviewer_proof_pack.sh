#!/usr/bin/env bash
#
# verify_reviewer_proof_pack.sh
# 
# Verifies a reviewer E2E evidence pack offline (no network required).
# 
# Usage:
#   ./verify_reviewer_proof_pack.sh <EVIDENCE_DIR>
# 
# Verification steps:
#   1. Check required files exist
#   2. Recompute SHA256 manifest
#   3. Compare with original manifest (detect tampering)
#   4. Verify proof pack hash
#   5. Parse summary.json and gadget_verdict.json
#   6. Validate FINAL_VERDICT.txt matches summary
# 
# Exit codes:
#   0 - Verification PASSED (evidence pack intact, test passed)
#   1 - Verification FAILED (tampering detected, missing files, or test failed)
#   2 - Fatal error (invalid arguments, evidence dir not found)
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ============================================================================
# Arguments
# ============================================================================
if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <EVIDENCE_DIR>"
  echo ""
  echo "Example:"
  echo "  $0 /tmp/ft_reviewer_e2e_20240101T000000Z"
  exit 2
fi

EVIDENCE_DIR="$1"

if [[ ! -d "${EVIDENCE_DIR}" ]]; then
  echo "ERROR: Evidence directory not found: ${EVIDENCE_DIR}"
  exit 2
fi

echo "============================================================"
echo "Reviewer E2E Evidence Pack Verifier"
echo "============================================================"
echo "Evidence dir: ${EVIDENCE_DIR}"
echo ""

# ============================================================================
# Check required files exist
# ============================================================================
echo "[FILES] Checking required files exist..."

REQUIRED_FILES=(
  "summary.json"
  "allowlists.json"
  "gadget_verdict.json"
  "reviewer_env.json"
  "manifest.sha256"
  "PROOF_PACK_SHA256.txt"
  "FINAL_VERDICT.txt"
  "04_playwright/screenshots/debug_page_source.html"
  "04_playwright/screenshots/debug_page_meta.json"
  "04_playwright/screenshots/dashboard_discovery.json"
  "04_playwright/screenshots/iframes_inventory.json"
  "04_playwright/screenshots/01_dashboard_full.png"
  "04_playwright/screenshots/02_dashboard_viewport.png"
  "04_playwright/logs/console.log"
  "04_playwright/logs/console_classified.json"
  "04_playwright/network/network_requests.log"
  "04_playwright/network/network_domains.json"
  "04_playwright/network/network_domains_sorted.txt"
)

MISSING_FILES=()
for file in "${REQUIRED_FILES[@]}"; do
  if [[ ! -f "${EVIDENCE_DIR}/${file}" ]]; then
    MISSING_FILES+=("${file}")
  fi
done

if [[ ${#MISSING_FILES[@]} -gt 0 ]]; then
  echo "ERROR: Missing required files:"
  for file in "${MISSING_FILES[@]}"; do
    echo "  - ${file}"
  done
  exit 1
fi

echo "✓ All required files present (${#REQUIRED_FILES[@]} files)"
echo ""

# ============================================================================
# Recompute manifest
# ============================================================================
echo "[MANIFEST] Recomputing SHA256 manifest..."

cd "${EVIDENCE_DIR}"

# Recompute manifest (same order as builder)
RECOMPUTED_MANIFEST=$(mktemp)
find . -type f \
  ! -name "manifest.sha256" \
  ! -name "PROOF_PACK_SHA256.txt" \
  ! -name "FINAL_VERDICT.txt" \
  | sort \
  | xargs sha256sum > "${RECOMPUTED_MANIFEST}"

# Compare with original
ORIGINAL_MANIFEST="${EVIDENCE_DIR}/manifest.sha256"
if diff -q "${ORIGINAL_MANIFEST}" "${RECOMPUTED_MANIFEST}" > /dev/null; then
  echo "✓ Manifest matches (no tampering detected)"
else
  echo "ERROR: Manifest mismatch (tampering detected)"
  echo ""
  echo "Diff:"
  diff "${ORIGINAL_MANIFEST}" "${RECOMPUTED_MANIFEST}" || true
  rm -f "${RECOMPUTED_MANIFEST}"
  exit 1
fi

rm -f "${RECOMPUTED_MANIFEST}"
echo ""

# ============================================================================
# Verify proof pack hash
# ============================================================================
echo "[HASH] Verifying proof pack hash..."

STORED_HASH=$(cat "${EVIDENCE_DIR}/PROOF_PACK_SHA256.txt")
COMPUTED_HASH=$(sha256sum "${ORIGINAL_MANIFEST}" | awk '{print $1}')

if [[ "${STORED_HASH}" == "${COMPUTED_HASH}" ]]; then
  echo "✓ Proof pack hash matches: ${STORED_HASH}"
else
  echo "ERROR: Proof pack hash mismatch"
  echo "  Stored:   ${STORED_HASH}"
  echo "  Computed: ${COMPUTED_HASH}"
  exit 1
fi
echo ""

# ============================================================================
# Parse summary.json
# ============================================================================
echo "[SUMMARY] Parsing summary.json..."

SUMMARY_FILE="${EVIDENCE_DIR}/summary.json"
TEST_STATUS=$(jq -r '.status' "${SUMMARY_FILE}")
FAILURE_REASON=$(jq -r '.failureReason // "N/A"' "${SUMMARY_FILE}")
CONSOLE_HOST_ERRORS=$(jq -r '.consoleHostErrors' "${SUMMARY_FILE}")
CONSOLE_FORGE_ERRORS=$(jq -r '.consoleForgeErrors' "${SUMMARY_FILE}")
CONSOLE_APP_ERRORS=$(jq -r '.consoleAppErrors' "${SUMMARY_FILE}")
PAGE_ERRORS=$(jq -r '.pageErrors' "${SUMMARY_FILE}")
REQUEST_FAILED=$(jq -r '.requestFailed' "${SUMMARY_FILE}")
NETWORK_REQUESTS=$(jq -r '.networkRequests' "${SUMMARY_FILE}")

echo "  Test status: ${TEST_STATUS}"
if [[ "${TEST_STATUS}" == "FAIL" ]]; then
  echo "  Failure reason: ${FAILURE_REASON}"
fi
echo "  Console errors:"
echo "    - Host: ${CONSOLE_HOST_ERRORS}"
echo "    - Forge runtime: ${CONSOLE_FORGE_ERRORS}"
echo "    - App: ${CONSOLE_APP_ERRORS}"
echo "  Page errors: ${PAGE_ERRORS}"
echo "  Failed requests: ${REQUEST_FAILED}"
echo "  Network requests: ${NETWORK_REQUESTS}"
echo ""

# ============================================================================
# Parse gadget_verdict.json
# ============================================================================
echo "[GADGET] Parsing gadget_verdict.json..."

GADGET_VERDICT_FILE="${EVIDENCE_DIR}/gadget_verdict.json"
if [[ -f "${GADGET_VERDICT_FILE}" ]]; then
  GADGET_PRESENT=$(jq -r '.gadget_present' "${GADGET_VERDICT_FILE}")
  IFRAME_DETECTED=$(jq -r '.iframe_detected' "${GADGET_VERDICT_FILE}")
  IFRAME_SCORE=$(jq -r '.iframe_score' "${GADGET_VERDICT_FILE}")
  FRAME_ACCESSIBLE=$(jq -r '.frame_accessible' "${GADGET_VERDICT_FILE}")
  CROSS_ORIGIN_BLOCKED=$(jq -r '.cross_origin_blocked' "${GADGET_VERDICT_FILE}")
  
  echo "  Gadget present: ${GADGET_PRESENT}"
  echo "  Iframe detected: ${IFRAME_DETECTED}"
  echo "  Iframe score: ${IFRAME_SCORE}"
  echo "  Frame accessible: ${FRAME_ACCESSIBLE}"
  echo "  Cross-origin blocked: ${CROSS_ORIGIN_BLOCKED}"
  
  if [[ "${GADGET_PRESENT}" != "true" ]]; then
    echo "  WARNING: gadget_present=false (gadget not detected)"
  fi
else
  echo "  WARNING: gadget_verdict.json not found (test may have failed early)"
fi
echo ""

# ============================================================================
# Verify FINAL_VERDICT.txt
# ============================================================================
echo "[VERDICT] Verifying FINAL_VERDICT.txt..."

FINAL_VERDICT=$(cat "${EVIDENCE_DIR}/FINAL_VERDICT.txt")
if [[ "${FINAL_VERDICT}" == "${TEST_STATUS}" ]]; then
  echo "✓ FINAL_VERDICT.txt matches summary.json: ${FINAL_VERDICT}"
else
  echo "ERROR: FINAL_VERDICT.txt mismatch"
  echo "  FINAL_VERDICT.txt: ${FINAL_VERDICT}"
  echo "  summary.json:      ${TEST_STATUS}"
  exit 1
fi
echo ""

# ============================================================================
# Final result
# ============================================================================
echo "============================================================"
echo "Verification Complete"
echo "============================================================"
echo "Evidence pack: INTACT (no tampering)"
echo "Test result: ${TEST_STATUS}"
echo ""

if [[ "${TEST_STATUS}" == "PASS" ]]; then
  echo "✓ VERIFICATION PASSED"
  echo "  - Evidence pack is intact"
  echo "  - Test PASSED"
  echo "  - Gadget rendered successfully"
  exit 0
else
  echo "✗ VERIFICATION FAILED"
  echo "  - Evidence pack is intact"
  echo "  - Test FAILED"
  echo "  - Reason: ${FAILURE_REASON}"
  exit 1
fi
