#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <EVIDENCE_DIR>" >&2
  exit 2
fi

EVID="$1"
if [[ ! -d "${EVID}" ]]; then
  echo "ERROR: Evidence directory not found: ${EVID}" >&2
  exit 2
fi

require_file() {
  local path="$1"
  if [[ ! -f "${path}" ]]; then
    echo "ERROR: Missing required file: ${path}" >&2
    exit 1
  fi
}

require_file "${EVID}/FINAL_VERDICT.txt"
require_file "${EVID}/METADATA.json"
require_file "${EVID}/no_egress_report.txt"

VERIFY_TARGET="${EVID}"
if [[ -f "${EVID}/manifest.sha256" && -f "${EVID}/PROOF_PACK_SHA256.txt" ]]; then
  VERIFY_TARGET="${EVID}"
elif [[ -f "${EVID}/proof_pack/manifest.sha256" && -f "${EVID}/proof_pack/PROOF_PACK_SHA256.txt" ]]; then
  VERIFY_TARGET="${EVID}/proof_pack"
else
  echo "ERROR: Missing manifest/proof hash files in ${EVID} or ${EVID}/proof_pack" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROOF_VERIFY="${SCRIPT_DIR}/proof_pack/verify_reviewer_proof_pack.sh"
if [[ ! -x "${PROOF_VERIFY}" ]]; then
  echo "ERROR: Missing executable proof verifier: ${PROOF_VERIFY}" >&2
  exit 2
fi

bash "${PROOF_VERIFY}" "${VERIFY_TARGET}"

if ! grep -q "^PASS NO_EGRESS$" "${EVID}/no_egress_report.txt"; then
  echo "ERROR: no_egress_report.txt does not contain required PASS marker" >&2
  exit 1
fi

if ! grep -q '^PASS$' "${EVID}/FINAL_VERDICT.txt"; then
  echo "ERROR: FINAL_VERDICT.txt does not contain PASS" >&2
  exit 1
fi

echo "VERIFICATION PASSED"
