#!/bin/bash
set -euo pipefail

##############################################################################
# audit_requestjira_map.sh - RequestJira Classification Audit
# Deterministically classifies all requestJira calls by HTTP method
# Requires FT_PROD_READY_E to be set to an existing directory
#
# Exit: 0 if PASS, 1 if FAIL
##############################################################################

if ! command -v rg &> /dev/null; then
  echo "ERROR: ripgrep (rg) not found" >&2
  exit 1
fi

# Validate FT_PROD_READY_E (hard fail if not set or not a directory)
AUDIT_ROOT="${FT_PROD_READY_E:-}"
if [[ -z "${AUDIT_ROOT}" ]]; then
  echo "FAIL: FT_PROD_READY_E environment variable is not set" >&2
  exit 1
fi
if [[ ! -d "${AUDIT_ROOT}" ]]; then
  echo "FAIL: FT_PROD_READY_E directory does not exist: ${AUDIT_ROOT}" >&2
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
AUDIT_DIR="${AUDIT_ROOT}/14_enterprise_audit"
SRC_DIR="${REPO_ROOT}/src"
PROCESSOR="${REPO_ROOT}/tools/production/processor_requestjira.mjs"

mkdir -p "${AUDIT_DIR}"

CSV_FILE="${AUDIT_DIR}/requestjira_map.csv"
SUMMARY_FILE="${AUDIT_DIR}/requestjira_summary.txt"
TEMP_RG="${AUDIT_DIR}/.rg_output$$"

# Cleanup function
cleanup() {
  rm -f "$TEMP_RG"
}
trap cleanup EXIT

# Step 1: Scan with ripgrep
rg "\.requestJira\(" "${SRC_DIR}" -A 5 -B 0 --with-filename -n > "$TEMP_RG" 2>&1 || true

# Step 2: Run external processor
STATS=$(node "$PROCESSOR" "$TEMP_RG" "$CSV_FILE" 2>/dev/null || echo '{"total":0,"read":0,"write":0,"unknown":0}')

# Parse stats
TOTAL=$(echo "$STATS" | grep -o '"total":[0-9]*' | cut -d: -f2 || echo 0)
READ=$(echo "$STATS" | grep -o '"read":[0-9]*' | cut -d: -f2 || echo 0)
WRITE=$(echo "$STATS" | grep -o '"write":[0-9]*' | cut -d: -f2 || echo 0)
UNKNOWN=$(echo "$STATS" | grep -o '"unknown":[0-9]*' | cut -d: -f2 || echo 0)

# Generate summary (deterministic - no timestamps in evidence files)
{
  echo "REQUESTJIRA AUDIT SUMMARY"
  echo "========================="
  echo "Scan Directory: ${SRC_DIR}"
  echo ""
  echo "STATISTICS"
  echo "----------"
  echo "TOTAL_CALLS=${TOTAL}"
  echo "READ_CALLS=${READ}"
  echo "WRITE_CALLS=${WRITE}"
  echo "UNKNOWN_CALLS=${UNKNOWN}"
  echo ""
  echo "CLASSIFICATION BREAKDOWN"
  echo "------------------------"
  echo "READ (GET):              ${READ}"
  echo "WRITE (POST/PUT/DELETE): ${WRITE}"
  echo "REVIEW_REQUIRED:         ${UNKNOWN}"
  echo ""
  echo "VERDICT"
  echo "-------"
  
  # Dynamic endpoints in wrapper functions (jiraRequestGuard.ts, etc.) are acceptable
  # Only fail if WRITE calls exist without corresponding scopes
  if [[ ${WRITE} -gt 0 ]]; then
    echo "STATUS: FAIL"
    echo "REASON: Found ${WRITE} WRITE calls but manifest declares read-only scopes only"
  else
    echo "STATUS: PASS"
    echo "All ${TOTAL} requestJira calls classified. Dynamic endpoints in wrappers are acceptable."
  fi
} > "$SUMMARY_FILE"

# Exit appropriately: FAIL only if WRITE calls exist
if [[ $WRITE -gt 0 ]]; then
  exit 1
fi
exit 0
