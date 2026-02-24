#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# run_prod_proof_pack_failclosed.sh
#
# Orchestrates all production proof runners (smoke, stability, nomutation)
# and generates a fail-closed, immutable evidence bundle with manifest and verifier.
# ============================================================================

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
readonly EVIDENCE_BASE="/tmp"
readonly EVIDENCE_PREFIX="ft_prod_proof_pack_"

# Utilities
utc_timestamp() {
  date -u +"%Y%m%dT%H%M%SZ"
}

log_info() {
  echo "[INFO] $*" >&2
}

log_error() {
  echo "[ERROR] $*" >&2
}

fail() {
  log_error "$*"
  exit 1
}

sha256_file() {
  sha256sum "$1" | awk '{print $1}'
}

# ============================================================================
# Setup: Create top-level evidence directory
# ============================================================================

RUN_TIMESTAMP=$(utc_timestamp)
PACK_DIR="${EVIDENCE_BASE}/${EVIDENCE_PREFIX}${RUN_TIMESTAMP}"

log_info "Creating proof pack directory: ${PACK_DIR}"
mkdir -p "${PACK_DIR}"

# Write runner metadata
{
  echo "${PACK_DIR}"
} > "${PACK_DIR}/RUN_DIR.txt"

{
  date -u +"%Y-%m-%dT%H:%M:%SZ"
} > "${PACK_DIR}/START_UTC.txt"

{
  git -C "${REPO_ROOT}" rev-parse HEAD
} > "${PACK_DIR}/GIT_HEAD.txt"

{
  git -C "${REPO_ROOT}" status --porcelain
} > "${PACK_DIR}/GIT_STATUS.txt"

if git -C "${REPO_ROOT}" diff-index --quiet HEAD --; then
  echo "false" > "${PACK_DIR}/GIT_DIRTY.txt"
else
  echo "true" > "${PACK_DIR}/GIT_DIRTY.txt"
fi

log_info "Runner metadata written to ${PACK_DIR}"

# ============================================================================
# Precondition validation
# ============================================================================

log_info "Validating preconditions..."

# Check runner scripts exist and are executable
for runner in \
  "e2e/scripts/run_prod_dashboard_smoke_failclosed.sh" \
  "e2e/scripts/run_prod_dashboard_stability_contract_failclosed.sh" \
  "e2e/scripts/run_prod_dashboard_network_nomutation_failclosed.sh"; do
  if [[ ! -f "${REPO_ROOT}/${runner}" ]]; then
    fail "Runner script missing: ${runner}"
  fi
  if [[ ! -x "${REPO_ROOT}/${runner}" ]]; then
    fail "Runner script not executable: ${runner}"
  fi
done

# Check allowlist policy exists
POLICY_FILE="${REPO_ROOT}/e2e/policy/prod_proof_allowlist.json"
if [[ ! -f "${POLICY_FILE}" ]]; then
  fail "Allowlist policy missing: ${POLICY_FILE}"
fi

# Check storage state exists
STORAGE_STATE="${REPO_ROOT}/e2e/.auth/storageState.json"
if [[ ! -f "${STORAGE_STATE}" ]]; then
  fail "Storage state missing: ${STORAGE_STATE}"
fi

log_info "All preconditions satisfied"

# ============================================================================
# Record storage state metadata (NOT contents)
# ============================================================================

log_info "Recording storage state metadata..."

# Bytes
{
  wc -c < "${STORAGE_STATE}"
} > "${PACK_DIR}/storageState.bytes.txt"

# SHA256
{
  sha256_file "${STORAGE_STATE}"
} > "${PACK_DIR}/storageState.sha256.txt"

# Shape (using Python to extract schema, not contents)
python3 << 'PYTHON_SHAPE' > "${PACK_DIR}/storageState.shape.txt" 2>&1 || echo "ERROR" > "${PACK_DIR}/storageState.shape.txt"
import json
import sys

try:
  with open('e2e/.auth/storageState.json', 'r') as f:
    data = json.load(f)
  
  shape = {
    'type': type(data).__name__,
    'has_cookies': 'cookies' in data and isinstance(data.get('cookies'), list),
    'has_origins': 'origins' in data and isinstance(data.get('origins'), list),
    'cookies_count': len(data.get('cookies', [])),
    'origins_count': len(data.get('origins', []))
  }
  
  print(json.dumps(shape, indent=2))
except Exception as e:
  print(f"ERROR: {e}")
PYTHON_SHAPE

log_info "Storage state metadata recorded"

# ============================================================================
# Run the three proof runners
# ============================================================================

log_info "Running proof runners..."

