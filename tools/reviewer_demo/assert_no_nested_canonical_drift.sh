#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
NESTED_BASE="${REPO_ROOT}/FirstTry---Audit-Evidence-for-Jira/tools/reviewer_e2e/proof_pack"
CANON_BASE="${SCRIPT_DIR}/proof_pack"

if [[ ! -d "${NESTED_BASE}" ]]; then
  echo "Nested proof-pack copy not present; drift check skipped."
  exit 0
fi

FILES=(
  "build_reviewer_proof_pack.sh"
  "verify_reviewer_proof_pack.sh"
  "lib/sha256_manifest.sh"
  "lib/canonical_json.py"
)

for rel in "${FILES[@]}"; do
  if [[ ! -f "${CANON_BASE}/${rel}" ]]; then
    echo "ERROR: Missing canonical file: ${CANON_BASE}/${rel}" >&2
    exit 1
  fi
  if [[ ! -f "${NESTED_BASE}/${rel}" ]]; then
    echo "ERROR: Missing nested file for drift comparison: ${NESTED_BASE}/${rel}" >&2
    exit 1
  fi
  if ! diff -q "${CANON_BASE}/${rel}" "${NESTED_BASE}/${rel}" >/dev/null; then
    echo "ERROR: Drift detected for ${rel}" >&2
    exit 1
  fi
done

echo "No canonical drift detected vs nested mirror."
