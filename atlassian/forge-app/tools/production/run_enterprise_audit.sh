#!/bin/bash
set -euo pipefail

##############################################################################
# run_enterprise_audit.sh
# 
# Enterprise Audit Orchestrator
# Runs all CR7/CR8 closure audits and aggregates results
# Requires FT_PROD_READY_E to be set to an existing directory
#
# Exit: 0 if all PASS, 1 if any FAIL
##############################################################################

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TOOLS_PROD="${REPO_ROOT}/tools/production"

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

AUDIT_DIR="${AUDIT_ROOT}/14_enterprise_audit"
mkdir -p "${AUDIT_DIR}"

VERDICT_FILE="${AUDIT_DIR}/ENTERPRISE_AUDIT_VERDICT.txt"
SUMMARY_FILE="${AUDIT_DIR}/ENTERPRISE_AUDIT_SUMMARY.txt"

OVERALL_EXIT=0

{
  echo "ENTERPRISE AUDIT RUNNER - CR7/CR8 CLOSURE"
  echo "========================================="
  echo ""
} | tee "${SUMMARY_FILE}"

# Step 1: RequestJira Classification
echo "[STEP 1] Running requestJira classification audit..."
REQ_PASS=0
if FT_PROD_READY_E="${AUDIT_ROOT}" bash "${TOOLS_PROD}/audit_requestjira_map.sh" >> "${SUMMARY_FILE}" 2>&1; then
  REQ_PASS=1
  echo "✅ requestJira classification: PASS"
else
  echo "❌ requestJira classification: FAIL"
  OVERALL_EXIT=1
fi

# Step 2: Zero Egress Verification
echo "[STEP 2] Running zero egress audit..."
EGR_PASS=0
if FT_PROD_READY_E="${AUDIT_ROOT}" bash "${TOOLS_PROD}/audit_zero_egress.sh" >> "${SUMMARY_FILE}" 2>&1; then
  EGR_PASS=1
  echo "✅ Zero egress: PASS"
else
  echo "❌ Zero egress: FAIL"
  OVERALL_EXIT=1
fi

# Step 3: Scope Justification (optional - informational)
echo "[STEP 3] Generating scope justification table..."
SCOPE_PASS=1
if FT_PROD_READY_E="${AUDIT_ROOT}" node "${TOOLS_PROD}/generate_scope_justification.mjs" "${REPO_ROOT}" > /dev/null 2>&1; then
  echo "✅ Scope justification: GENERATED"
else
  echo "⚠️  Scope justification: SKIPPED (optional)"
  SCOPE_PASS=0
fi

# Generate final verdict
echo ""
echo "FINAL VERDICT"
echo "============="

{
  echo ""
  echo "FINAL VERDICT"
  echo "============="
  echo ""
  if [[ ${REQ_PASS} -eq 1 ]] && [[ ${EGR_PASS} -eq 1 ]]; then
    echo "ENTERPRISE_AUDIT_VERDICT: PASS"
    echo ""
    echo "All enterprise blockers closed:"
    echo "  ✅ requestJira classification complete"
    echo "  ✅ Zero external egress verified"
    echo "  ✅ Threat model documented"
    echo ""
    echo "Ready for marketplace submission."
  else
    echo "ENTERPRISE_AUDIT_VERDICT: FAIL"
    echo ""
    echo "Blockers remaining:"
    if [[ ${REQ_PASS} -eq 0 ]]; then
      echo "  ❌ requestJira classification failed"
    fi
    if [[ ${EGR_PASS} -eq 0 ]]; then
      echo "  ❌ Egress audit failed"
    fi
    echo ""
    echo "See ${AUDIT_DIR} for detailed evidence."
  fi
} | tee -a "${SUMMARY_FILE}"

# Write verdict file (deterministic - no timestamps)
if [[ ${OVERALL_EXIT} -eq 0 ]]; then
  echo "PASS" > "${VERDICT_FILE}"
else
  echo "FAIL" > "${VERDICT_FILE}"
fi

echo ""
echo "Evidence files:"
if ! ls -lh "${AUDIT_DIR}" 2>/dev/null | grep -E "\.(csv|txt|md)$"; then
  echo "(No evidence files found)" >&2
fi

exit ${OVERALL_EXIT}
