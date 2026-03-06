#!/usr/bin/env bash
set -euo pipefail

# Source common utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/_common.sh
source "${SCRIPT_DIR}/_common.sh"

run_uninstall_audit() {
  local evidence_root="$1"
  local repo_root="$2"
  local audit_dir="${evidence_root}/09_uninstall"

  log_info "Starting uninstall audit..."
  mkdir -p "$audit_dir"

  local uninstall_success="false"
  local environment="development"
  local jira_site_domain="unknown"

  # Extract Jira site domain from environment if available
  if [[ -n "${JIRA_BASE_URL:-}" ]]; then
    jira_site_domain=$(extract_domain "$JIRA_BASE_URL")
  fi

  log_info "Attempting forge uninstall from development environment..."

  # Run forge uninstall and capture output
  if forge uninstall -e development > "${audit_dir}/uninstall.log" 2>&1; then
    uninstall_success="true"
    log_info "Forge uninstall completed successfully"
  else
    local exit_code=$?
    log_error "Forge uninstall failed with exit code: $exit_code"
    echo "Exit code: $exit_code" >> "${audit_dir}/uninstall.log"

    # Check if it's because app wasn't installed
    if grep -q "not installed\|already uninstalled\|No app found" "${audit_dir}/uninstall.log" 2>/dev/null; then
      log_warn "App appears to not be installed - treating as success"
      uninstall_success="true"
    fi
  fi

  # Generate uninstall status report without jq dependency
  cat > "${audit_dir}/uninstall_status.json" << EOF
{
  "timestamp": "$(create_timestamp)",
  "uninstall_success": $uninstall_success,
  "environment": "$environment",
  "jira_site_domain_only": "$jira_site_domain",
  "forge_version": "$(forge --version 2>/dev/null | head -n1 || echo 'unknown')"
}
EOF

  if [[ "$uninstall_success" != "true" ]]; then
    fail "Uninstall audit failed - could not uninstall application"
  fi

  log_info "Uninstall audit completed successfully"
}