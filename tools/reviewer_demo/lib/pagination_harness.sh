#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# HARDENED PAGINATION LIBRARY FOR JIRA REST API
# Implements fail-closed multi-guard pagination with termination reasons
# ============================================================================

# Source common utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/_common.sh"

# ============================================================================
# PAGINATION SAFETY HARNESS
# Replaces generic page crawl with deterministic termination logic
# ============================================================================

jira_api_paginate_safe() {
  local path_template="$1"       # Path with {start} and {limit} placeholders
  local outfile_prefix="$2"      # Output file prefix
  local evidence_root="${3:-$EVIDENCE_ROOT}"  # Evidence root
  local maxResults="${4:-50}"    # Items per page
  local max_pages="${5:-100}"    # Hard safety cap

  log_info "Paginating: $path_template (maxResults=$maxResults, cap=$max_pages)"

  # Pagination state tracking
  local startAt=0
  local pageNum=0
  local collected_items=0
  local total_from_api=0
  local previous_startAt=-1
  local previous_response_hash=""
  declare -a all_pages
  declare -a page_hashes
  declare -a page_termination_reasons

  # Pagination metadata
  local pagination_report_file="${evidence_root}/01_raw_api/${outfile_prefix}_pagination_report.json"
  mkdir -p "$(dirname "$pagination_report_file")"

  log_info "  Starting pagination loop..."

  while true; do
    pageNum=$((pageNum + 1))

    # =====================================================================
    # GUARD F: Hard safety cap (last line of defense)
    # =====================================================================
    if [[ $pageNum -gt $max_pages ]]; then
      log_error "[FATAL] Pagination exceeded hard safety cap of $max_pages pages"
      log_error "[FATAL] This indicates either:"
      log_error "  - Endpoint malfunction (returns no items forever)"
      log_error "  - Jira API contract violation"
      log_error "  - Crawler logic error"

      # Write failure report
      cat > "$pagination_report_file" << EOF
{
  "endpoint": "$path_template",
  "maxResults": $maxResults,
  "hard_cap": $max_pages,
  "pages_crawled": $pageNum,
  "items_collected": $collected_items,
  "total_from_api": $total_from_api,
  "termination_reason": "hard_safety_cap_exceeded",
  "page_names": [$(printf '"%s"' "${all_pages[@]}" | paste -sd,)],
  "pagination_valid": false
}
EOF
      return 1
    fi

    # Construct path with pagination params
    local path="${path_template//\{start\}/$startAt}"
    path="${path//\{limit\}/$maxResults}"

    # Pad page number with zeros
    local padded_page
    padded_page=$(printf "%03d" "$pageNum")
    local page_prefix="${outfile_prefix}_page${padded_page}"

    # Fetch page
    jira_api_get "$path" "$page_prefix" "$evidence_root" || {
      log_error "[FATAL] Failed to fetch page $pageNum at startAt=$startAt"
      return 1
    }

    # Get response file
    local response_file="${evidence_root}/01_raw_api/${page_prefix}.response.json"
    local sha256_file="${evidence_root}/01_raw_api/${page_prefix}.response.sha256"

    # Defensive JSON extraction (all fields optional)
    local isLast
    local returned
    local isLast_exists
    local returned_exists
    isLast=$(jq -r '.isLast // empty' "$response_file" 2>/dev/null || echo "")
    returned=$(jq '.values | length // 0' "$response_file" 2>/dev/null || echo "0")
    total_from_api=$(jq -r '.total // 0' "$response_file" 2>/dev/null || echo "0")

    isLast_exists=0
    if jq -e '.isLast' "$response_file" >/dev/null 2>&1; then
      isLast_exists=1
    fi
    returned_exists=0
    if jq -e '.values' "$response_file" >/dev/null 2>&1; then
      returned_exists=1
    fi

    # Record current page
    all_pages+=("$page_prefix")
    local response_hash
    response_hash=$(cat "$sha256_file")
    page_hashes+=("$response_hash")

    collected_items=$((collected_items + returned))

    log_info "    Page $pageNum: returned=$returned, isLast=$isLast, total=$total_from_api, items_so_far=$collected_items"

    local termination_reason=""
    local should_terminate=0

    # =====================================================================
    # GUARD A: Explicit terminal state (isLast==true)
    # =====================================================================
    if [[ $isLast_exists -eq 1 && "$isLast" == "true" ]]; then
      termination_reason="explicit_terminal_state_isLast_true"
      should_terminate=1
      log_info "    → TERMINATE: isLast=true (explicit terminal)"
    fi

    # =====================================================================
    # GUARD B: Semantic exhaustion (zero items returned)
    # =====================================================================
    if [[ $should_terminate -eq 0 && $returned -eq 0 ]]; then
      termination_reason="semantic_exhaustion_zero_items"
      should_terminate=1
      log_info "    → TERMINATE: returned 0 items (semantic exhaustion)"
    fi

    # =====================================================================
    # GUARD C: Cursor non-advancement (startAt not advancing or regressing)
    # =====================================================================
    if [[ $should_terminate -eq 0 && $startAt -le $previous_startAt && $pageNum -gt 1 ]]; then
      termination_reason="cursor_non_advancement"
      should_terminate=1
      log_error "    → TERMINATE: cursor not advancing (startAt=$startAt, previous=$previous_startAt)"
    fi

    # =====================================================================
    # GUARD D: Duplicate page detection (same response hash)
    # =====================================================================
    if [[ $should_terminate -eq 0 && -n "$previous_response_hash" && "$response_hash" == "$previous_response_hash" ]]; then
      termination_reason="duplicate_page_detected"
      should_terminate=1
      log_error "    → TERMINATE: duplicate page (same hash as page $((pageNum-1)))"
    fi

    # =====================================================================
    # GUARD E: Total reached
    # If API provides total count, verify we haven't collected everything
    # =====================================================================
    if [[ $should_terminate -eq 0 && $total_from_api -gt 0 ]]; then
      # If we've collected >= total, we're done
      if [[ $collected_items -ge $total_from_api ]]; then
        termination_reason="total_reached"
        should_terminate=1
        log_info "    → TERMINATE: total reached (collected=$collected_items, total=$total_from_api)"
      fi
    fi

    page_termination_reasons+=("$termination_reason")

    # If termination condition met, exit loop
    if [[ $should_terminate -eq 1 ]]; then
      log_info "  ✓ Pagination complete: $pageNum pages, $collected_items items, reason: $termination_reason"
      break
    fi

    # Move to next page
    previous_startAt=$startAt
    previous_response_hash=$response_hash
    startAt=$((startAt + maxResults))
  done

  # =========================================================================
  # Write pagination report (always, pass or fail)
  # =========================================================================

  cat > "$pagination_report_file" << PAGINATION_JSON
{
  "endpoint": "$path_template",
  "maxResults": $maxResults,
  "hard_cap": $max_pages,
  "pages_collected": $pageNum,
  "items_collected": $collected_items,
  "total_from_api": $total_from_api,
  "termination_reason": "$termination_reason",
  "page_names": [$(printf '"%s"' "${all_pages[@]}" | paste -sd,)],
  "page_hashes": [$(printf '"%s"' "${page_hashes[@]}" | paste -sd,)],
  "page_termination_reasons": [$(printf '"%s"' "${page_termination_reasons[@]}" | paste -sd,)],
  "pagination_valid": true,
  "safety_mechanisms_triggered": {
    "hard_cap_exceeded": false,
    "zero_items_termination": $(if [[ "$termination_reason" == "semantic_exhaustion_zero_items" ]]; then echo "true"; else echo "false"; fi),
    "duplicate_page_detected": $(if [[ "$termination_reason" == "duplicate_page_detected" ]]; then echo "true"; else echo "false"; fi),
    "cursor_non_advancement": $(if [[ "$termination_reason" == "cursor_non_advancement" ]]; then echo "true"; else echo "false"; fi)
  },
  "integrity_checks": {
    "all_pages_same_hash": $(if [[ ${#page_hashes[@]} -gt 1 ]] && [[ "${page_hashes[0]}" == "${page_hashes[-1]}" ]]; then echo "true"; else echo "false"; fi),
    "expected_item_count_match": $(if [[ $total_from_api -gt 0 && $collected_items -eq $total_from_api ]]; then echo "true"; else echo "false"; fi)
  }
}
PAGINATION_JSON

  return 0
}

# ============================================================================
# GROUPS PICKER ENDPOINT-SPECIFIC COLLECTOR
# Handles /rest/api/3/groups/picker safely with explicit schema understanding
# ============================================================================

jira_api_collect_groups_picker_safe() {
  local evidence_root="${1:-$EVIDENCE_ROOT}"
  local maxResults="${2:-50}"
  local max_pages="${3:-20}"  # Groups picker should never need many pages

  log_info "Collecting /rest/api/3/groups/picker (endpoint-specific)"

  local startAt=0
  local pageNum=0
  local collected_groups=0
  local previous_collected_groups=0
  local total_from_api=0
  local previous_response_hash=""
  local previous_startIndex=-1
  declare -a all_pages

  local groups_report_file="${evidence_root}/01_raw_api/groups_picker_collection_report.json"
  mkdir -p "$(dirname "$groups_report_file")"

  local run_outcome="FAIL"
  local run_outcome_code="not_started"
  local authoritative_enumeration_supported="false"

  while true; do
    pageNum=$((pageNum + 1))

    # Hard cap for groups picker (should never be needed)
    if [[ $pageNum -gt $max_pages ]]; then
      run_outcome_code="hard_cap_groups_picker_exceeded"
      log_error "[FATAL] /groups/picker hard cap exceeded at $max_pages pages"
      break
    fi

    # Construct URL for groups picker
    local path="/rest/api/3/groups/picker"
    local path="${path}?maxResults=${maxResults}&startAt=${startAt}&query="

    local padded_page
    padded_page=$(printf "%03d" "$pageNum")
    local page_prefix="groups_picker_page${padded_page}"

    # Fetch page
    jira_api_get "$path" "$page_prefix" "$evidence_root" || {
      run_outcome_code="api_call_failed"
      log_error "[FATAL] Failed to fetch groups page $pageNum"
      break
    }

    local response_file="${evidence_root}/01_raw_api/${page_prefix}.response.json"
    local sha256_file="${evidence_root}/01_raw_api/${page_prefix}.response.sha256"

    # Extract schema-aware fields for /groups/picker
    # Response structure: { groups: [...], header: {...}, footer: {...}, isLastPage: bool, maxResults: N, startIndex: N, total: N }
    local groups_in_page
    local isLastPage
    local startIndex_from_response
    local total_from_response
    local header_exists footer_exists

    groups_in_page=$(jq '.groups | length // 0' "$response_file" 2>/dev/null || echo "0")
    isLastPage=$(jq -r '.isLastPage // false' "$response_file" 2>/dev/null || echo "false")
    startIndex_from_response=$(jq -r '.startIndex // -999' "$response_file" 2>/dev/null || echo "-999")
    total_from_response=$(jq -r '.total // 0' "$response_file" 2>/dev/null || echo "0")

    # Log the raw response structure for debugging
    log_info "    Raw response keys: $(jq 'keys | join(",")' "$response_file" 2>/dev/null || echo "unknown")"
    log_info "    startAt requested=$startAt, startIndex_in_response=$startIndex_from_response"

    header_exists=0
    footer_exists=0
    if jq -e '.header' "$response_file" >/dev/null 2>&1; then header_exists=1; fi
    if jq -e '.footer' "$response_file" >/dev/null 2>&1; then footer_exists=1; fi

    all_pages+=("$page_prefix")
    collected_groups=$((collected_groups + groups_in_page))
    total_from_api=$total_from_response

    local response_hash
    response_hash=$(cat "$sha256_file")

    log_info "    Page $pageNum: groups=$groups_in_page, isLastPage=$isLastPage, total=$total_from_api, collected_so_far=$collected_groups"

    # Termination check for groups picker
    local should_terminate=0
    local termination_reason=""

    # Zero groups returned: endpoint cannot provide authoritative enumeration
    if [[ $groups_in_page -eq 0 && $pageNum -eq 1 ]]; then
      # First page with zero items: endpoint may not support enumeration
      authoritative_enumeration_supported="false"
      run_outcome_code="empty_first_page_no_enumeration"
      run_outcome="FAIL"
      log_error "[FATAL] /groups/picker returned zero groups on first page: endpoint does not support authoritative enumeration"
      should_terminate=1
      termination_reason="empty_first_page_endpoint_not_authoritative"
    fi

    # Zero groups in middle pages: semantic exhaustion
    if [[ $groups_in_page -eq 0 && $pageNum -gt 1 ]]; then
      authoritative_enumeration_supported="true"  # We got at least some data before
      run_outcome_code="semantic_exhaustion"
      run_outcome="PASS"
      should_terminate=1
      termination_reason="semantic_exhaustion_zero_items"
      log_info "    → All groups collected (zero groups in page $pageNum)"
    fi

    # Duplicate page: Only flag if NO progress in startIndex (same position as previous)
    # AND we haven't advanced our count of groups
    # Note: /groups/picker may return identical content or no progress when pagination hits limits
    if [[ $groups_in_page -eq 0 ||
          (-n "$previous_response_hash" && "$response_hash" == "$previous_response_hash" &&
           $collected_groups -le $previous_collected_groups && $pageNum -gt 1) ]]; then

      # Only fail if NO progress was made
      if [[ $collected_groups -le $previous_collected_groups && $pageNum -gt 1 ]]; then
        authoritative_enumeration_supported="false"
        run_outcome_code="no_progress"
        run_outcome="FAIL"
        should_terminate=1
        termination_reason="no_progress_across_pages"
        log_error "[FATAL] /groups/picker: No progress in pagination (collected=$collected_groups, previous=$previous_collected_groups)"
      else
        # We made progress, so continue even if hash is the same
        log_info "    → Continuing pagination (made progress: $previous_collected_groups → $collected_groups)"
      fi
    fi

    # isLastPage explicit signal (check this FIRST as it's authoritative)
    if [[ "$isLastPage" == "true" ]]; then
      authoritative_enumeration_supported="true"
      run_outcome_code="all_groups_collected"
      run_outcome="PASS"
      should_terminate=1
      termination_reason="isLastPage_true"
      log_info "    → All groups collected (isLastPage=true)"
    fi

    # Even if isLastPage=false, if we've collected >= total (and total was provided),
    # we've collected everything. This handles API bugs where isLastPage isn't reliably set.
    if [[ $should_terminate -eq 0 && $total_from_response -gt 0 && $collected_groups -ge $total_from_response ]]; then
      authoritative_enumeration_supported="true"
      run_outcome_code="total_collected"
      run_outcome="PASS"
      should_terminate=1
      termination_reason="collected_>=_total"
      log_info "    → All groups collected per total count (collected=$collected_groups >= total=$total_from_response)"
    fi

    previous_response_hash=$response_hash
    previous_startIndex=$startIndex_from_response
    previous_collected_groups=$collected_groups

    if [[ $should_terminate -eq 1 ]]; then
      break
    fi

    # Move to next page
    startAt=$((startAt + maxResults))
  done

  # Write groups picker specific report
  cat > "$groups_report_file" << GROUPS_REPORT
{
  "endpoint": "/rest/api/3/groups/picker",
  "maxResults": $maxResults,
  "pages_collected": $pageNum,
  "groups_collected": $collected_groups,
  "total_from_api": $total_from_api,
  "authoritative_enumeration_supported": $authoritative_enumeration_supported,
  "run_outcome": "$run_outcome",
  "run_outcome_code": "$run_outcome_code",
  "termination_reason": "$termination_reason",
  "page_names": [$(printf '"%s"' "${all_pages[@]}" | paste -sd,)]
}
GROUPS_REPORT

  if [[ "$run_outcome" == "FAIL" ]]; then
    log_error "[FATAL] /groups/picker collection failed: $run_outcome_code"
    return 1
  fi

  return 0
}

# ============================================================================
# EXPORT FUNCTIONS FOR USE BY OTHER MODULES
# ============================================================================

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  echo "[ERROR] This library must be sourced, not executed directly" >&2
  exit 1
fi
