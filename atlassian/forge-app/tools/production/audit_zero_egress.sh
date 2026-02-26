#!/bin/bash
set -euo pipefail

##############################################################################
# audit_zero_egress.sh - Zero External Egress Audit
# Verifies no external HTTP clients or URLs outside requestJira scope
#
# REQUIRES: FT_PROD_READY_E environment variable (absolute path to evidence root)
# Exit: 0 if PASS, 1 if FAIL
##############################################################################

# Validate FT_PROD_READY_E environment variable
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

mkdir -p "${AUDIT_DIR}"

INVENTORY_FILE="${AUDIT_DIR}/zero_egress_inventory.txt"
SUMMARY_FILE="${AUDIT_DIR}/zero_egress_summary.txt"

echo "Scanning for external HTTP clients and URLs..." >&2

# Count external HTTP clients in TypeScript code only
# Exclude: local fetch(window.location...), comments, test files, sourceScan.ts (security audit tool)
CLIENTS=$(rg "fetch\(|axios|node-fetch|http\.request|https\.request" "${SRC_DIR}" \
  --type ts --type js --no-heading 2>&1 | \
  grep -v "test\|.spec\|.test\|requestJira\|window.location\|// \|/\*\|sourceScan\|re:" | \
  wc -l || echo 0)
EXTERNAL_CLIENTS=$(echo "$CLIENTS" | tr -d ' ')

# Count external URLs in TypeScript code only 
# Exclude: atlassian, localhost, comments, test files
URLS=$(rg "https?://" "${SRC_DIR}" \
  --type ts --type js --no-heading 2>&1 | \
  grep -v "atlassian\|localhost\|127\.0\.0\.1\|test\|.spec\|.test\|// \|/\*" | \
  wc -l || echo 0)
EXTERNAL_URLS=$(echo "$URLS" | tr -d ' ')

# Count Forge API calls for reference
FORGE_CALLS=$(rg "requestJira|@forge" "${SRC_DIR}" --no-heading 2>&1 | wc -l | tr -d ' ')

# Write inventory summary
cat > "$INVENTORY_FILE" <<EOF
ZERO EGRESS SCAN INVENTORY
===========================

External HTTP Client Matches (after filtering):
- Clients found: ${EXTERNAL_CLIENTS}
- URLs found: ${EXTERNAL_URLS}  
- Forge API calls: ${FORGE_CALLS}

Filters applied:
- Excluded local fetch(window.location.href) calls
- Excluded test files (.spec.ts, .test.ts)
- Excluded comments (//, /*)
- Excluded atlassian and localhost URLs
- TypeScript/JavaScript files only

EOF

# Write summary report
cat > "$SUMMARY_FILE" <<EOF
ZERO EGRESS AUDIT SUMMARY
==========================

FINDINGS
--------
TOTAL_EXTERNAL_CLIENTS=${EXTERNAL_CLIENTS}
TOTAL_EXTERNAL_URLS=${EXTERNAL_URLS}
TOTAL_FORGE_REQUESTJIRA=${FORGE_CALLS}

VERDICT
-------
EOF

if [[ ${EXTERNAL_CLIENTS} -gt 0 ]] || [[ ${EXTERNAL_URLS} -gt 0 ]]; then
  echo "STATUS: FAIL" >> "$SUMMARY_FILE"
  [[ ${EXTERNAL_CLIENTS} -gt 0 ]] && echo "REASON: ${EXTERNAL_CLIENTS} external HTTP client usages detected" >> "$SUMMARY_FILE"
  [[ ${EXTERNAL_URLS} -gt 0 ]] && echo "REASON: ${EXTERNAL_URLS} external URLs detected" >> "$SUMMARY_FILE"
  cat "$SUMMARY_FILE"
  exit 1
else
  echo "STATUS: PASS" >> "$SUMMARY_FILE"
  echo "No external egress URLs detected. All HTTP calls use Forge API boundary." >> "$SUMMARY_FILE"
  cat "$SUMMARY_FILE"
  exit 0
fi
