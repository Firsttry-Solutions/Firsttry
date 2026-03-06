#!/usr/bin/env bash
set -euo pipefail

# Source common utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/_common.sh
source "${SCRIPT_DIR}/_common.sh"

run_determinism_check() {
  local evidence_root="$1"
  local repo_root="$2"
  local audit_dir="${evidence_root}/09_determinism_check"

  log_info "Starting determinism verification..."
  mkdir -p "$audit_dir"

  local proof_builder="${repo_root}/tools/reviewer_demo/proof_pack/build_reviewer_proof_pack.sh"

  if [[ ! -x "$proof_builder" ]]; then
    fail "Proof pack builder not found or not executable: $proof_builder"
  fi

  # Create temporary directories for two builds
  local build1_dir="${audit_dir}/build1"
  local build2_dir="${audit_dir}/build2"
  mkdir -p "$build1_dir" "$build2_dir"

  log_info "Running first proof pack build..."
  local build1_output="${audit_dir}/build1.log"
  if ! (cd "$repo_root" && "$proof_builder" "$build1_dir" 2>&1 | tee "$build1_output"); then
    fail "First proof pack build failed"
  fi

  # Wait a moment to ensure different timestamps if they're included
  sleep 2

  log_info "Running second proof pack build..."
  local build2_output="${audit_dir}/build2.log"
  if ! (cd "$repo_root" && "$proof_builder" "$build2_dir" 2>&1 | tee "$build2_output"); then
    fail "Second proof pack build failed"
  fi

  # Compare critical files
  local comparison_results=()
  local differences_found=false

  # Files that must be identical for determinism
  local critical_files=(
    "manifest.sha256"
    "PROOF_PACK_SHA256.txt"
    "summary.json"
  )

  for file in "${critical_files[@]}"; do
    local file1="${build1_dir}/$file"
    local file2="${build2_dir}/$file"

    if [[ -f "$file1" && -f "$file2" ]]; then
      if diff -q "$file1" "$file2" >/dev/null; then
        comparison_results+=("$file: IDENTICAL")
        log_info "✓ $file is deterministic"
      else
        comparison_results+=("$file: DIFFERENT")
        differences_found=true
        log_error "✗ $file differs between builds"

        # Save detailed diff
        diff "$file1" "$file2" > "${audit_dir}/${file}.diff" 2>&1 || true
      fi
    elif [[ -f "$file1" ]]; then
      comparison_results+=("$file: MISSING_IN_BUILD2")
      differences_found=true
      log_error "✗ $file missing in second build"
    elif [[ -f "$file2" ]]; then
      comparison_results+=("$file: MISSING_IN_BUILD1")
      differences_found=true
      log_error "✗ $file missing in first build"
    else
      comparison_results+=("$file: MISSING_IN_BOTH")
      differences_found=true
      log_error "✗ $file missing in both builds"
    fi
  done

  # Compare file hashes as additional check
  local hash_comparison=""
  if [[ -f "${build1_dir}/manifest.sha256" && -f "${build2_dir}/manifest.sha256" ]]; then
    local hash1
    local hash2
    hash1=$(sha256sum "${build1_dir}/manifest.sha256" | cut -d' ' -f1)
    hash2=$(sha256sum "${build2_dir}/manifest.sha256" | cut -d' ' -f1)

    if [[ "$hash1" == "$hash2" ]]; then
      hash_comparison="IDENTICAL"
    else
      hash_comparison="DIFFERENT"
      differences_found=true
    fi
  else
    hash_comparison="UNAVAILABLE"
  fi

  # Generate determinism report
  local status="PASS"
  if [[ $differences_found == true ]]; then
    status="FAIL"
  fi

  cat > "${audit_dir}/determinism_report.json" << EOF
{
  "timestamp": "$(create_timestamp)",
  "status": "$status",
  "build1_timestamp": "$(stat -c %Y "$build1_dir" 2>/dev/null || echo 0)",
  "build2_timestamp": "$(stat -c %Y "$build2_dir" 2>/dev/null || echo 0)",
  "files_compared": ${#critical_files[@]},
  "differences_found": $differences_found,
  "hash_comparison": "$hash_comparison",
  "comparison_results": $(printf '%s\n' "${comparison_results[@]}" | jq -R . | jq -s .),
  "critical_files": $(printf '%s\n' "${critical_files[@]}" | jq -R . | jq -s .)
}
EOF

  # Copy successful build artifacts to evidence (prefer build1)
  if [[ -d "$build1_dir" ]]; then
    cp -r "$build1_dir"/* "$audit_dir/" 2>/dev/null || true
  fi

  if [[ $status == "FAIL" ]]; then
    log_error "Determinism check FAILED - builds are not reproducible"
    return 1
  fi

  log_success "Determinism check passed - proof pack builds are reproducible"
  return 0
}