RUN_LOG="${PACK_DIR}/RUN_LOG.txt"
touch "${RUN_LOG}"

# Function to detect new evidence directories
detect_evidence_dir() {
  local pattern=$1
  local before_file=$2
  local after_file=$3
  
  # Get directories before
  find "${EVIDENCE_BASE}" -maxdepth 1 -type d -name "${pattern}" -printf '%f\n' 2>/dev/null | sort > "${before_file}" || touch "${before_file}"
  
  # Run the function caller's command (it will be done before this function is called)
  # Get directories after
  find "${EVIDENCE_BASE}" -maxdepth 1 -type d -name "${pattern}" -printf '%f\n' 2>/dev/null | sort > "${after_file}" || touch "${after_file}"
  
  # Find new directory
  local new_dir=$(comm -13 "${before_file}" "${after_file}" | tail -1)
  
  if [[ -z "${new_dir}" ]]; then
    return 1
  fi
  
  echo "${EVIDENCE_BASE}/${new_dir}"
  return 0
}

# Run smoke test with detection
log_info "Running smoke test..."
BEFORE_SMOKE=$(mktemp)
find "${EVIDENCE_BASE}" -maxdepth 1 -type d -name "ft_dashboard_smoke_*" -printf '%f\n' 2>/dev/null | sort > "${BEFORE_SMOKE}" || true

cd "${REPO_ROOT}"
if bash e2e/scripts/run_prod_dashboard_smoke_failclosed.sh 2>&1 | tee -a "${RUN_LOG}"; then
  SMOKE_EXIT=0
else
  SMOKE_EXIT=$?
fi

AFTER_SMOKE=$(mktemp)
find "${EVIDENCE_BASE}" -maxdepth 1 -type d -name "ft_dashboard_smoke_*" -printf '%f\n' 2>/dev/null | sort > "${AFTER_SMOKE}" || true
SMOKE_DIR=$(comm -13 "${BEFORE_SMOKE}" "${AFTER_SMOKE}" | tail -1)

if [[ -z "${SMOKE_DIR}" ]]; then
  fail "Could not detect smoke evidence directory"
fi

SMOKE_PATH="${EVIDENCE_BASE}/${SMOKE_DIR}"
echo "${SMOKE_PATH}" > "${PACK_DIR}/child_smoke_dir.txt"
log_info "Smoke evidence detected: ${SMOKE_PATH}"
rm -f "${BEFORE_SMOKE}" "${AFTER_SMOKE}"

# Run stability test with detection
log_info "Running stability contract test..."
BEFORE_STAB=$(mktemp)
find "${EVIDENCE_BASE}" -maxdepth 1 -type d -name "ft_dashboard_stability_*" -printf '%f\n' 2>/dev/null | sort > "${BEFORE_STAB}" || true

if bash e2e/scripts/run_prod_dashboard_stability_contract_failclosed.sh 2>&1 | tee -a "${RUN_LOG}"; then
  STAB_EXIT=0
else
  STAB_EXIT=$?
fi

AFTER_STAB=$(mktemp)
find "${EVIDENCE_BASE}" -maxdepth 1 -type d -name "ft_dashboard_stability_*" -printf '%f\n' 2>/dev/null | sort > "${AFTER_STAB}" || true
STAB_DIR=$(comm -13 "${BEFORE_STAB}" "${AFTER_STAB}" | tail -1)

if [[ -z "${STAB_DIR}" ]]; then
  fail "Could not detect stability evidence directory"
fi

STAB_PATH="${EVIDENCE_BASE}/${STAB_DIR}"
echo "${STAB_PATH}" > "${PACK_DIR}/child_stability_dir.txt"
log_info "Stability evidence detected: ${STAB_PATH}"
rm -f "${BEFORE_STAB}" "${AFTER_STAB}"

# Run nomutation test with detection
log_info "Running network non-mutation test..."
BEFORE_NOMU=$(mktemp)
find "${EVIDENCE_BASE}" -maxdepth 1 -type d -name "ft_dashboard_nomutation_*" -printf '%f\n' 2>/dev/null | sort > "${BEFORE_NOMU}" || true

if bash e2e/scripts/run_prod_dashboard_network_nomutation_failclosed.sh 2>&1 | tee -a "${RUN_LOG}"; then
  NOMU_EXIT=0
else
  NOMU_EXIT=$?
fi

AFTER_NOMU=$(mktemp)
find "${EVIDENCE_BASE}" -maxdepth 1 -type d -name "ft_dashboard_nomutation_*" -printf '%f\n' 2>/dev/null | sort > "${AFTER_NOMU}" || true
NOMU_DIR=$(comm -13 "${BEFORE_NOMU}" "${AFTER_NOMU}" | tail -1)

