#!/usr/bin/env bash
set -euo pipefail

# PHASE 7-8: PROVENANCE EVIDENCE CRYPTOGRAPHIC HASH PACK
# Hash ALL evidence artifacts and create proof pack
# Purpose: Cryptographic verification of evidence integrity

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/_common.sh
source "${SCRIPT_DIR}/_common.sh"

# ============================================================================
# CRYPTOGRAPHIC EVIDENCE PACK GENERATION
# ============================================================================

run_provenance_hash_pack() {
  local evidence_root="$1"

  log_info "PHASE 7-8: Cryptographic Evidence Hash Pack"

  # Create evidence pack directory
  local evidence_pack_dir="${evidence_root}/09_evidence_pack"
  mkdir -p "$evidence_pack_dir"

  local manifest_file="${evidence_pack_dir}/evidence_manifest.sha256"
  local manifest_json="${evidence_pack_dir}/evidence_manifest.json"
  local proof_pack_hash_file="${evidence_pack_dir}/proof_pack.sha256"

  log_info "Building comprehensive evidence manifest..."

  # Find all evidence files to hash
  local files_to_hash=()
  local manifest_entries='[]'

  # Phase 1-2: Raw API Evidence
  while IFS= read -r -d '' fstat_file; do
    files_to_hash+=("$fstat_file")
    local rel_path="${fstat_file#$evidence_root/}"
    local file_hash=$(sha256sum "$fstat_file" | cut -d' ' -f1)
    manifest_entries=$(echo "$manifest_entries" | jq \
      --arg file "$rel_path" \
      --arg hash "$file_hash" \
      '. += [{"file": $file, "sha256": $hash}]')
  done < <(find "${evidence_root}/01_raw_api" -type f -print0 2>/dev/null || true)

  # Phase 3: Pagination Evidence
  while IFS= read -r -d '' fstat_file; do
    files_to_hash+=("$fstat_file")
    local rel_path="${fstat_file#$evidence_root/}"
    local file_hash=$(sha256sum "$fstat_file" | cut -d' ' -f1)
    manifest_entries=$(echo "$manifest_entries" | jq \
      --arg file "$rel_path" \
      --arg hash "$file_hash" \
      '. += [{"file": $file, "sha256": $hash}]')
  done < <(find "${evidence_root}/02_pagination" -type f -print0 2>/dev/null || true)

  # Phase 4: Canonical API Evidence
  while IFS= read -r -d '' fstat_file; do
    files_to_hash+=("$fstat_file")
    local rel_path="${fstat_file#$evidence_root/}"
    local file_hash=$(sha256sum "$fstat_file" | cut -d' ' -f1)
    manifest_entries=$(echo "$manifest_entries" | jq \
      --arg file "$rel_path" \
      --arg hash "$file_hash" \
      '. += [{"file": $file, "sha256": $hash}]')
  done < <(find "${evidence_root}/03_canonical_api" -type f -print0 2>/dev/null || true)

  # Phase 5-6: Governance Snapshots and Validation
  while IFS= read -r -d '' fstat_file; do
    files_to_hash+=("$fstat_file")
    local rel_path="${fstat_file#$evidence_root/}"
    local file_hash=$(sha256sum "$fstat_file" | cut -d' ' -f1)
    manifest_entries=$(echo "$manifest_entries" | jq \
      --arg file "$rel_path" \
      --arg hash "$file_hash" \
      '. += [{"file": $file, "sha256": $hash}]')
  done < <(find "${evidence_root}/08_governance_snapshot/derived" "${evidence_root}/08_governance_snapshot/validation" -type f -print0 2>/dev/null || true)

  # Existing audit evidence
  for audit_dir in "00_meta" "02_docs_integrity" "02_parity" "03_scope_audit" "04_readonly_api_audit" "05_network" "07_blast_radius"; do
    while IFS= read -r -d '' fstat_file; do
      files_to_hash+=("$fstat_file")
      local rel_path="${fstat_file#$evidence_root/}"
      local file_hash=$(sha256sum "$fstat_file" | cut -d' ' -f1)
      manifest_entries=$(echo "$manifest_entries" | jq \
        --arg file "$rel_path" \
        --arg hash "$file_hash" \
        '. += [{"file": $file, "sha256": $hash}]')
    done < <(find "${evidence_root}/${audit_dir}" -type f -print0 2>/dev/null || true)
  done

  # Write manifest as JSON
  echo "$manifest_entries" | jq '.' > "$manifest_json"
  log_info "✓ Manifest JSON created with ${#files_to_hash[@]} entries"

  # Generate SHA256 for each file and write manifest file
  {
    for file_path in "${files_to_hash[@]}"; do
      sha256sum "$file_path" | sed "s|$evidence_root/||"
    done
  } > "$manifest_file"

  log_info "✓ Evidence manifest.sha256 created (${#files_to_hash[@]} files)"

  # PHASE 8: Compute proof pack hash
  log_info "PHASE 8: Computing proof pack hash..."

  # The proof pack hash is the hash of the manifest itself
  # This proves the manifest wasn't tampered with
  local manifest_sha=$(sha256sum "$manifest_file" | cut -d' ' -f1)
  echo "$manifest_sha" > "$proof_pack_hash_file"

  log_info "✓ Proof pack hash: $manifest_sha"

  # Verify all files hash correctly
  log_info "Verifying evidence hash integrity..."
  if sha256sum -c "$manifest_file" >/dev/null 2>&1; then
    local verified_count=$(sha256sum -c "$manifest_file" 2>/dev/null | grep -c ": OK" || echo "0")
    log_info "✓ All $verified_count files verified successfully"
    return 0
  else
    local failed_count=$(sha256sum -c "$manifest_file" 2>&1 | grep -c ": FAILED" || echo "0")
    log_error "✗ Hash verification failed for $failed_count files"
    return 1
  fi
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  if [[ $# -eq 1 ]]; then
    run_provenance_hash_pack "$1"
  else
    echo "Usage: $0 <evidence_root>"
    exit 1
  fi
fi
