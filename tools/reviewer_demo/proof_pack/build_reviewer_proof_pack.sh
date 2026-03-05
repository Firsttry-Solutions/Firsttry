#!/usr/bin/env bash
set -euo pipefail

# Build deterministic proof-pack metadata for an evidence directory.
# Usage:
#   ./build_reviewer_proof_pack.sh
#   ./build_reviewer_proof_pack.sh /path/to/existing/evidence_dir

RUN_ID="ft_reviewer_demo_$(date -u +%Y%m%dT%H%M%SZ)"
TARGET_DIR="${1:-}"

if [[ -n "${TARGET_DIR}" ]]; then
  EVIDENCE_DIR="${TARGET_DIR}"
  if [[ ! -d "${EVIDENCE_DIR}" ]]; then
    echo "ERROR: Target evidence directory does not exist: ${EVIDENCE_DIR}" >&2
    exit 2
  fi
else
  EVIDENCE_DIR="/tmp/${RUN_ID}"
  mkdir -p "${EVIDENCE_DIR}"
fi

MANIFEST_FILE="${EVIDENCE_DIR}/manifest.sha256"
PACK_HASH_FILE="${EVIDENCE_DIR}/PROOF_PACK_SHA256.txt"
README_FILE="${EVIDENCE_DIR}/PROOF_PACK_README.txt"

echo "============================================================"
echo "Reviewer Demo Proof Pack Builder"
echo "============================================================"
echo "Evidence dir: ${EVIDENCE_DIR}"
echo ""

cd "${EVIDENCE_DIR}"

cat > "${README_FILE}" <<EOF
Reviewer demo proof pack
- Created (UTC): $(date -u +%Y-%m-%dT%H:%M:%SZ)
- Evidence dir: ${EVIDENCE_DIR}
- Manifest: manifest.sha256
- Pack hash: PROOF_PACK_SHA256.txt = SHA256(manifest.sha256)
EOF

mapfile -d '' FILES < <(find . -type f \
  ! -name "manifest.sha256" \
  ! -name "PROOF_PACK_SHA256.txt" \
  -print0 | sort -z)

if [[ ${#FILES[@]} -eq 0 ]]; then
  echo "ERROR: No evidence files found in ${EVIDENCE_DIR}" >&2
  exit 1
fi

printf "" > "${MANIFEST_FILE}"
for f in "${FILES[@]}"; do
  sha256sum "${f}" >> "${MANIFEST_FILE}"
done

PACK_HASH="$(sha256sum "${MANIFEST_FILE}" | awk '{print $1}')"
printf "%s\n" "${PACK_HASH}" > "${PACK_HASH_FILE}"

echo "✓ Manifest: ${MANIFEST_FILE}"
echo "✓ Pack hash: ${PACK_HASH_FILE}"
echo "✓ Proof pack hash: ${PACK_HASH}"
echo ""
echo "${EVIDENCE_DIR}"