if [[ -z "${NOMU_DIR}" ]]; then
  fail "Could not detect nomutation evidence directory"
fi

NOMU_PATH="${EVIDENCE_BASE}/${NOMU_DIR}"
echo "${NOMU_PATH}" > "${PACK_DIR}/child_nomutation_dir.txt"
log_info "Nomutation evidence detected: ${NOMU_PATH}"
rm -f "${BEFORE_NOMU}" "${AFTER_NOMU}"

# Check if any runner failed
if [[ ${SMOKE_EXIT} -ne 0 ]] || [[ ${STAB_EXIT} -ne 0 ]] || [[ ${NOMU_EXIT} -ne 0 ]]; then
  fail "One or more proof runners failed (smoke=${SMOKE_EXIT}, stab=${STAB_EXIT}, nomu=${NOMU_EXIT})"
fi

log_info "All proof runners completed successfully"

# ============================================================================
# Copy evidence into pack directory (sanitized)
# ============================================================================

log_info "Copying and sanitizing evidence..."

mkdir -p "${PACK_DIR}/evidence/smoke" "${PACK_DIR}/evidence/stability" "${PACK_DIR}/evidence/nomutation"

# Function to copy evidence while filtering forbidden files
copy_evidence() {
  local source_dir=$1
  local dest_dir=$2
  local runner_name=$3
  
  if [[ ! -d "${source_dir}" ]]; then
    log_error "Source directory not found: ${source_dir}"
    return 1
  fi
  
  # Check for forbidden files first
  if find "${source_dir}" -type f \( -name "*storageState*.json" -o -name "*.har" -o -name "trace*.zip" \) | grep -q .; then
    echo "FORBIDDEN_FILE_FOUND" > "${PACK_DIR}/FORBIDDEN_FOUND.txt"
    log_error "Forbidden files found in ${runner_name} evidence"
    return 1
  fi
  
  # Copy allowed files
  find "${source_dir}" -type f \( -name "SUCCESS.txt" -o -name "FAIL.txt" -o -name "final_url.txt" -o -name "host.txt" -o -name "path.txt" -o -name "*.png" -o -name "*.json" -o -name "*.txt" \) | while read -r file; do
    # Skip any storageState files just to be safe
    if [[ "${file}" == *storageState* ]]; then
      continue
    fi
    local rel_path="${file#${source_dir}/}"
    local target="${dest_dir}/${rel_path}"
    mkdir -p "$(dirname "${target}")"
    cp "${file}" "${target}"
  done
  
  return 0
}

if ! copy_evidence "${SMOKE_PATH}" "${PACK_DIR}/evidence/smoke" "smoke"; then
  fail "Failed to sanitize smoke evidence"
fi

if ! copy_evidence "${STAB_PATH}" "${PACK_DIR}/evidence/stability" "stability"; then
  fail "Failed to sanitize stability evidence"
fi

if ! copy_evidence "${NOMU_PATH}" "${PACK_DIR}/evidence/nomutation" "nomutation"; then
  fail "Failed to sanitize nomutation evidence"
fi

log_info "Evidence copied and sanitized"

# ============================================================================
# Create MANIFEST.json
# ============================================================================

log_info "Creating manifest..."

# Compute allowlist hash
ALLOWLIST_HASH=$(sha256_file "${POLICY_FILE}")

# Build file list with hashes
FILE_LIST=$(mktemp)
find "${PACK_DIR}/evidence" -type f | sort | while read -r file; do
  rel_path="${file#${PACK_DIR}/}"
  file_hash=$(sha256_file "${file}")
  echo "    {\"sha256\": \"${file_hash}\", \"path\": \"${rel_path}\"}"
done > "${FILE_LIST}"

# Join file list
IFS= read -d '' FILE_JSON < <(paste -sd ',' "${FILE_LIST}" | head -c -1; echo) || FILE_JSON=""

MANIFEST_PATH="${PACK_DIR}/MANIFEST.json"

cat > "${MANIFEST_PATH}" << MANIFEST_EOF
{
  "version": 1,
  "created_utc": "$(cat ${PACK_DIR}/START_UTC.txt)",
  "git_head": "$(cat ${PACK_DIR}/GIT_HEAD.txt)",
  "allowlist_sha256": "${ALLOWLIST_HASH}",
  "storageState_sha256": "$(cat ${PACK_DIR}/storageState.sha256.txt)",
  "storageState_bytes": $(cat ${PACK_DIR}/storageState.bytes.txt),
  "files": [
$(if [[ -n "${FILE_JSON}" ]]; then echo "${FILE_JSON}" | sed 's/}$/},/g' | sed '$s/,$//' | sed 's/^/    /'; fi)
  ]
}
MANIFEST_EOF

