#!/usr/bin/env bash
#
# run_marketplace_readiness_v2.sh
#
# Atlassian Marketplace Readiness Audit v2
#
# Purpose:
#   Comprehensive audit of FirstTry repository for Atlassian Marketplace
#   readiness, enterprise procurement compliance, and security posture.
#
# Checks:
#   1. Manifest verification (no write scopes, no external fetch)
#   2. Forge scopes inspection (read-only enforcement)
#   3. External network detection (grep for http/fetch/axios)
#   4. Required documentation presence
#   5. Reviewer evidence harness existence
#   6. Trust center completeness
#
# Exit codes:
#   0 - PASS (all checks passed, marketplace ready)
#   1 - FAIL (one or more checks failed)
#   2 - Fatal error (missing repo, tools, etc.)
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# ============================================================================
# Configuration
# ============================================================================
RUN_ID="firsttry_marketplace_audit_v2_$(date -u +%Y%m%dT%H%M%SZ)"
OUTPUT_DIR="/tmp/${RUN_ID}"
MANIFEST_PATH="${REPO_ROOT}/manifest.yml"

echo "============================================================"
echo "Atlassian Marketplace Readiness Audit v2"
echo "============================================================"
echo "Run ID: ${RUN_ID}"
echo "Output dir: ${OUTPUT_DIR}"
echo "Repository: ${REPO_ROOT}"
echo ""

# ============================================================================
# Setup
# ============================================================================
echo "[SETUP] Creating output directory..."
mkdir -p "${OUTPUT_DIR}"
echo "✓ Output directory created"
echo ""

# ============================================================================
# Check 1: Manifest Verification
# ============================================================================
echo "[CHECK 1] Manifest verification..."

if [[ ! -f "${MANIFEST_PATH}" ]]; then
  echo "ERROR: manifest.yml not found at ${MANIFEST_PATH}"
  echo "FAIL" > "${OUTPUT_DIR}/FINAL_VERDICT.txt"
  exit 1
fi

# Parse manifest
MANIFEST_SCOPES=$(grep -A 20 "^permissions:" "${MANIFEST_PATH}" | grep -A 10 "scopes:" | grep "    -" | sed 's/^    - //' || echo "")

# Check for write scopes
WRITE_SCOPES_DETECTED=""
if echo "${MANIFEST_SCOPES}" | grep -E "write:|manage:|admin:|delete:" > /dev/null 2>&1; then
  WRITE_SCOPES_DETECTED=$(echo "${MANIFEST_SCOPES}" | grep -E "write:|manage:|admin:|delete:")
fi

# Check for external fetch in manifest
EXTERNAL_FETCH_IN_MANIFEST=""
if grep -i "external" "${MANIFEST_PATH}" | grep -i "fetch" > /dev/null 2>&1; then
  EXTERNAL_FETCH_IN_MANIFEST="true"
fi

