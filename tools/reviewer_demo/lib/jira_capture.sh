#!/usr/bin/env bash
set -euo pipefail

# PHASE 1B: RAW JIRA PROVENANCE CAPTURE
# Capture full request/response evidence for every Jira REST call
# Purpose: Establish raw evidence trail for cryptographic verification
# CRITICAL: In LIVE mode, MUST emit real API responses, never mock
# Uses hardened pagination_harness for all paginated endpoints

# Source common utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/_common.sh
source "${SCRIPT_DIR}/_common.sh"
# shellcheck source=lib/pagination_harness.sh
source "${SCRIPT_DIR}/pagination_harness.sh"

# ============================================================================
# JIRA CAPTURE DISPATCHER (LIVE vs DEMO)
# ============================================================================

run_jira_capture() {
  local evidence_root="$1"
  local mode="$2"  # LIVE or DEMO (should be EFFECTIVE_MODE)

  # HARD RULE: In LIVE mode, ONLY call live capture functions
  # Never silently fall back to DEMO if LIVE is requested
  if [[ "$mode" == "LIVE" ]]; then
    log_info "PHASE 1B: Raw Jira Provenance Capture (LIVE MODE - REAL JIRA)"
    log_info "=============================================================="

    # Source LIVE capture libraries
    # shellcheck source=lib/jira_live_capture.sh
    source "${SCRIPT_DIR}/jira_live_capture.sh"

    # Validate LIVE environment before attempting any API calls
    if [[ -z "${JIRA_BASE_URL:-}" ]] || [[ -z "${JIRA_EMAIL:-}" ]] || [[ -z "${JIRA_API_TOKEN:-}" ]]; then
      log_error "[FATAL] LIVE mode requires JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN"
      return 1
    fi

    # Validate URL format (strict HTTPS check)
    if ! [[ "$JIRA_BASE_URL" =~ ^https://[a-z0-9][a-z0-9-]*[a-z0-9]\.atlassian\.net$ ]]; then
      log_error "[FATAL] JIRA_BASE_URL must be like: https://your-domain.atlassian.net"
      log_error "[FATAL] Received: $JIRA_BASE_URL"
      return 1
    fi

    # Create raw API directory for LIVE mode
    mkdir -p "${evidence_root}/01_raw_api"

    # Export evidence root for child functions
    export EVIDENCE_ROOT="$evidence_root"

    log_info "Connecting to Jira instance: $JIRA_BASE_URL"
    log_info "User: $JIRA_EMAIL"
    log_info ""

    # Call the LIVE capture validation function
    validate_live_environment || return 1

    # Capture essential endpoints (IN STRICT ORDER)
    log_info "Capturing real Jira governance endpoints..."
    log_info ""

    # 1. /rest/api/3/myself (current user context)
    log_info "  [1/5] Capturing current user context"
    if ! jira_api_get "/rest/api/3/myself" "myself" "$evidence_root"; then
      log_error "[FATAL] Failed to capture /rest/api/3/myself"
      return 1
    fi

    # 2. /rest/api/3/serverInfo (Jira instance info)
    log_info "  [2/5] Capturing server info"
    if ! jira_api_get "/rest/api/3/serverInfo" "serverInfo" "$evidence_root"; then
      log_error "[FATAL] Failed to capture /rest/api/3/serverInfo"
      return 1
    fi

    # 3. /rest/api/3/project/search (projects with HARDENED pagination)
    log_info "  [3/5] Capturing projects (with hardened pagination)"
    if ! jira_api_paginate_safe \
      "/rest/api/3/project/search?maxResults={limit}&startAt={start}" \
      "project_search" \
      "$evidence_root" \
      50 \
      100; then
      log_error "[FATAL] Failed to capture /rest/api/3/project/search"
      return 1
    fi

    # 4. /rest/api/3/permissionscheme (permission schemes)
    log_info "  [4/5] Capturing permission schemes"
    if ! jira_api_get "/rest/api/3/permissionscheme" "permissionschemes" "$evidence_root"; then
      log_error "[FATAL] Failed to capture /rest/api/3/permissionscheme"
      return 1
    fi

    # 5. /rest/api/3/groups/picker (groups list - endpoint-specific SAFE collector)
    log_info "  [5/5] Capturing groups (with endpoint-specific safe collector)"
    if ! jira_api_collect_groups_picker_safe "$evidence_root" 50 20; then
      log_error "[FATAL] Failed to capture /rest/api/3/groups/picker"
      return 1
    fi

    log_info ""
    log_info "✅ Raw Jira evidence captured successfully (LIVE MODE)"
    log_info ""

    # CRITICAL VERIFICATION: Ensure real files were created, not just metadata
    if [[ ! -f "${evidence_root}/01_raw_api/myself.response.json" ]]; then
      log_error "[FATAL] LIVE mode did not emit real API response files"
      log_error "[FATAL] Missing: 01_raw_api/myself.response.json"
      return 1
    fi

    # Verify response is actual JSON from Jira, not placeholder
    if ! jq -e 'has("self") and has("accountId")' "${evidence_root}/01_raw_api/myself.response.json" >/dev/null 2>&1; then
      log_error "[FATAL] myself.response.json is not valid Jira response"
      return 1
    fi

    log_info "Evidence manifest:"
    find "${evidence_root}/01_raw_api" -maxdepth 1 -name "*.response.json" -type f | sort | while read -r f; do
      local size
      size=$(wc -c < "$f")
      log_info "  - $(basename "$f") ($size bytes)"
    done

    return 0

  else
    # DEMO mode: Create minimal mock structure only
    log_info "PHASE 1B: Raw Jira Provenance Capture (DEMO MODE)"
    log_info "=================================================="
    log_info "Using mock evidence (no Jira API calls)"

    # Create minimal placeholder files for DEMO mode
    mkdir -p "${evidence_root}/01_raw_api"

    # Create a minimal DEMO metadata file
    cat > "${evidence_root}/01_raw_api/_demo_structure.json" << 'EOF'
{
  "mode": "DEMO",
  "note": "This is a demonstration run. Real Jira API evidence not captured.",
  "timestamp": "DEMO",
  "message": "Use LIVE mode with valid Jira credentials for real governance evidence"
}
EOF

    log_info "✓ DEMO mode: Mock structure created (no Jira connection)"
    return 0
  fi
}

# Entry point for direct execution
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  if [[ $# -eq 2 ]]; then
    run_jira_capture "$1" "$2"
  else
    echo "Usage: $0 <evidence_root> <mode:LIVE|DEMO>"
    exit 1
  fi
fi
