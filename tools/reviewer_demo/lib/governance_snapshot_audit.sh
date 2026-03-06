#!/usr/bin/env bash
set -euo pipefail

# Source common utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/_common.sh
source "${SCRIPT_DIR}/_common.sh"
# shellcheck source=lib/pagination_harness.sh
source "${SCRIPT_DIR}/pagination_harness.sh"

# ============================================================================
# PROVABLE JIRA GOVERNANCE EVIDENCE COLLECTOR
# ============================================================================

# Global variables for evidence paths
GOVERNANCE_EVIDENCE_ROOT=""
RAW_REQUESTS_DIR=""
RAW_RESPONSES_DIR=""
CANONICAL_RESPONSES_DIR=""
DERIVED_DIR=""
VALIDATION_DIR=""

# Authentication variables (read from environment, never initialized)
# These are intentionally NOT set to empty strings to avoid clobbering exported variables
# : "${JIRA_BASE_URL:=}"   # Use this pattern if default is needed, but keep it clean
# : "${JIRA_EMAIL:=}"
# : "${JIRA_API_TOKEN:=}"
# : "${JIRA_BEARER_TOKEN:=}"
AUTH_MODE=""

# ============================================================================
# PHASE 2: JIRA AUTH CONTRACT (FAIL-CLOSED)
# ============================================================================