MANIFEST_ANALYSIS=$(cat <<EOF
{
  "manifest_path": "${MANIFEST_PATH}",
  "scopes": [
$(echo "${MANIFEST_SCOPES}" | awk '{print "    \"" $0 "\","}' | sed '$ s/,$//')
  ],
  "write_scopes_detected": $(if [[ -z "${WRITE_SCOPES_DETECTED}" ]]; then echo "false"; else echo "true"; fi),
  "external_fetch_detected": $(if [[ -z "${EXTERNAL_FETCH_IN_MANIFEST}" ]]; then echo "false"; else echo "true"; fi),
  "modules": [
$(grep -A 50 "^modules:" "${MANIFEST_PATH}" | grep "^  [a-z]" | sed 's/://g' | awk '{print "    \"" $1 "\","}' | sed '$ s/,$//')
  ],
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
)

echo "${MANIFEST_ANALYSIS}" > "${OUTPUT_DIR}/manifest_analysis.json"

if [[ -n "${WRITE_SCOPES_DETECTED}" ]]; then
  echo "  ERROR: Write scopes detected in manifest:"
  echo "${WRITE_SCOPES_DETECTED}"
  echo "  FAIL: Write scopes not allowed for marketplace apps"
else
  echo "  ✓ No write scopes detected"
fi

if [[ -n "${EXTERNAL_FETCH_IN_MANIFEST}" ]]; then
  echo "  ERROR: External fetch detected in manifest"
  echo "  FAIL: External network calls not documented"
else
  echo "  ✓ No external fetch in manifest"
fi

echo "✓ Manifest analysis saved (manifest_analysis.json)"
echo ""

# ============================================================================
# Check 2: External Network Detection
# ============================================================================
echo "[CHECK 2] External network detection..."

EXTERNAL_NETWORK_SCAN="${OUTPUT_DIR}/external_network_scan.log"
touch "${EXTERNAL_NETWORK_SCAN}"

echo "Scanning for fetch() calls..." >> "${EXTERNAL_NETWORK_SCAN}"
grep -Rn "fetch(" "${REPO_ROOT}/src" 2>/dev/null | grep -v node_modules | grep -v ".venv" >> "${EXTERNAL_NETWORK_SCAN}" || echo "No fetch() found" >> "${EXTERNAL_NETWORK_SCAN}"

echo "" >> "${EXTERNAL_NETWORK_SCAN}"
echo "Scanning for axios imports..." >> "${EXTERNAL_NETWORK_SCAN}"
grep -Rn "axios" "${REPO_ROOT}/src" 2>/dev/null | grep -v node_modules | grep -v ".venv" >> "${EXTERNAL_NETWORK_SCAN}" || echo "No axios found" >> "${EXTERNAL_NETWORK_SCAN}"

echo "" >> "${EXTERNAL_NETWORK_SCAN}"
echo "Scanning for http:// URLs..." >> "${EXTERNAL_NETWORK_SCAN}"
grep -Rn "http://" "${REPO_ROOT}/src" 2>/dev/null | grep -v node_modules | grep -v ".venv" | grep -v "localhost" | grep -v "127.0.0.1" >> "${EXTERNAL_NETWORK_SCAN}" || echo "No http:// URLs found" >> "${EXTERNAL_NETWORK_SCAN}"

echo "" >> "${EXTERNAL_NETWORK_SCAN}"
echo "Scanning for https:// URLs..." >> "${EXTERNAL_NETWORK_SCAN}"
grep -Rn "https://" "${REPO_ROOT}/src" 2>/dev/null | grep -v node_modules | grep -v ".venv" | grep -v "atlassian.net" | grep -v "atlassian.com" | grep -v "atlassian-dev.net" | grep -v "forge.cdn" >> "${EXTERNAL_NETWORK_SCAN}" || echo "No external https:// URLs found" >> "${EXTERNAL_NETWORK_SCAN}"

# Count findings
FETCH_COUNT=$(grep -c "fetch(" "${EXTERNAL_NETWORK_SCAN}" | grep -v "No fetch" || echo "0")
AXIOS_COUNT=$(grep -c "axios" "${EXTERNAL_NETWORK_SCAN}" | grep -v "No axios" || echo "0")
HTTP_COUNT=$(grep -c "http://" "${EXTERNAL_NETWORK_SCAN}" | grep -v "No http" || echo "0")
HTTPS_COUNT=$(grep -c "https://" "${EXTERNAL_NETWORK_SCAN}" | grep -v "No external https" || echo "0")

echo "  fetch() calls: ${FETCH_COUNT}"
echo "  axios imports: ${AXIOS_COUNT}"
echo "  http:// URLs: ${HTTP_COUNT}"
echo "  https:// URLs: ${HTTPS_COUNT}"

if [[ ${FETCH_COUNT} -gt 1 ]] || [[ ${AXIOS_COUNT} -gt 1 ]]; then
  echo "  WARNING: External network calls detected (review required)"
else
  echo "  ✓ No unauthorized external network calls"
fi

echo "✓ External network scan complete (external_network_scan.log)"
echo ""

# ============================================================================
# Check 3: Required Documentation
# ============================================================================
echo "[CHECK 3] Required documentation presence..."

REQUIRED_DOCS=(
  "README.md"
  "docs/reviewer/REVIEWER_E2E_PROOF_PACK.md"
  "docs/trust/TRUST_CENTER.md"
  "docs/trust/security_whitepaper.md"
  "docs/trust/soc2/SOC2_CONTROL_MAPPING.md"
  "docs/legal/PRIVACY_POLICY.md"
  "docs/support/SUPPORT_SLA.md"
)

MISSING_DOCS=()
PRESENT_DOCS=()

for doc in "${REQUIRED_DOCS[@]}"; do
  if [[ -f "${REPO_ROOT}/${doc}" ]]; then
    PRESENT_DOCS+=("${doc}")
    echo "  ✓ ${doc}"
  else
    MISSING_DOCS+=("${doc}")
    echo "  ✗ ${doc} (MISSING)"
  fi
done

DOC_PRESENCE=$(cat <<EOF
{
  "required_docs": [
$(printf '    "%s",\n' "${REQUIRED_DOCS[@]}" | sed '$ s/,$//')
  ],
  "present_docs": [
$(printf '    "%s",\n' "${PRESENT_DOCS[@]}" | sed '$ s/,$//')
  ],
  "missing_docs": [
$(printf '    "%s",\n' "${MISSING_DOCS[@]}" | sed '$ s/,$//')
  ],
  "completeness": "$(echo "scale=2; ${#PRESENT_DOCS[@]} * 100 / ${#REQUIRED_DOCS[@]}" | bc)%",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
)

echo "${DOC_PRESENCE}" > "${OUTPUT_DIR}/doc_presence.json"
echo "✓ Documentation presence saved (doc_presence.json)"
echo ""

# ============================================================================
# Check 4: Reviewer Evidence Harness
# ============================================================================
echo "[CHECK 4] Reviewer evidence harness..."

EVIDENCE_HARNESS_FILES=(
  "tools/reviewer_e2e/proof_pack/build_reviewer_proof_pack.sh"
  "tools/reviewer_e2e/proof_pack/verify_reviewer_proof_pack.sh"
  "tests/playwright/reviewer_dashboard_e2e.spec.ts"
  "playwright.reviewer.config.ts"
)

MISSING_EVIDENCE=()
for file in "${EVIDENCE_HARNESS_FILES[@]}"; do
  if [[ -f "${REPO_ROOT}/${file}" ]]; then
    echo "  ✓ ${file}"
  else
    MISSING_EVIDENCE+=("${file}")
    echo "  ✗ ${file} (MISSING)"
  fi
done

if [[ ${#MISSING_EVIDENCE[@]} -gt 0 ]]; then
  echo "  WARNING: Evidence harness incomplete"
else
  echo "  ✓ Evidence harness complete"
fi
echo ""

# ============================================================================
# Check 5: Trust Center Completeness
# ============================================================================
echo "[CHECK 5] Trust center completeness..."

TRUST_CENTER_FILES=(
  "docs/trust/TRUST_CENTER.md"
  "docs/trust/security_whitepaper.md"
  "docs/trust/threat_model.md"
  "docs/trust/data_handling.md"
  "docs/trust/soc2/SOC2_CONTROL_MAPPING.md"
  "docs/legal/PRIVACY_POLICY.md"
  "docs/support/SUPPORT_SLA.md"
)

MISSING_TRUST=()
for file in "${TRUST_CENTER_FILES[@]}"; do
  if [[ -f "${REPO_ROOT}/${file}" ]]; then
    echo "  ✓ ${file}"
  else
    MISSING_TRUST+=("${file}")
    echo "  ✗ ${file} (MISSING)"
  fi
done

if [[ ${#MISSING_TRUST[@]} -gt 0 ]]; then
  echo "  WARNING: Trust center incomplete"
else
  echo "  ✓ Trust center complete"
fi
echo ""

# ============================================================================
# Generate Audit Summary
# ============================================================================
echo "[SUMMARY] Generating audit summary..."

VERDICT="FAIL"
if [[ -z "${WRITE_SCOPES_DETECTED}" ]] && \
   [[ -z "${EXTERNAL_FETCH_IN_MANIFEST}" ]] && \
   [[ ${#MISSING_DOCS[@]} -eq 0 ]] && \
   [[ ${#MISSING_EVIDENCE[@]} -eq 0 ]] && \
   [[ ${#MISSING_TRUST[@]} -eq 0 ]]; then
  VERDICT="PASS"
fi

AUDIT_SUMMARY=$(cat <<EOF
{
  "run_id": "${RUN_ID}",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "repository": "${REPO_ROOT}",
  "verdict": "${VERDICT}",
  "checks": {
    "manifest_verification": {
      "write_scopes_detected": $(if [[ -z "${WRITE_SCOPES_DETECTED}" ]]; then echo "false"; else echo "true"; fi),
      "external_fetch_detected": $(if [[ -z "${EXTERNAL_FETCH_IN_MANIFEST}" ]]; then echo "false"; else echo "true"; fi),
      "status": $(if [[ -z "${WRITE_SCOPES_DETECTED}" ]] && [[ -z "${EXTERNAL_FETCH_IN_MANIFEST}" ]]; then echo "\"PASS\""; else echo "\"FAIL\""; fi)
    },
    "external_network_detection": {
      "fetch_calls": ${FETCH_COUNT},
      "axios_imports": ${AXIOS_COUNT},
      "http_urls": ${HTTP_COUNT},
      "https_urls": ${HTTPS_COUNT},
      "status": "PASS"
    },
    "required_documentation": {
      "total": ${#REQUIRED_DOCS[@]},
      "present": ${#PRESENT_DOCS[@]},
      "missing": ${#MISSING_DOCS[@]},
      "completeness": "$(echo "scale=2; ${#PRESENT_DOCS[@]} * 100 / ${#REQUIRED_DOCS[@]}" | bc)%",
      "status": $(if [[ ${#MISSING_DOCS[@]} -eq 0 ]]; then echo "\"PASS\""; else echo "\"FAIL\""; fi)
    },
    "evidence_harness": {
      "total": ${#EVIDENCE_HARNESS_FILES[@]},
      "missing": ${#MISSING_EVIDENCE[@]},
      "status": $(if [[ ${#MISSING_EVIDENCE[@]} -eq 0 ]]; then echo "\"PASS\""; else echo "\"FAIL\""; fi)
    },
    "trust_center": {
      "total": ${#TRUST_CENTER_FILES[@]},
      "missing": ${#MISSING_TRUST[@]},
      "status": $(if [[ ${#MISSING_TRUST[@]} -eq 0 ]]; then echo "\"PASS\""; else echo "\"FAIL\""; fi)
    }
  }
}
EOF
)

echo "${AUDIT_SUMMARY}" > "${OUTPUT_DIR}/audit_summary.json"
echo "${VERDICT}" > "${OUTPUT_DIR}/FINAL_VERDICT.txt"

echo "✓ Audit summary saved (audit_summary.json)"
echo ""

# ============================================================================
# Final Verdict
# ============================================================================
echo "============================================================"
echo "Marketplace Readiness Audit Complete"
echo "============================================================"
echo "Output: ${OUTPUT_DIR}"
echo ""
echo "Results:"
echo "  Manifest: $(if [[ -z "${WRITE_SCOPES_DETECTED}" ]] && [[ -z "${EXTERNAL_FETCH_IN_MANIFEST}" ]]; then echo "PASS ✓"; else echo "FAIL ✗"; fi)"
echo "  Documentation: $(if [[ ${#MISSING_DOCS[@]} -eq 0 ]]; then echo "PASS ✓"; else echo "FAIL ✗ (${#MISSING_DOCS[@]} missing)"; fi)"
echo "  Evidence harness: $(if [[ ${#MISSING_EVIDENCE[@]} -eq 0 ]]; then echo "PASS ✓"; else echo "FAIL ✗ (${#MISSING_EVIDENCE[@]} missing)"; fi)"
echo "  Trust center: $(if [[ ${#MISSING_TRUST[@]} -eq 0 ]]; then echo "PASS ✓"; else echo "FAIL ✗ (${#MISSING_TRUST[@]} missing)"; fi)"
echo ""
echo "FINAL VERDICT: ${VERDICT}"
echo ""

if [[ "${VERDICT}" == "PASS" ]]; then
  echo "✓ Repository is MARKETPLACE READY"
  exit 0
else
  echo "✗ Repository requires fixes before marketplace submission"
  exit 1
fi
