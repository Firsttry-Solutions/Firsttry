#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <EVIDENCE_DIR>" >&2
  exit 2
fi

EVIDENCE_DIR="$1"
if [[ ! -d "${EVIDENCE_DIR}" ]]; then
  echo "ERROR: Evidence directory not found: ${EVIDENCE_DIR}" >&2
  exit 2
fi

MANIFEST_FILE="${EVIDENCE_DIR}/manifest.sha256"
PACK_HASH_FILE="${EVIDENCE_DIR}/PROOF_PACK_SHA256.txt"

if [[ ! -f "${MANIFEST_FILE}" ]]; then
  echo "ERROR: Missing required file: ${MANIFEST_FILE}" >&2
  exit 1
fi
if [[ ! -f "${PACK_HASH_FILE}" ]]; then
  echo "ERROR: Missing required file: ${PACK_HASH_FILE}" >&2
  exit 1
fi

echo "[VERIFY] sha256sum -c manifest.sha256"
(
  cd "${EVIDENCE_DIR}"
  sha256sum -c manifest.sha256
)

echo "[VERIFY] pack hash"
STORED_HASH="$(tr -d '[:space:]' < "${PACK_HASH_FILE}")"
COMPUTED_HASH="$(sha256sum "${MANIFEST_FILE}" | awk '{print $1}')"
if [[ "${STORED_HASH}" != "${COMPUTED_HASH}" ]]; then
  echo "ERROR: PROOF_PACK_SHA256 mismatch" >&2
  echo "  stored:   ${STORED_HASH}" >&2
  echo "  computed: ${COMPUTED_HASH}" >&2
  exit 1
fi

echo "[VERIFY] no extra/untracked files"
TMP_MANIFEST_LIST="$(mktemp)"
TMP_ACTUAL_LIST="$(mktemp)"
trap 'rm -f "${TMP_MANIFEST_LIST}" "${TMP_ACTUAL_LIST}"' EXIT

awk '{print $2}' "${MANIFEST_FILE}" | sed 's|^\./||' | sort > "${TMP_MANIFEST_LIST}"
(
  cd "${EVIDENCE_DIR}"
  find . -type f \
    ! -name "manifest.sha256" \
    ! -name "PROOF_PACK_SHA256.txt" \
    -print | sed 's|^\./||' | sort > "${TMP_ACTUAL_LIST}"
)

if ! diff -u "${TMP_MANIFEST_LIST}" "${TMP_ACTUAL_LIST}" >/dev/null; then
  echo "ERROR: Extra/missing files detected vs manifest" >&2
  diff -u "${TMP_MANIFEST_LIST}" "${TMP_ACTUAL_LIST}" || true
  exit 1
fi

echo "VERIFICATION PASSED"
