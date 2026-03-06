#!/usr/bin/env bash
set -euo pipefail

# LIVE Canonical JSON Processing Wrapper
# Ensures deterministic JSON with sorted keys for hashing

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/_common.sh"

canonicalize_json_file() {
  local input_file="$1"
  local output_file="$2"

  if [[ ! -f "$input_file" ]]; then
    log_error "Input file not found: $input_file"
    return 1
  fi

  # Validate input is JSON
  if ! jq -e . "$input_file" >/dev/null 2>&1; then
    log_error "Input file is not valid JSON: $input_file"
    return 1
  fi

  # Canonical JSON with sorted keys
  jq -S . "$input_file" > "$output_file" 2>/dev/null || {
    log_error "Failed to canonicalize: $input_file"
    return 1
  }

  # Validate output is valid JSON
  if ! jq -e . "$output_file" >/dev/null 2>&1; then
    log_error "Canonicalized output is not valid JSON: $output_file"
    return 1
  fi

  # Compute sha256 of canonical output
  local sha256
  sha256=$(sha256sum "$output_file" | awk '{print $1}')

  log_info "✓ Canonicalized: $(basename "$input_file") → $(basename "$output_file") (sha256: $sha256)"

  return 0
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  echo "[ERROR] This library must be sourced, not executed"
  exit 1
fi
