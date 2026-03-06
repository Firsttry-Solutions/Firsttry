#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
CANON_BASE="${SCRIPT_DIR}/proof_pack"

# Fail-closed assertion that canonical proof pack scripts exist and are executable
REQUIRED_SCRIPTS=(
  "build_reviewer_proof_pack.sh"
  "verify_reviewer_proof_pack.sh"
)

for script in "${REQUIRED_SCRIPTS[@]}"; do
  script_path="${CANON_BASE}/${script}"
  if [[ ! -f "${script_path}" ]]; then
    echo "ERROR: Missing canonical proof pack script: ${script_path}" >&2
    exit 1
  fi
  if [[ ! -x "${script_path}" ]]; then
    echo "ERROR: Canonical proof pack script not executable: ${script_path}" >&2
    exit 1
  fi
done

# Search for duplicate proof pack scripts outside canonical location
echo "Checking for duplicate proof pack scripts..."
for script_name in "build_reviewer_proof_pack.sh" "verify_reviewer_proof_pack.sh"; do
  duplicates=$(find "${REPO_ROOT}" -name "${script_name}" -not -path "${CANON_BASE}/*" -type f 2>/dev/null || true)
  if [[ -n "${duplicates}" ]]; then
    echo "ERROR: Duplicate proof pack script found outside canonical location:" >&2
    echo "${duplicates}" >&2
    echo "Only tools/reviewer_demo/proof_pack/${script_name} should exist." >&2
    exit 1
  fi
done

echo "Canonical proof pack scripts verified; no duplicates found."
