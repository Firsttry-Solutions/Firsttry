#!/bin/bash
set -euo pipefail

##############################################################################
# proof_enterprise_audit_repro.sh - Prove Enterprise Audit Reproducibility
#
# Runs audit twice with different evidence directories
# Verifies output is deterministic (bitwise identical)
#
# Usage: ./tools/production/proof_enterprise_audit_repro.sh
# Exit: 0 if reproducible (all artifacts identical), 1 otherwise
##############################################################################

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TOOLS_PROD="${REPO_ROOT}/tools/production"

# Create two independent temp directories
E1="/tmp/ft_audit_run1_$$"
E2="/tmp/ft_audit_run2_$$"

trap "rm -rf \"${E1}\" \"${E2}\"" EXIT

mkdir -p "${E1}" "${E2}"

echo "Enterprise Audit Reproducibility Proof"
echo "====================================="
echo ""
echo "Run 1: Evidence directory = ${E1}"
FT_PROD_READY_E="${E1}" bash "${TOOLS_PROD}/run_enterprise_audit.sh" > /tmp/run1.log 2>&1
RUN1_EXIT=$?

echo "Run 2: Evidence directory = ${E2}"
FT_PROD_READY_E="${E2}" bash "${TOOLS_PROD}/run_enterprise_audit.sh" > /tmp/run2.log 2>&1
RUN2_EXIT=$?

echo ""
echo "Comparison Results"
echo "=================="
echo ""

AUDIT_DIR1="${E1}/14_enterprise_audit"
AUDIT_DIR2="${E2}/14_enterprise_audit"

if [[ ! -d "${AUDIT_DIR1}" ]]; then
  echo "❌ Run 1 did not produce evidence directory"
  exit 1
fi

if [[ ! -d "${AUDIT_DIR2}" ]]; then
  echo "❌ Run 2 did not produce evidence directory"
  exit 1
fi

# Compare exit codes
echo "Exit Codes:"
echo "  Run 1: ${RUN1_EXIT}"
echo "  Run 2: ${RUN2_EXIT}"
if [[ ${RUN1_EXIT} -ne ${RUN2_EXIT} ]]; then
  echo "  ❌ MISMATCH: Exit codes differ"
  exit 1
else
  echo "  ✅ MATCH"
fi

echo ""

# Compare each evidence file
IDENTICAL=0
MISMATCHES=0

for file in "${AUDIT_DIR1}"/*; do
  filename=$(basename "${file}")
  file2="${AUDIT_DIR2}/${filename}"
  
  if [[ ! -f "${file2}" ]]; then
    echo "❌ File missing in Run 2: ${filename}"
    MISMATCHES=$((MISMATCHES + 1))
    continue
  fi
  
  if cmp -s "${file}" "${file2}"; then
    echo "✅ ${filename}"
    IDENTICAL=$((IDENTICAL + 1))
  else
    echo "❌ ${filename} - DIFFERS"
    echo "   Run 1 MD5: $(md5sum "${file}" | cut -d' ' -f1)"
    echo "   Run 2 MD5: $(md5sum "${file2}" | cut -d' ' -f1)"
    MISMATCHES=$((MISMATCHES + 1))
  fi
done

echo ""
echo "Summary"
echo "======="
echo "Identical files: ${IDENTICAL}"
echo "Mismatches: ${MISMATCHES}"
echo ""

if [[ ${MISMATCHES} -eq 0 ]]; then
  echo "✅ REPRODUCIBILITY VERIFIED: All artifacts are deterministic"
  exit 0
else
  echo "❌ REPRODUCIBILITY FAILED: Some artifacts differ between runs"
  exit 1
fi
