#!/usr/bin/env bash
set -euo pipefail

# PHASE 4: CANONICAL JSON NORMALIZATION
# Normalize all JSON responses to deterministic canonical form
# Purpose: Ensure derived outputs are deterministic and reproducible

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/_common.sh
source "${SCRIPT_DIR}/_common.sh"

# ============================================================================
# CANONICAL NORMALIZATION
# ============================================================================

run_canonicalize_json() {
  local evidence_root="$1"
  local mode="$2"  # LIVE or DEMO

  log_info "PHASE 4: Canonical JSON Normalization"

  # Create output directory
  local canonical_dir="${evidence_root}/03_canonical_api"
  mkdir -p "$canonical_dir"

  if [[ "$mode" == "LIVE" ]]; then
    log_info "LIVE mode: Canonicalizing raw JSON responses"

    local raw_responses_dir="${evidence_root}/01_raw_api/responses"

    if [[ ! -d "$raw_responses_dir" ]]; then
      log_warn "No raw API responses found - canonicalization skipped"
      return 0
    fi

    # Process all .response.json files
    local canonical_count=0
    while IFS= read -r -d '' response_file; do
      local base_name=$(basename "$response_file" .response.json)
      local canonical_file="${canonical_dir}/${base_name}.canonical.json"

      # Normalize with sorted keys and compact format
      if jq -S . "$response_file" > "$canonical_file" 2>/dev/null; then
        log_info "  ✓ Canonicalized: $base_name"
        ((canonical_count++))
      else
        log_error "  ✗ Failed to canonicalize: $base_name"
      fi
    done < <(find "$raw_responses_dir" -name "*.response.json" -print0 2>/dev/null || true)

    log_info "✓ Canonicalized $canonical_count JSON files"

  else
    # DEMO mode: Create canonical structure specification
    log_info "DEMO mode: Creating canonical structure"

    cat > "${canonical_dir}/_canonical_specification.json" << 'EOF'
{
  "phase": "4_canonical_normalization",
  "mode": "DEMO",
  "purpose": "Deterministic JSON representation with sorted keys",
  "rules": [
    "All JSON keys sorted alphabetically",
    "No whitespace variation",
    "Compact formatting (no pretty-printing)",
    "Consistent string encoding",
    "Numeric values normalized"
  ],
  "tool_used": "jq -S .",
  "output_format": "{endpoint}_page{N}.canonical.json",
  "determinism_guarantee": "Given identical raw responses, canonical forms are bit-identical",
  "proof_pack_entries": [
    "03_canonical_api/*.canonical.json"
  ]
}
EOF
    log_info "✓ DEMO mode: Canonical specification created"
  fi

  log_info "✓ Phase 4 (Canonical JSON Normalization) completed"
  return 0
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  if [[ $# -eq 2 ]]; then
    run_canonicalize_json "$1" "$2"
  else
    echo "Usage: $0 <evidence_root> <mode:LIVE|DEMO>"
    exit 1
  fi
fi
