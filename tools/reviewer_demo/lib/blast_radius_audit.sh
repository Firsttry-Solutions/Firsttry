#!/usr/bin/env bash
set -euo pipefail

# Source common utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/_common.sh
source "${SCRIPT_DIR}/_common.sh"

run_blast_radius_audit() {
  local evidence_root="$1"
  local repo_root="$2"
  local audit_dir="${evidence_root}/07_blast_radius"

  log_info "Starting blast radius audit..."
  mkdir -p "$audit_dir"

  # Source other audit results
  local scope_audit_file="${evidence_root}/03_scope_audit/scope_audit.json"
  local readonly_audit_file="${evidence_root}/04_readonly_api_audit/readonly_requestjira_index.json"
  local network_audit_file="${evidence_root}/05_network/static_network_audit.json"

  # Initialize counters
  local declared_scopes=0
  local forbidden_scopes_found=0
  local mutation_scopes_detected=0
  local get_calls=0
  local post_calls=0
  local put_calls=0
  local delete_calls=0
  local mutation_endpoints_detected=0
  local external_domains=0
  local conclusion="READ_ONLY"

  # Parse scope audit results if available
  if [[ -f "$scope_audit_file" ]]; then
    if grep -q '"status":\s*"FAIL"' "$scope_audit_file" 2>/dev/null; then
      forbidden_scopes_found=1
      mutation_scopes_detected=1
      conclusion="MUTATION_DETECTED"
    fi
    declared_scopes=$(grep -o '"total_scopes":\s*[0-9]*' "$scope_audit_file" 2>/dev/null | grep -o '[0-9]*' || echo "0")
  fi

  # Parse readonly API audit results if available
  if [[ -f "$readonly_audit_file" ]]; then
    # Count violations (any violations indicate mutation calls were found)
    local violations_count
    violations_count=$(grep -o '"violations":\s*[0-9]*' "$readonly_audit_file" 2>/dev/null | grep -o '[0-9]*' || echo "0")
    local total_calls
    total_calls=$(grep -o '"requestjira_calls_found":\s*[0-9]*' "$readonly_audit_file" 2>/dev/null | grep -o '[0-9]*' || echo "0")

    get_calls=$((total_calls - violations_count))  # Assume non-violations are GET calls

    if [[ $violations_count -gt 0 ]]; then
      mutation_endpoints_detected=1
      post_calls=$violations_count  # Simplification: violations are mutation calls
      conclusion="MUTATION_DETECTED"
    fi
  fi

  # Parse network audit results if available
  if [[ -f "$network_audit_file" ]]; then
    if grep -q '"pass":\s*false' "$network_audit_file" 2>/dev/null; then
      external_domains=1
    fi
  fi

  # Determine final conclusion
  if [[ $forbidden_scopes_found -gt 0 || $mutation_endpoints_detected -gt 0 ]]; then
    conclusion="MUTATION_DETECTED"
  fi

  # Generate blast radius report without jq dependency
  cat > "${audit_dir}/blast_radius_report.json" << EOF
{
  "timestamp": "$(create_timestamp)",
  "declared_scopes": $declared_scopes,
  "forbidden_scopes_found": $forbidden_scopes_found,
  "mutation_scopes_detected": $mutation_scopes_detected,
  "GET_calls": $get_calls,
  "POST_calls": $post_calls,
  "PUT_calls": $put_calls,
  "DELETE_calls": $delete_calls,
  "mutation_endpoints_detected": $mutation_endpoints_detected,
  "external_domains": $external_domains,
  "conclusion": "$conclusion",
  "pass": $([ "$conclusion" = "READ_ONLY" ] && echo "true" || echo "false")
}
EOF

  if [[ "$conclusion" != "READ_ONLY" ]]; then
    log_error "BLAST RADIUS AUDIT FAILED: Mutation detected"
    return 1
  fi

  log_info "Blast radius audit completed: $conclusion"
  return 0
}