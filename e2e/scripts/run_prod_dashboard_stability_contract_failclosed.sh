#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# run_prod_dashboard_stability_contract_failclosed.sh
#
# Fail-closed runner for prod dashboard stability contract gate.
# Executes Playwright test that validates:
# - No page errors
# - No console errors/warnings
# - No HTTP 4xx/5xx responses for Jira API endpoints
# - Dashboard reaches ready state within 30s
# ============================================================================

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
readonly TEST_FILE="${REPO_ROOT}/e2e/tests/prod_dashboard_stability_contract.spec.ts"
readonly EVIDENCE_BASE="/tmp"
readonly EVIDENCE_PREFIX="ft_dashboard_stability_run_"

# Utilities
utc_timestamp() {
  date -u +"%Y%m%dT%H%M%SZ"
}

log_info() {
  echo "[INFO] $*" >&2
}

log_error() {
  echo "[ERROR] $*" >&2
}

fail() {
  log_error "$*"
  exit 1
}

# ============================================================================
# Setup: Create runner evidence directory
# ============================================================================

RUN_TIMESTAMP=$(utc_timestamp)
RUN_DIR="${EVIDENCE_BASE}/${EVIDENCE_PREFIX}${RUN_TIMESTAMP}"

log_info "Creating evidence directory: ${RUN_DIR}"
mkdir -p "${RUN_DIR}"

# Write runner metadata
{
  echo "${RUN_DIR}"
} > "${RUN_DIR}/RUN_DIR.txt"

{
  date -u +"%Y-%m-%dT%H:%M:%SZ"
} > "${RUN_DIR}/START_UTC.txt"

{
  git -C "${REPO_ROOT}" rev-parse HEAD
} > "${RUN_DIR}/GIT_HEAD.txt"

{
  git -C "${REPO_ROOT}" status --porcelain
} > "${RUN_DIR}/GIT_STATUS.txt"

if git -C "${REPO_ROOT}" diff-index --quiet HEAD --; then
  echo "false" > "${RUN_DIR}/GIT_DIRTY.txt"
else
  echo "true" > "${RUN_DIR}/GIT_DIRTY.txt"
fi

log_info "Runner metadata written to ${RUN_DIR}"

# ============================================================================
# Precondition: Test file exists
# ============================================================================

if [[ ! -f "${TEST_FILE}" ]]; then
  fail "Test file not found: ${TEST_FILE}"
fi

log_info "Test file verified: ${TEST_FILE}"

# ============================================================================
# Run Playwright test
# ============================================================================

log_info "Running Playwright test: ${TEST_FILE}"

TEST_OUTPUT_FILE="${RUN_DIR}/test_output.log"
TEST_EXIT_CODE=0

cd "${REPO_ROOT}"
if npx playwright test "${TEST_FILE}" --reporter=line 2>&1 | tee "${TEST_OUTPUT_FILE}"; then
  TEST_EXIT_CODE=0
else
  TEST_EXIT_CODE=$?
fi

log_info "Playwright test exit code: ${TEST_EXIT_CODE}"

# ============================================================================
# Detect and validate test evidence directory
# ============================================================================

log_info "Detecting test evidence directory..."

# Parse EVIDENCE_DIR from test output
CHILD_EVIDENCE_DIR=""
while IFS= read -r line; do
  if [[ "${line}" =~ ^EVIDENCE_DIR=(.*)$ ]]; then
    CHILD_EVIDENCE_DIR="${BASH_REMATCH[1]}"
    break
  fi
done < "${TEST_OUTPUT_FILE}"

if [[ -z "${CHILD_EVIDENCE_DIR}" ]]; then
  fail "Could not detect test evidence directory from Playwright output"
fi

if [[ ! -d "${CHILD_EVIDENCE_DIR}" ]]; then
  fail "Test evidence directory does not exist: ${CHILD_EVIDENCE_DIR}"
fi

log_info "Test evidence directory detected: ${CHILD_EVIDENCE_DIR}"

# Write child directory reference
{
  echo "${CHILD_EVIDENCE_DIR}"
} > "${RUN_DIR}/child_evidence_dir.txt"

# ============================================================================
# Validate test evidence
# ============================================================================

log_info "Validating test evidence..."

# Check for SUCCESS.txt or FAIL.txt
if [[ ! -f "${CHILD_EVIDENCE_DIR}/SUCCESS.txt" ]] && [[ ! -f "${CHILD_EVIDENCE_DIR}/FAIL.txt" ]]; then
  fail "Test evidence missing SUCCESS.txt or FAIL.txt"
fi

# Fail if test FAIL.txt exists
if [[ -f "${CHILD_EVIDENCE_DIR}/FAIL.txt" ]]; then
  log_error "Test marked as FAIL:"
  cat "${CHILD_EVIDENCE_DIR}/FAIL.txt" >&2
  fail "Test evidence indicates failure"
fi

# Fail if Playwright exited non-zero
if [[ ${TEST_EXIT_CODE} -ne 0 ]]; then
  fail "Playwright test exited with non-zero code: ${TEST_EXIT_CODE}"
fi

log_info "Test evidence validation passed"

# ============================================================================
# Copy key evidence files to runner directory
# ============================================================================

log_info "Copying test evidence to runner directory..."

# Copy key result files
for file in final_url.txt host.txt path.txt console_errors.txt console_warnings.txt page_errors.txt http_4xx_5xx_hits.txt timings.json SUCCESS.txt; do
  if [[ -f "${CHILD_EVIDENCE_DIR}/${file}" ]]; then
    cp "${CHILD_EVIDENCE_DIR}/${file}" "${RUN_DIR}/"
  fi
done

# Copy screenshots if present (best-effort)
for file in success.png failure.png; do
  if [[ -f "${CHILD_EVIDENCE_DIR}/${file}" ]]; then
    cp "${CHILD_EVIDENCE_DIR}/${file}" "${RUN_DIR}/" || true
  fi
done

log_info "Evidence copy complete"

# ============================================================================
# Success
# ============================================================================

{
  echo "PASS"
} > "${RUN_DIR}/SUCCESS.txt"

log_info "Stability contract gate PASSED"
log_info "Evidence directory: ${RUN_DIR}"

exit 0