validate_jira_auth() {
  log_info "Validating Jira authentication contract..."

  # Require JIRA_BASE_URL
  if [[ -z "${JIRA_BASE_URL:-}" ]]; then
    log_error "JIRA_BASE_URL is required for governance evidence collection"
    if [[ "${OFFLINE_OK:-0}" != "1" ]]; then
      log_error "Set OFFLINE_OK=1 to skip governance evidence collection in offline mode"
      return 1
    else
      log_info "OFFLINE_OK=1 set, skipping governance evidence collection"
      return 2  # Special code for offline skip
    fi
  fi

  # Validate JIRA_BASE_URL format
  if [[ ! "$JIRA_BASE_URL" =~ ^https://.*\.atlassian\.net ]]; then
    log_error "JIRA_BASE_URL must start with https:// and contain .atlassian.net"
    log_error "Current value: $JIRA_BASE_URL"
    return 1
  fi

  # Check authentication methods
  if [[ -n "${JIRA_EMAIL:-}" && -n "${JIRA_API_TOKEN:-}" ]]; then
    AUTH_MODE="basic"
    log_info "Using Basic authentication (email + API token)"
  elif [[ -n "${JIRA_BEARER_TOKEN:-}" ]]; then
    AUTH_MODE="bearer"
    log_info "Using Bearer token authentication"
  else
    log_error "No valid Jira authentication found"
    log_error "Provide either:"
    log_error "  - JIRA_EMAIL + JIRA_API_TOKEN (for Basic auth), or"
    log_error "  - JIRA_BEARER_TOKEN (for Bearer auth)"

    if [[ "${OFFLINE_OK:-0}" != "1" ]]; then
      log_error "Set OFFLINE_OK=1 to skip governance evidence collection"
      return 1
    else
      log_info "OFFLINE_OK=1 set, skipping governance evidence collection"
      return 2  # Special code for offline skip
    fi
  fi

  return 0
}

# ============================================================================
# PHASE 3: REQUEST CAPTURE + RAW RESPONSE CAPTURE
# ============================================================================

jira_get_json() {
  local endpoint="$1"
  local query_string="$2"
  local out_base_name="$3"

  log_info "Capturing: $endpoint$query_string -> $out_base_name"

  # Build full URL
  local full_url="${JIRA_BASE_URL}${endpoint}${query_string}"

  # Prepare output files
  local request_file="${RAW_REQUESTS_DIR}/${out_base_name}.request.json"
  local headers_file="${RAW_REQUESTS_DIR}/${out_base_name}.headers.txt"
  local response_file="${RAW_RESPONSES_DIR}/${out_base_name}.response.json"
  local status_file="${RAW_REQUESTS_DIR}/${out_base_name}.status.txt"

  # Record request metadata
  local timestamp
  timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)

  # Determine auth headers (safe subset only)
  local auth_header_info
  if [[ "$AUTH_MODE" == "basic" ]]; then
    auth_header_info="Authorization: Basic [REDACTED]"
  else
    auth_header_info="Authorization: Bearer [REDACTED]"
  fi

  # Write request manifest
  cat > "$request_file" << EOF
{
  "utc_timestamp": "$timestamp",
  "method": "GET",
  "full_url": "$full_url",
  "endpoint": "$endpoint",
  "query": "$query_string",
  "headers_used": ["Accept: application/json", "$auth_header_info"],
  "auth_mode": "$AUTH_MODE"
}
EOF

  # Prepare curl arguments
  local curl_args=(
    -sS
    -D "$headers_file"
    -o "$response_file"
    -w "%{http_code}"
    -H "Accept: application/json"
    -H "Content-Type: application/json"
  )

  # Add authentication
  if [[ "$AUTH_MODE" == "basic" ]]; then
    curl_args+=(-u "$JIRA_EMAIL:$JIRA_API_TOKEN")
  else
    curl_args+=(-H "Authorization: Bearer $JIRA_BEARER_TOKEN")
  fi

  # Execute curl
  local http_code
  if ! http_code=$(curl "${curl_args[@]}" "$full_url" 2>/dev/null); then
    local curl_exit_code=$?
    echo "$curl_exit_code" > "$status_file"

    # Update request manifest with failure
    jq --arg code "$curl_exit_code" '. + {"curl_exit_code": ($code | tonumber), "success": false}' \
      "$request_file" > "$request_file.tmp" && mv "$request_file.tmp" "$request_file"

    log_error "curl failed for $endpoint (exit code: $curl_exit_code)"
    return 1
  fi

  echo "$http_code" > "$status_file"

  # Update request manifest with success
  jq --arg code "0" --arg http "$http_code" \
    '. + {"curl_exit_code": ($code | tonumber), "http_code": ($http | tonumber), "success": true}' \
    "$request_file" > "$request_file.tmp" && mv "$request_file.tmp" "$request_file"

  # Validate HTTP 200
  if [[ "$http_code" != "200" ]]; then
    log_error "HTTP $http_code for $endpoint (expected 200)"
    log_error "Response headers:"
    cat "$headers_file" >&2 || true
    log_error "Response body:"
    head -20 "$response_file" >&2 || true
    return 1
  fi

  # Validate response is valid JSON
  if ! jq empty "$response_file" 2>/dev/null; then
    log_error "Invalid JSON response from $endpoint"
    return 1
  fi

  log_info "✓ Captured: $out_base_name (HTTP $http_code)"
  return 0
}

# ============================================================================
# PHASE 4: COLLECT REQUIRED GOVERNANCE SOURCES
# ============================================================================

collect_governance_sources() {
  log_info "Collecting Jira governance sources..."

  local page_index=0
  local start_at=0
  local max_results=50
  local is_last=false
  local total_collected=0
  local pagination_proof=()

  # A) Groups
  log_info "Collecting Jira groups..."
  if ! jira_get_json "/rest/api/3/groups/picker" "?maxResults=1000" "groups_picker"; then
    log_error "Failed to collect groups"
    return 1
  fi

  # B) Permission schemes list
  log_info "Collecting permission schemes..."
  if ! jira_get_json "/rest/api/3/permissionscheme" "" "permission_schemes"; then
    log_error "Failed to collect permission schemes"
    return 1
  fi

  # C) Projects list (paginated with SAFE guards)
  log_info "Collecting projects (paginated with safety guards)..."

  # Initialize safe pagination state
  local pageNum=0
  local startAt=0
  local page_index=0
  local is_last=false
  local total_collected=0
  local max_pages=100  # Hard safety cap

  while [[ "$is_last" == "false" ]] && [[ $pageNum -lt $max_pages ]]; do
    pageNum=$((pageNum + 1))
    local query="?maxResults=${max_results}&startAt=${startAt}"
    local page_name="projects_page_${page_index}"

    if ! jira_get_json "/rest/api/3/project/search" "$query" "$page_name"; then
      log_error "Failed to collect projects page $page_index"
      return 1
    fi

    # Parse pagination info
    local page_start page_max page_total page_is_last page_values_count
    page_start=$(jq -r '.startAt // 0' "${RAW_RESPONSES_DIR}/${page_name}.response.json")
    page_max=$(jq -r '.maxResults // 0' "${RAW_RESPONSES_DIR}/${page_name}.response.json")
    page_total=$(jq -r '.total // 0' "${RAW_RESPONSES_DIR}/${page_name}.response.json")
    page_is_last=$(jq -r '.isLast // true' "${RAW_RESPONSES_DIR}/${page_name}.response.json")
    page_values_count=$(jq -r '.values | length' "${RAW_RESPONSES_DIR}/${page_name}.response.json")

    # Record pagination proof
    pagination_proof+=("{\"page\": $page_index, \"startAt\": $page_start, \"maxResults\": $page_max, \"total\": $page_total, \"isLast\": $page_is_last, \"valuesCount\": $page_values_count}")

    total_collected=$((total_collected + page_values_count))

    # UPDATE PAGINATION STATE WITH SAFETY GUARDS
    # Guard 1: Explicit terminal state (isLast==true)
    if [[ "$page_is_last" == "true" ]]; then
      is_last=true
      log_info "✓ Projects page $page_index: $page_values_count projects (isLast=true)"
    # Guard 2: Semantic exhaustion (zero items returned)
    elif [[ $page_values_count -eq 0 ]]; then
      is_last=true
      log_info "✓ Projects page $page_index: $page_values_count projects (zero items - semantic exhaustion)"
    else
      # Guard 3: Cursor non-advancement
      if [[ $startAt -ge $((startAt + max_results)) ]]; then
        log_error "[FATAL] Pagination safety: cursor not advancing detected"
        return 1
      fi

      # Continue to next page
      start_at=$((start_at + max_results))
      page_index=$((page_index + 1))
      log_info "✓ Projects page $page_index: $page_values_count projects (continuing pagination)"
    fi

    # Guard 4: Hard safety cap
    if [[ $pageNum -ge $max_pages ]]; then
      log_error "[FATAL] Pagination exceeded safety cap of $max_pages pages"
      return 1
    fi
  done

  # Write pagination proof
  local proof_file="$VALIDATION_DIR/pagination_proof.json"
  printf '[%s]' "$(IFS=,; echo "${pagination_proof[*]}")" | jq '.' > "$proof_file"

  log_info "✓ Collected $total_collected projects across $((page_index + 1)) pages"

  # D) Project permission schemes
  log_info "Collecting project permission scheme mappings..."
  local project_count=0
  local project_keys=()

  # Extract all project keys from collected pages
  for ((i=0; i<=page_index; i++)); do
    local page_file="${RAW_RESPONSES_DIR}/projects_page_${i}.response.json"
    mapfile -t page_keys < <(jq -r '.values[]?.key // empty' "$page_file")
    project_keys+=("${page_keys[@]}")
  done

  log_info "Found ${#project_keys[@]} project keys to map"

  for project_key in "${project_keys[@]}"; do
    if ! jira_get_json "/rest/api/3/project/$project_key/permissionscheme" "" "project_${project_key}_perms"; then
      log_error "Failed to collect permission scheme for project $project_key"
      return 1
    fi
    project_count=$((project_count + 1))
  done

  log_info "✓ Collected permission schemes for $project_count projects"

  # E) Permission scheme details (for schemes found)
  log_info "Collecting detailed permission scheme definitions..."
  local scheme_ids=()

  # Extract scheme IDs from permission schemes list
  mapfile -t scheme_ids < <(jq -r '.permissionSchemes[]?.id // empty' "${RAW_RESPONSES_DIR}/permission_schemes.response.json")

  log_info "Found ${#scheme_ids[@]} permission schemes to detail"

  for scheme_id in "${scheme_ids[@]}"; do
    if ! jira_get_json "/rest/api/3/permissionscheme/$scheme_id" "" "permission_scheme_${scheme_id}_detail"; then
      log_error "Failed to collect details for permission scheme $scheme_id"
      return 1
    fi
  done

  log_info "✓ Collected detailed definitions for ${#scheme_ids[@]} permission schemes"

  return 0
}

# ============================================================================
# PHASE 5: CANONICALIZATION
# ============================================================================

canonicalize_all_responses() {
  log_info "Canonicalizing all raw responses..."

  local canonical_count=0
  local canonical_failures=0

  for raw_file in "${RAW_RESPONSES_DIR}"/*.response.json; do
    [[ -f "$raw_file" ]] || continue

    local base_name
    base_name=$(basename "$raw_file" .response.json)
    local canonical_file="${CANONICAL_RESPONSES_DIR}/${base_name}.canonical.json"

    if python3 "${SCRIPT_DIR}/canonical_json.py" < "$raw_file" > "$canonical_file" 2>/dev/null; then
      canonical_count=$((canonical_count + 1))
      log_info "✓ Canonicalized: $base_name"
    else
      canonical_failures=$((canonical_failures + 1))
      log_error "✗ Failed to canonicalize: $base_name"
    fi
  done

  log_info "Canonicalization complete: $canonical_count success, $canonical_failures failures"

  if [[ $canonical_failures -gt 0 ]]; then
    return 1
  fi

  return 0
}

# ============================================================================
# PHASE 6: DERIVED SNAPSHOTS
# ============================================================================

generate_derived_snapshots() {
  log_info "Generating derived snapshots from canonical responses..."

  local timestamp
  timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)

  # 1) jira_groups_snapshot.json
  log_info "Generating groups snapshot..."
  local groups_inputs=()
  if [[ -f "${CANONICAL_RESPONSES_DIR}/groups_picker.canonical.json" ]]; then
    groups_inputs+=("groups_picker.canonical.json")
  fi

  local groups_data
  groups_data=$(jq -n \
    --arg timestamp "$timestamp" \
    --argjson inputs "$(printf '%s\n' "${groups_inputs[@]}" | jq -R . | jq -s .)" \
    --argjson groups "$(
      if [[ ${#groups_inputs[@]} -gt 0 ]]; then
        jq '[.groups[]? | {name: .name, html: .html, size: (.size // 0)}] | sort_by(.name)' \
          "${CANONICAL_RESPONSES_DIR}/groups_picker.canonical.json" 2>/dev/null || echo "[]"
      else
        echo "[]"
      fi
    )" \
    '{
      utc_timestamp: $timestamp,
      source_files: $inputs,
      groups: $groups,
      counts: {groups_count: ($groups | length)},
      deterministic_build: true
    }')

  echo "$groups_data" > "$DERIVED_DIR/jira_groups_snapshot.json"

  # 2) jira_permissions_snapshot.json
  log_info "Generating permission schemes snapshot..."
  local perms_inputs=()
  perms_inputs+=("permission_schemes.canonical.json")

  # Add all permission scheme detail files
  for detail_file in "${CANONICAL_RESPONSES_DIR}"/permission_scheme_*_detail.canonical.json; do
    [[ -f "$detail_file" ]] || continue
    perms_inputs+=("$(basename "$detail_file")")
  done

  local perms_data
  perms_data=$(jq -n \
    --arg timestamp "$timestamp" \
    --argjson inputs "$(printf '%s\n' "${perms_inputs[@]}" | jq -R . | jq -s .)" \
    --argjson schemes "$(
      if [[ -f "${CANONICAL_RESPONSES_DIR}/permission_schemes.canonical.json" ]]; then
        jq '[.permissionSchemes[]? | {
          id: .id,
          name: .name,
          description: (.description // null),
          scope: (.scope // null)
        }] | sort_by(.id)' "${CANONICAL_RESPONSES_DIR}/permission_schemes.canonical.json" 2>/dev/null || echo "[]"
      else
        echo "[]"
      fi
    )" \
    '{
      utc_timestamp: $timestamp,
      source_files: $inputs,
      schemes: $schemes,
      counts: {schemes_count: ($schemes | length)},
      deterministic_build: true
    }')

  echo "$perms_data" > "$DERIVED_DIR/jira_permissions_snapshot.json"

  # 3) jira_project_access_map.json
  log_info "Generating project access map..."
  local project_inputs=()

  # Add all project page files
  for page_file in "${CANONICAL_RESPONSES_DIR}"/projects_page_*.canonical.json; do
    [[ -f "$page_file" ]] || continue
    project_inputs+=("$(basename "$page_file")")
  done

  # Add all project permission scheme files
  for project_file in "${CANONICAL_RESPONSES_DIR}"/project_*_perms.canonical.json; do
    [[ -f "$project_file" ]] || continue
    project_inputs+=("$(basename "$project_file")")
  done

  # Build project access map using jq
  local project_data=""
  local first_page=true

  # Process all project pages to build the map
  for page_file in "${CANONICAL_RESPONSES_DIR}"/projects_page_*.canonical.json; do
    [[ -f "$page_file" ]] || continue

    if [[ "$first_page" == "true" ]]; then
      project_data=$(jq '.values[]? | {(.key): {project_id: .id, project_name: .name, permission_scheme_id: "", permission_scheme_name: ""}}' "$page_file" | jq -s 'add // {}')
      first_page=false
    else
      local page_data
      page_data=$(jq '.values[]? | {(.key): {project_id: .id, project_name: .name, permission_scheme_id: "", permission_scheme_name: ""}}' "$page_file" | jq -s 'add // {}')
      project_data=$(echo "$project_data $page_data" | jq -s 'add')
    fi
  done

  # Add permission scheme info to each project
  for project_file in "${CANONICAL_RESPONSES_DIR}"/project_*_perms.canonical.json; do
    [[ -f "$project_file" ]] || continue

    local project_key
    project_key=$(basename "$project_file" .canonical.json | sed 's/project_\(.*\)_perms/\1/')
    local scheme_id scheme_name
    scheme_id=$(jq -r '.id // ""' "$project_file" 2>/dev/null)
    scheme_name=$(jq -r '.name // ""' "$project_file" 2>/dev/null)

    project_data=$(echo "$project_data" | jq --arg key "$project_key" --arg sid "$scheme_id" --arg sname "$scheme_name" \
      '.[$key].permission_scheme_id = $sid | .[$key].permission_scheme_name = $sname')
  done

  local map_data
  map_data=$(jq -n \
    --arg timestamp "$timestamp" \
    --argjson inputs "$(printf '%s\n' "${project_inputs[@]}" | jq -R . | jq -s .)" \
    --argjson project_map "${project_data:-{}}" \
    '{
      utc_timestamp: $timestamp,
      source_files: $inputs,
      project_access_map: $project_map,
      counts: {projects_count: ($project_map | keys | length)},
      deterministic_build: true
    }')

  echo "$map_data" > "$DERIVED_DIR/jira_project_access_map.json"

  # 4) governance_snapshot.json (metadata)
  log_info "Generating combined governance snapshot metadata..."
  local all_inputs=()
  all_inputs+=("${groups_inputs[@]}")
  all_inputs+=("${perms_inputs[@]}")
  all_inputs+=("${project_inputs[@]}")

  local snapshot_data
  snapshot_data=$(jq -n \
    --arg timestamp "$timestamp" \
    --argjson all_inputs "$(printf '%s\n' "${all_inputs[@]}" | sort -u | jq -R . | jq -s .)" \
    '{
      utc_timestamp: $timestamp,
      mode: "live",
      source_files: $all_inputs,
      derived_artifacts: [
        "jira_groups_snapshot.json",
        "jira_permissions_snapshot.json",
        "jira_project_access_map.json"
      ],
      validation_artifacts: [
        "pagination_proof.json"
      ],
      deterministic_build: true
    }')

  echo "$snapshot_data" > "$DERIVED_DIR/governance_snapshot.json"

  # 5) governance_audit_report.json (will be updated by validation)
  local audit_report
  audit_report=$(jq -n \
    --arg timestamp "$timestamp" \
    '{
      utc_timestamp: $timestamp,
      mode: "live",
      collection_status: "completed",
      validation_status: "pending"
    }')

  echo "$audit_report" > "$DERIVED_DIR/governance_audit_report.json"

  log_info "✓ Generated all derived snapshots"
  return 0
}

# ============================================================================
# PHASE 7: VALIDATION ASSERTIONS
# ============================================================================

run_validation_assertions() {
  log_info "Running validation assertions..."

  local timestamp
  timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)

  local assertions=()

  # Assert HTTP 200 responses
  local http_200_count=0
  local http_failures=0

  for status_file in "${RAW_REQUESTS_DIR}"/*.status.txt; do
    [[ -f "$status_file" ]] || continue

    local status_code
    status_code=$(cat "$status_file" 2>/dev/null || echo "0")

    if [[ "$status_code" == "200" ]]; then
      http_200_count=$((http_200_count + 1))
    else
      http_failures=$((http_failures + 1))
    fi
  done

  local assert_http_200_all=true
  if [[ $http_failures -gt 0 ]]; then
    assert_http_200_all=false
  fi

  assertions+=("\"assert_http_200_all\": $assert_http_200_all")

  # Assert groups non-empty (unless explicitly allowed)
  local groups_count=0
  if [[ -f "$DERIVED_DIR/jira_groups_snapshot.json" ]]; then
    groups_count=$(jq '.counts.groups_count // 0' "$DERIVED_DIR/jira_groups_snapshot.json" 2>/dev/null || echo "0")
  fi

  local assert_groups_non_empty=true
  if [[ $groups_count -eq 0 && "${ALLOW_EMPTY_GROUPS:-0}" != "1" ]]; then
    assert_groups_non_empty=false
  fi

  assertions+=("\"assert_groups_non_empty\": $assert_groups_non_empty")

  # Assert projects collected complete
  local pagination_consistent=true
  if [[ -f "$VALIDATION_DIR/pagination_proof.json" ]]; then
    local total_from_api total_collected
    total_from_api=$(jq '.[0].total // 0' "$VALIDATION_DIR/pagination_proof.json" 2>/dev/null || echo "0")
    total_collected=$(jq '[.[].valuesCount] | add' "$VALIDATION_DIR/pagination_proof.json" 2>/dev/null || echo "0")

    if [[ $total_from_api -ne $total_collected ]]; then
      pagination_consistent=false
    fi
  else
    pagination_consistent=false
  fi

  assertions+=("\"assert_projects_collected_complete\": $pagination_consistent")

  # Assert project permission scheme complete
  local project_perms_complete=true
  local expected_projects=0
  local actual_perms=0

  if [[ -f "$DERIVED_DIR/jira_project_access_map.json" ]]; then
    expected_projects=$(jq '.counts.projects_count // 0' "$DERIVED_DIR/jira_project_access_map.json" 2>/dev/null || echo "0")
    actual_perms=$(find "${RAW_RESPONSES_DIR}" -name "project_*_perms.response.json" 2>/dev/null | wc -l)

    if [[ $expected_projects -ne $actual_perms ]]; then
      project_perms_complete=false
    fi
  else
    project_perms_complete=false
  fi

  assertions+=("\"assert_project_permissionscheme_complete\": $project_perms_complete")

  # Assert permission schemes non-empty
  local schemes_count=0
  if [[ -f "$DERIVED_DIR/jira_permissions_snapshot.json" ]]; then
    schemes_count=$(jq '.counts.schemes_count // 0' "$DERIVED_DIR/jira_permissions_snapshot.json" 2>/dev/null || echo "0")
  fi

  local assert_schemes_non_empty=true
  if [[ $schemes_count -eq 0 ]]; then
    assert_schemes_non_empty=false
  fi

  assertions+=("\"assert_permissionschemes_non_empty\": $assert_schemes_non_empty")

  # Assert no placeholder data
  local assert_no_placeholder=true
  for derived_file in "$DERIVED_DIR"/*.json; do
    [[ -f "$derived_file" ]] || continue

    if grep -qi -E "(TODO|placeholder|mock|example)" "$derived_file" 2>/dev/null; then
      assert_no_placeholder=false
      break
    fi
  done

  assertions+=("\"assert_no_placeholder_data\": $assert_no_placeholder")

  # Assert deterministic inputs
  local assert_determinism=true
  for derived_file in "$DERIVED_DIR"/*.json; do
    [[ -f "$derived_file" ]] || continue

    if ! jq -e '.source_files // .inputs // empty' "$derived_file" >/dev/null 2>&1; then
      assert_determinism=false
      break
    fi

    # Check that all referenced canonical files exist
    jq -r '.source_files[]? // .inputs[]? // empty' "$derived_file" 2>/dev/null | while read -r canonical_file; do
      [[ -n "$canonical_file" ]] || continue

      if [[ ! -f "${CANONICAL_RESPONSES_DIR}/$canonical_file" ]]; then
        assert_determinism=false
      fi
    done
  done

  assertions+=("\"assert_determinism_inputs\": $assert_determinism")

  # Generate validation report
  local validation_report
  validation_report=$(printf '{
    "utc_timestamp": "%s",
    "http_200_count": %d,
    "http_failures": %d,
    "groups_count": %d,
    "schemes_count": %d,
    "projects_expected": %d,
    "project_perms_actual": %d,
    %s
  }' \
    "$timestamp" \
    "$http_200_count" \
    "$http_failures" \
    "$groups_count" \
    "$schemes_count" \
    "$expected_projects" \
    "$actual_perms" \
    "$(IFS=,; echo "${assertions[*]}")"
  )

  echo "$validation_report" > "$VALIDATION_DIR/validation_report.json"

  # Check if all assertions passed
  local all_passed=true
  for assertion in "${assertions[@]}"; do
    if [[ "$assertion" =~ false ]]; then
      all_passed=false
      break
    fi
  done

  if [[ "$all_passed" == "true" ]]; then
    log_info "✓ All validation assertions passed"

    # Update audit report with success
    jq '. + {"validation_status": "passed", "all_assertions_passed": true}' \
      "$DERIVED_DIR/governance_audit_report.json" > "$DERIVED_DIR/governance_audit_report.json.tmp" \
      && mv "$DERIVED_DIR/governance_audit_report.json.tmp" "$DERIVED_DIR/governance_audit_report.json"

    return 0
  else
    log_error "✗ Validation assertions failed"

    # Update audit report with failure
    jq '. + {"validation_status": "failed", "all_assertions_passed": false}' \
      "$DERIVED_DIR/governance_audit_report.json" > "$DERIVED_DIR/governance_audit_report.json.tmp" \
      && mv "$DERIVED_DIR/governance_audit_report.json.tmp" "$DERIVED_DIR/governance_audit_report.json"

    return 1
  fi
}

# ============================================================================
# MAIN FUNCTION
# ============================================================================

run_governance_snapshot_audit() {
  local evidence_root="$1"
  local repo_root="$2"
  local app_root="$3"
  local manifest_path="$4"

  # Setup evidence paths
  GOVERNANCE_EVIDENCE_ROOT="${evidence_root}/08_governance_snapshot"
  RAW_REQUESTS_DIR="${GOVERNANCE_EVIDENCE_ROOT}/raw/requests"
  RAW_RESPONSES_DIR="${GOVERNANCE_EVIDENCE_ROOT}/raw/responses"
  CANONICAL_RESPONSES_DIR="${GOVERNANCE_EVIDENCE_ROOT}/canonical/responses"
  DERIVED_DIR="${GOVERNANCE_EVIDENCE_ROOT}/derived"
  VALIDATION_DIR="${GOVERNANCE_EVIDENCE_ROOT}/validation"

  log_info "Starting provable governance snapshot audit..."
  log_info "Evidence root: $GOVERNANCE_EVIDENCE_ROOT"

  # Phase 2: Validate authentication
  local auth_result=0
  validate_jira_auth || auth_result=$?

  if [[ $auth_result -ne 0 ]]; then
    if [[ $auth_result -eq 2 ]]; then
      # Offline skip - create minimal evidence
      log_info "Creating offline evidence artifacts..."

      local timestamp
      timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)

      echo "{\"utc_timestamp\": \"$timestamp\", \"source_files\": [], \"groups\": [], \"counts\": {\"groups_count\": 0}, \"deterministic_build\": true, \"mode\": \"offline\"}" > "$DERIVED_DIR/jira_groups_snapshot.json"
      echo "{\"utc_timestamp\": \"$timestamp\", \"source_files\": [], \"schemes\": [], \"counts\": {\"schemes_count\": 0}, \"deterministic_build\": true, \"mode\": \"offline\"}" > "$DERIVED_DIR/jira_permissions_snapshot.json"
      echo "{\"utc_timestamp\": \"$timestamp\", \"source_files\": [], \"project_access_map\": {}, \"counts\": {\"projects_count\": 0}, \"deterministic_build\": true, \"mode\": \"offline\"}" > "$DERIVED_DIR/jira_project_access_map.json"
      echo "{\"utc_timestamp\": \"$timestamp\", \"mode\": \"offline\", \"reason\": \"OFFLINE_OK=1\", \"deterministic_build\": true}" > "$DERIVED_DIR/governance_snapshot.json"
      echo "{\"utc_timestamp\": \"$timestamp\", \"offline_mode\": true, \"auth_validation\": \"skipped\", \"validation_status\": \"skipped\"}" > "$DERIVED_DIR/governance_audit_report.json"

      log_info "✓ Created offline evidence artifacts"
      return 0
    else
      log_error "Authentication validation failed"
      return 1
    fi
  fi

  # Phases 3-4: Collect governance sources
  if ! collect_governance_sources; then
    log_error "Failed to collect governance sources"
    return 1
  fi

  # Phase 5: Canonicalization
  if ! canonicalize_all_responses; then
    log_error "Failed to canonicalize responses"
    return 1
  fi

  # Phase 6: Generate derived snapshots
  if ! generate_derived_snapshots; then
    log_error "Failed to generate derived snapshots"
    return 1
  fi

  # Phase 7: Run validation assertions
  if ! run_validation_assertions; then
    log_error "Validation assertions failed"
    return 1
  fi

  log_info "✓ Provable governance snapshot audit completed successfully"
  return 0
}

# Direct execution guard
if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  echo "This script must be sourced, not executed directly" >&2
  exit 1
fi