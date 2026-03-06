#!/usr/bin/env bash
set -euo pipefail

# Source common utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/_common.sh
source "${SCRIPT_DIR}/_common.sh"

# Forbidden Forge scopes that indicate write/admin access
FORBIDDEN_SCOPES=(
  "write:"
  "delete:"
  "manage:"
  "admin:"
)

run_scope_audit() {
  local evidence_root="$1"
  local repo_root="$2"
  local app_root="$3"
  local manifest_path="$4"
  local audit_dir="${evidence_root}/03_scope_audit"

  log_info "Starting Forge manifest scope audit..."
  mkdir -p "$audit_dir"

  # Use vendor manifest ONLY (canonical app)
  if [[ ! -f "$manifest_path" ]]; then
    log_error "Manifest not found at: $manifest_path"

    # Generate failure report for missing manifests
    cat > "${audit_dir}/scope_audit.json" << EOF
{
  "timestamp": "$(create_timestamp)",
  "status": "FAIL",
  "manifests_scanned": 0,
  "total_scopes": 0,
  "violations": 1,
  "error": "Forge manifest.yml not found at expected location",
  "manifest_path": "$manifest_path",
  "app_root": "$app_root",
  "forbidden_scopes": $(printf '%s\n' "${FORBIDDEN_SCOPES[@]}" | jq -R . | jq -s .),
  "all_scopes": [],
  "violations_details": ["Manifest file missing"]
}
EOF

    return 1
  fi

  log_info "Analyzing manifest (VENDOR APP ONLY): $manifest_path"

  local violations=()
  local all_scopes=()

  # Extract scopes using node to parse YAML safely
  local scopes_json
  scopes_json=$(node -e "
    const fs = require('fs');
    const content = fs.readFileSync('$manifest_path', 'utf8');

    // Simple YAML parsing for scopes
    const lines = content.split('\n');
    const scopes = [];
    let inPermissions = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === 'permissions:') {
        inPermissions = true;
        continue;
      }
      if (inPermissions && trimmed.startsWith('- ')) {
        const scope = trimmed.substring(2).trim();
        scopes.push(scope);
      } else if (inPermissions && !line.startsWith(' ') && !line.startsWith('\t') && trimmed !== '') {
        inPermissions = false;
      }
    }

    console.log(JSON.stringify(scopes));
  " 2>/dev/null || echo '[]')

  # Parse scopes and check for violations
  local manifest_scopes
  manifest_scopes=$(echo "$scopes_json" | jq -r '.[]' 2>/dev/null || true)

  if [[ -n "$manifest_scopes" ]]; then
    while IFS= read -r scope; do
      [[ -z "$scope" ]] && continue
      all_scopes+=("$scope")

      # Check against forbidden patterns
      for forbidden in "${FORBIDDEN_SCOPES[@]}"; do
        if [[ "$scope" == *"$forbidden"* ]]; then
          violations+=("$scope")
        fi
      done
    done <<< "$manifest_scopes"
  fi

  # Copy manifest to evidence
  cp "$manifest_path" "${audit_dir}/manifest.yml" 2>/dev/null || true

  # Generate scope audit report
  local status="PASS"
  if [[ ${#violations[@]} -gt 0 ]]; then
    status="FAIL"
  fi

  cat > "${audit_dir}/scope_audit.json" << EOF
{
  "timestamp": "$(create_timestamp)",
  "status": "$status",
  "manifests_scanned": 1,
  "total_scopes": ${#all_scopes[@]},
  "violations": ${#violations[@]},
  "forbidden_scopes": $(printf '%s\n' "${FORBIDDEN_SCOPES[@]}" | jq -R . | jq -s .),
  "all_scopes": $(printf '%s\n' "${all_scopes[@]}" | jq -R . | jq -s .),
  "violations_details": $(printf '%s\n' "${violations[@]}" | jq -R . | jq -s .)
}
EOF

  if [[ $status == "FAIL" ]]; then
    log_error "Scope audit FAILED - forbidden scopes detected:"
    for violation in "${violations[@]}"; do
      log_error "  $violation"
    done
    return 1
  fi

  log_success "Scope audit passed - no forbidden scopes found"
  return 0
}