rm -f "${FILE_LIST}"

# Create MANIFEST.sha256.txt
MANIFEST_HASH=$(sha256_file "${MANIFEST_PATH}")
echo "${MANIFEST_HASH}" > "${PACK_DIR}/MANIFEST.sha256.txt"

log_info "Manifest created with hash: ${MANIFEST_HASH}"

# ============================================================================
# Create VERIFY.sh
# ============================================================================

log_info "Creating verifier..."

VERIFY_PATH="${PACK_DIR}/VERIFY.sh"

cat > "${VERIFY_PATH}" << 'VERIFY_SCRIPT'
#!/bin/bash
set -euo pipefail

# OFFLINE VERIFIER FOR PROD PROOF PACK
# This script verifies the integrity of the evidence bundle.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MANIFEST_FILE="${SCRIPT_DIR}/MANIFEST.json"
MANIFEST_SHA="${SCRIPT_DIR}/MANIFEST.sha256.txt"

if [[ ! -f "${MANIFEST_FILE}" ]]; then
  echo "ERROR: MANIFEST.json not found" >&2
  exit 1
fi

if [[ ! -f "${MANIFEST_SHA}" ]]; then
  echo "ERROR: MANIFEST.sha256.txt not found" >&2
  exit 1
fi

echo "[VERIFY] Checking manifest integrity..."

# Verify manifest hash
MANIFEST_HASH=$(sha256sum "${MANIFEST_FILE}" | awk '{print $1}')
EXPECTED_HASH=$(cat "${MANIFEST_SHA}")

if [[ "${MANIFEST_HASH}" != "${EXPECTED_HASH}" ]]; then
  echo "ERROR: Manifest hash mismatch" >&2
  echo "  Expected: ${EXPECTED_HASH}" >&2
  echo "  Got: ${MANIFEST_HASH}" >&2
  exit 1
fi

echo "[VERIFY] Manifest hash verified: ${MANIFEST_HASH}"

# Extract and verify file hashes
echo "[VERIFY] Checking file hashes..."

# Use Python to parse JSON safely
python3 << 'PYTHON_VERIFY'
import json
import subprocess
import sys
import os

manifest_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'MANIFEST.json')

with open(manifest_file, 'r') as f:
  manifest = json.load(f)

fail_count = 0
for file_entry in manifest.get('files', []):
  expected_hash = file_entry['sha256']
  rel_path = file_entry['path']
  abs_path = os.path.join(os.path.dirname(manifest_file), rel_path)
  
  if not os.path.exists(abs_path):
    print(f"ERROR: File not found: {rel_path}", file=sys.stderr)
    fail_count += 1
    continue
  
  result = subprocess.run(['sha256sum', abs_path], capture_output=True, text=True)
  actual_hash = result.stdout.split()[0]
  
  if actual_hash != expected_hash:
    print(f"ERROR: Hash mismatch for {rel_path}", file=sys.stderr)
    print(f"  Expected: {expected_hash}", file=sys.stderr)
    print(f"  Got: {actual_hash}", file=sys.stderr)
    fail_count += 1
  else:
    print(f"[OK] {rel_path}")

if fail_count > 0:
  print(f"FAILED: {fail_count} file(s) failed verification", file=sys.stderr)
  sys.exit(1)
else:
  print("SUCCESS: All files verified")
PYTHON_VERIFY

echo "[VERIFY] All verifications passed"
exit 0
VERIFY_SCRIPT

chmod +x "${VERIFY_PATH}"
log_info "Verifier created"

# ============================================================================
# Create artifact.zip
# ============================================================================

log_info "Creating artifact bundle..."

cd "${PACK_DIR}"
zip -q -r artifact.zip \
  MANIFEST.json \
  MANIFEST.sha256.txt \
  VERIFY.sh \
  evidence/ \
  RUN_LOG.txt

log_info "Artifact bundle created: ${PACK_DIR}/artifact.zip"

# ============================================================================
# Success
# ============================================================================

echo "PASS" > "${PACK_DIR}/SUCCESS.txt"

log_info "Prod proof pack generation PASSED"
log_info "Pack directory: ${PACK_DIR}"
log_info "Artifact: ${PACK_DIR}/artifact.zip"

# Print output for parent scripts
echo "PROOF_PACK_DIR=${PACK_DIR}"
echo "PROOF_PACK_ZIP=${PACK_DIR}/artifact.zip"

exit 0
