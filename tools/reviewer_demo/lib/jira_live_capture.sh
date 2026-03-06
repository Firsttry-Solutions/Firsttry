#!/usr/bin/env bash
set -euo pipefail

# FirstTry LIVE Jira API Capture Library
# Provides functions for capturing raw Jira REST API evidence with full provenance
# Uses hardened pagination_harness for all pagination operations (fail-closed)

# Source common utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/_common.sh"
source "${SCRIPT_DIR}/pagination_harness.sh"

# ============================================================================
# ENVIRONMENT VALIDATION
# ============================================================================

require_env_live() {
  local var_name="$1"
  local var_value="${!var_name:-}"

  if [[ -z "$var_value" ]]; then
    log_error "[FATAL] Required LIVE mode environment variable missing: $var_name"
    exit 2
  fi
}

validate_live_environment() {
  log_info "Validating LIVE mode environment..."

  # Check EFFECTIVE_MODE is LIVE (single source of truth)
  if [[ "${EFFECTIVE_MODE:-}" != "LIVE" ]]; then
    log_error "[FATAL] EFFECTIVE_MODE must be 'LIVE' for LIVE Jira capture"
    exit 2
  fi

  # Forbid mixing OFFLINE_OK with LIVE mode
  if [[ "${OFFLINE_OK:-0}" == "1" ]] && [[ "${EFFECTIVE_MODE}" == "LIVE" ]]; then
    log_error "[FATAL] Cannot mix OFFLINE_OK=1 with EFFECTIVE_MODE=LIVE. These are mutually exclusive."
    exit 2
  fi

  # Require Jira credentials
  require_env_live "JIRA_BASE_URL"
  require_env_live "JIRA_EMAIL"
  require_env_live "JIRA_API_TOKEN"

  # Validate URL format (must be https://*.atlassian.net, no trailing slash)
  if ! [[ "$JIRA_BASE_URL" =~ ^https://[^/]+\.atlassian\.net$ ]]; then
    log_error "[FATAL] JIRA_BASE_URL must match format: https://instance.atlassian.net (no trailing slash)"
    exit 2
  fi

  log_info "✓ LIVE mode environment validated"
}

# ============================================================================
# JIRA API CALL FUNCTION
# ============================================================================

jira_api_get() {
  local path="$1"
  local outfile_prefix="$2"
  local evidence_root="${3:-$EVIDENCE_ROOT}"

  if [[ -z "$path" ]] || [[ -z "$outfile_prefix" ]]; then
    log_error "jira_api_get: path and outfile_prefix required"
    return 1
  fi

  # Construct URL
  local url="${JIRA_BASE_URL}${path}"

  # Output files
  local request_file="${evidence_root}/01_raw_api/${outfile_prefix}.request.json"
  local headers_file="${evidence_root}/01_raw_api/${outfile_prefix}.response.headers.txt"
  local body_file="${evidence_root}/01_raw_api/${outfile_prefix}.response.json"
  local sha256_file="${evidence_root}/01_raw_api/${outfile_prefix}.response.sha256"

  # Ensure directory exists
  mkdir -p "$(dirname "$request_file")"

  # Record request metadata
  local request_timestamp
  request_timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)

  cat > "$request_file" << REQUEST_JSON
{
  "method": "GET",
  "url": "$url",
  "path": "$path",
  "timestamp_utc": "$request_timestamp",
  "auth_mode": "basic_api_token",
  "headers": {
    "Accept": "application/json",
    "Content-Type": "application/json",
    "User-Agent": "FirstTry-Evidence-Collector/1.0"
  }
}
REQUEST_JSON

  # Make the curl request
  local curl_exit_code=0
  local http_status=0

  http_status=$(curl -sS \
    -D "$headers_file" \
    -o "$body_file" \
    -u "${JIRA_EMAIL}:${JIRA_API_TOKEN}" \
    -H "Accept: application/json" \
    -H "Content-Type: application/json" \
    -H "User-Agent: FirstTry-Evidence-Collector/1.0" \
    --retry 3 \
    --retry-delay 1 \
    --connect-timeout 15 \
    --max-time 60 \
    -w "%{http_code}" \
    "$url") || curl_exit_code=$?

  # Extract status from header if http_status is empty
  if [[ -z "$http_status" ]]; then
    http_status=$(head -1 "$headers_file" | grep -o '[0-9][0-9][0-9]' | head -1)
  fi

  log_info "  ✓ $path (HTTP $http_status)"

  # Fail if curl failed
  if [[ $curl_exit_code -ne 0 ]]; then
    log_error "[FATAL] curl failed with exit code $curl_exit_code for $path"
    exit 2
  fi

  # Fail if HTTP status is not 200
  if [[ "$http_status" != "200" ]]; then
    log_error "[FATAL] HTTP $http_status from $path (expected 200)"
    log_error "Response body:"
    cat "$body_file" >&2
    exit 2
  fi

  # Validate response is valid JSON
  if ! jq -e . "$body_file" >/dev/null 2>&1; then
    log_error "[FATAL] Response body is not valid JSON for $path"
    exit 2
  fi

  # Compute sha256 of response body
  local body_sha256
  body_sha256=$(sha256sum "$body_file" | awk '{print $1}')

  # Compute sha256 of headers
  local headers_sha256
  headers_sha256=$(sha256sum "$headers_file" | awk '{print $1}')

  # Write sha256 file (body hash is primary)
  echo "$body_sha256" > "$sha256_file"

  # Update request metadata with response details
  cat > "$request_file" << REQUEST_JSON
{
  "method": "GET",
  "url": "$url",
  "path": "$path",
  "timestamp_utc": "$request_timestamp",
  "auth_mode": "basic_api_token",
  "headers": {
    "Accept": "application/json",
    "Content-Type": "application/json",
    "User-Agent": "FirstTry-Evidence-Collector/1.0"
  },
  "response": {
    "http_status": $http_status,
    "curl_exit_code": $curl_exit_code,
    "headers_sha256": "$headers_sha256",
    "body_sha256": "$body_sha256",
    "body_file": "01_raw_api/${outfile_prefix}.response.json",
    "sha256_file": "01_raw_api/${outfile_prefix}.response.sha256"
  }
}
REQUEST_JSON

  return 0
}

# ============================================================================
# PAGINATION HELPER - USES HARDENED PAGINATION ENGINE
# (See pagination_harness.sh for 6-guard implementation)
# ============================================================================

jira_api_paginate() {
  # FATAL: deprecated — all pagination must use jira_api_paginate_safe()
  log_error "[FATAL] jira_api_paginate() is deprecated in LIVE mode"
  log_error "[FATAL] Use jira_api_paginate_safe() or jira_api_collect_groups_picker_safe()"
  return 1
}

# ============================================================================
# EXPORT FUNCTIONS
# ============================================================================

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  # Script is being executed directly (not sourced)
  echo "[ERROR] This library must be sourced, not executed directly"
  exit 1
fi
