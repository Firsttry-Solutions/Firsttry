#!/usr/bin/env bash
set -euo pipefail

# Evidence Hash Pack Generation
# Creates cryptographic manifest of all evidence files for tamper-detection

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/_common.sh"

run_evidence_hash_pack() {
  local evidence_root="${1:-$EVIDENCE_ROOT}"

  log_info ""
  log_info "PHASE 4: Evidence Hash Pack Generation"
  log_info "======================================="

  mkdir -p "${evidence_root}/09_evidence_pack"

  local manifest_file="${evidence_root}/09_evidence_pack/evidence_manifest.sha256"
  local manifest_json="${evidence_root}/09_evidence_pack/evidence_manifest.json"
  local proof_pack_file="${evidence_root}/09_evidence_pack/PROOF_PACK_SHA256.txt"

  log_info "Building comprehensive evidence manifest..."

  # Find all evidence files (safe find with parentheses for -type f)
  local file_count=0
  local manifest_entries=()
  local tmp_manifest=$(mktemp)

  while IFS= read -r -d '' file; do
    # Get relative path from evidence root
    local rel_path="${file#$evidence_root/}"

    # Skip the evidence pack directory itself (avoid circular inclusion)
    if [[ "$rel_path" =~ ^09_evidence_pack/ ]]; then
      continue
    fi

    # Compute sha256
    local file_sha256
    file_sha256=$(sha256sum "$file" | awk '{print $1}')

    # Get file size
    local file_size
    file_size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null || echo "0")

    # Add to manifest
    echo "$file_sha256  $rel_path" >> "$tmp_manifest"

    # Add to JSON array
    manifest_entries+=("$(jq -n --arg path "$rel_path" --arg sha256 "$file_sha256" --arg size "$file_size" '{path: $path, sha256: $sha256, bytes: ($size | tonumber)}')")

    file_count=$((file_count + 1))
  done < <(find "$evidence_root" -type f \( -name "*.json" -o -name "*.txt" -o -name "*.md" -o -name "*.sha256" -o -name "*.log" -o -name "*.html" -o -name "*.png" \) -print0 2>/dev/null || true)

  if [[ $file_count -eq 0 ]]; then
    log_error "[FATAL] No evidence files found to hash (expected >= 10)"
    return 1
  fi

  log_info "✓ Manifest JSON created with $file_count entries"

  # Create manifest JSON
  local manifest_json_content
  manifest_json_content=$(jq -n \
    --argjson entries "$(printf '%s\n' "${manifest_entries[@]}" | jq -s .)" \
    --arg timestamp "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    --arg files_count "$file_count" \
    '{
      timestamp_utc: $timestamp,
      files_hashed: ($files_count | tonumber),
      entries: $entries
    }')

  echo "$manifest_json_content" | jq -S . > "$manifest_json"

  # Sort manifest and write sha256 file
  sort "$tmp_manifest" > "$manifest_file"

  log_info "✓ Evidence manifest.sha256 created ($file_count files)"

  # Compute proof pack hash (hash of the manifest itself)
  local proof_pack_hash
  proof_pack_hash=$(sha256sum "$manifest_file" | awk '{print $1}')

  echo "$proof_pack_hash" > "$proof_pack_file"

  log_info "✓ Proof pack hash: $proof_pack_hash"

  # Clean up
  rm -f "$tmp_manifest"

  log_info "✅ Evidence hash pack generated successfully"

  return 0
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  if [[ -z "${EVIDENCE_ROOT:-}" ]]; then
    echo "[FATAL] EVIDENCE_ROOT not set"
    exit 2
  fi
  run_evidence_hash_pack "$EVIDENCE_ROOT"
else
  :
fi
