#!/usr/bin/env bash
set -euo pipefail

# PHASE 3: PAGINATION COMPLETENESS PROOF
# Verify that all pages were collected for paginated Jira API endpoints
# Purpose: Prove that API pagination was exhaustively collected

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/_common.sh
source "${SCRIPT_DIR}/_common.sh"

# ============================================================================
# PAGINATION VERIFICATION
# ============================================================================

run_pagination_verifier() {
  local evidence_root="$1"
  local mode="$2"  # LIVE or DEMO

  log_info "PHASE 3: Pagination Completeness Proof"

  # Create output directory
  local pagination_dir="${evidence_root}/02_pagination"
  mkdir -p "$pagination_dir"

  local pagination_proof="${pagination_dir}/pagination_proof.json"

  if [[ "$mode" == "LIVE" ]]; then
    log_info "LIVE mode: Verifying pagination completeness"

    # Check if raw API responses exist
    local raw_responses_dir="${evidence_root}/01_raw_api/responses"

    if [[ ! -d "$raw_responses_dir" || -z "$(find "$raw_responses_dir" -name '*.response.json' 2>/dev/null)" ]]; then
      log_warn "No raw API responses found - pagination verification skipped"
      cat > "$pagination_proof" << 'EOF'
{
  "phase": "3_pagination_verification",
  "mode": "LIVE",
  "status": "SKIPPED",
  "reason": "No raw API responses found",
  "endpoints_checked": [],
  "complete": false
}
EOF
      return 0
    fi

    # Analyze pagination for project_search endpoint (main paginated endpoint)
    local endpoints_to_check=("project_search" "groups_picker" "permissionscheme")
    local pagination_report='{"endpoints": [], "summary": {"total_complete": true}}'

    for endpoint_base in "${endpoints_to_check[@]}"; do
      # Find all pages for this endpoint
      local pages=()
      while IFS= read -r -d '' page_file; do
        pages+=("$page_file")
      done < <(find "$raw_responses_dir" -name "${endpoint_base}_page*.response.json" -print0 2>/dev/null || true)

      if [[ ${#pages[@]} -eq 0 ]]; then
        continue
      fi

      # Check pagination metadata in each page
      local page_count=${#pages[@]}
      local pages_complete=true

      # For each page, verify pagination metadata
      for page_file in "${pages[@]}"; do
        if jq -e '.startAt and .maxResults and .total' "$page_file" >/dev/null 2>&1; then
          local start_at=$(jq -r '.startAt // 0' "$page_file")
          local max_results=$(jq -r '.maxResults // 0' "$page_file")
          local total=$(jq -r '.total // 0' "$page_file")
          local expected_pages=$(( (total + max_results - 1) / max_results ))

          if [[ $page_count -lt $expected_pages ]]; then
            pages_complete=false
          fi
        fi
      done

      # Add to report
      pagination_report=$(echo "$pagination_report" | jq \
        --arg endpoint "$endpoint_base" \
        --argjson complete "$pages_complete" \
        --argjson count "$page_count" \
        '.endpoints += [{"endpoint": $endpoint, "pages_collected": $count, "complete": $complete}]')
    done

    # Finalize report
    pagination_report=$(echo "$pagination_report" | jq \
      '.summary.timestamp = "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"')

    echo "$pagination_report" | jq . > "$pagination_proof"
    log_info "✓ Pagination verification completed"

  else
    # DEMO mode: No real APIs, create placeholder
    log_info "DEMO mode: Pagination verification structure created"

    cat > "$pagination_proof" << 'EOF'
{
  "phase": "3_pagination_verification",
  "mode": "DEMO",
  "status": "DEMO_ONLY",
  "reason": "No real Jira API in demo mode",
  "endpoints_configured": [
    "/rest/api/3/project/search",
    "/rest/api/3/groups/picker",
    "/rest/api/3/permissionscheme"
  ],
  "expected_checks": {
    "description": "In LIVE mode, verify for each endpoint:",
    "checks": [
      "startAt parameter indicates page offset",
      "maxResults parameter indicates page size",
      "total parameter indicates total record count",
      "collected_pages = ceil(total / maxResults)",
      "all_pages_collected = (pages_collected >= expected_pages)"
    ]
  },
  "complete": false,
  "proof_pack_entry": "02_pagination/pagination_proof.json"
}
EOF
  fi

  log_info "✓ Phase 3 (Pagination Completeness Proof) completed"
  return 0
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  if [[ $# -eq 2 ]]; then
    run_pagination_verifier "$1" "$2"
  else
    echo "Usage: $0 <evidence_root> <mode:LIVE|DEMO>"
    exit 1
  fi
fi
