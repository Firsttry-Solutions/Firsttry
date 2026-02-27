#!/usr/bin/env bash
# lib/legal.sh — Phase 11: Legal/governance + external link validation
set -euo pipefail

run_legal() {
  local e="${E}"
  local repo_dir="${REPO_DIR}"
  phase_start "11" "Legal/Governance + External Link Validation"

  local inventory_json="${e}/PHASE_11_legal_inventory.json"
  local links_txt="${e}/PHASE_11_external_link_validation.txt"

  echo '{"documents":{}}' > "$inventory_json"

  # ── Document inventory ─────────────────────────────────────────────────────
  echo "[11] Inventorying governance documents..." | tee "$links_txt"

  declare -A doc_patterns=(
    [privacy]='privacy|PRIVACY'
    [terms]='TERMS|terms.of|terms_of|tos'
    [dpa]='DPA|data.processing|data_processing'
    [subprocessors]='subprocessor|SUBPROCESSOR'
    [incident_response]='incident.response|INCIDENT|incident_response'
    [bcp]='BCP|business.continuity|disaster.recovery'
    [access_control]='access.control|ACCESS_CONTROL|access_policy'
    [retention]='retention|RETENTION|data.retention'
  )

  local missing_docs=""
  for doc_key in "${!doc_patterns[@]}"; do
    local pat="${doc_patterns[$doc_key]}"
    local found_file
    found_file=$(find "${repo_dir}" -maxdepth 4 -type f \( -name "*.md" -o -name "*.txt" -o -name "*.pdf" \) \
      -not -path "*/node_modules/*" 2>/dev/null | \
      xargs grep -rlE "$pat" 2>/dev/null | head -1 || true)
    if [[ -z "$found_file" ]]; then
      # Also check by filename
      found_file=$(find "${repo_dir}" -maxdepth 4 -iname "*${doc_key//_/-}*" \
        -not -path "*/node_modules/*" 2>/dev/null | head -1 || true)
    fi
    local status="FOUND"
    [[ -z "$found_file" ]] && { status="MISSING"; missing_docs+="${doc_key} "; }
    echo "  [${status}] ${doc_key}: ${found_file:-'(not found)'}" | tee -a "$links_txt"
    jq --arg k "$doc_key" --arg s "$status" --arg f "${found_file:-}" \
      '.documents[$k] = {"status":$s,"file":$f}' \
      "$inventory_json" > "${inventory_json}.tmp" && mv "${inventory_json}.tmp" "$inventory_json"
  done

  if [[ -n "$missing_docs" ]]; then
    phase_flag "11" "HIGH" "Missing governance documents: ${missing_docs}. Required for Fortune-50 procurement." "$inventory_json"
  fi

  # ── External link validation ───────────────────────────────────────────────
  echo "[11] Extracting external links from README/docs..." | tee -a "$links_txt"

  local readme_files
  readme_files=$(find "${repo_dir}" -maxdepth 3 -type f \( -iname "README*" -o -iname "*.md" \) \
    -not -path "*/node_modules/*" 2>/dev/null | head -20 || true)

  local all_urls
  all_urls=$(echo "$readme_files" | xargs grep -hoE 'https?://[^)>" ]+' 2>/dev/null | \
    grep -v 'localhost\|127\.0\.0\|example\.com\|placeholder' | sort -u | head -30 || true)

  if [[ -z "$all_urls" ]]; then
    echo "  No external URLs found in README/docs." | tee -a "$links_txt"
  fi

  # Check if curl available
  if ! command -v curl &>/dev/null; then
    phase_flag "11" "HIGH" "curl not available; cannot validate external documentation links." "$links_txt"
  else
    # Try a quick network check
    local net_available=1
    curl -fLsS --max-time 5 "https://www.atlassian.com" -o /dev/null 2>/dev/null || net_available=0

    if [[ "$net_available" -eq 0 ]]; then
      phase_flag "11" "HIGH" \
        "Cleanroom network blocked; cannot validate external docs. External link validation skipped." \
        "$links_txt"
    else
      local gdpr_ok=0
      local retention_ok=0

      while IFS= read -r url; do
        [[ -z "$url" ]] && continue
        echo "  Checking: ${url}" | tee -a "$links_txt"
        local http_body
        http_body=$(curl -fLsS --max-time 10 "$url" 2>/dev/null || echo "CURL_FAIL")
        if [[ "$http_body" == "CURL_FAIL" ]]; then
          echo "    [FAIL] Could not reach ${url}" | tee -a "$links_txt"
          phase_flag "11" "LOW" "External link unreachable: ${url}" "$links_txt"
          continue
        fi
        # Check for GDPR/data protection
        if echo "$http_body" | grep -qi 'gdpr\|data protection\|GDPR'; then
          gdpr_ok=1
          echo "    [PASS] GDPR/data protection language found at ${url}" | tee -a "$links_txt"
        fi
        # Check for retention
        if echo "$http_body" | grep -qi 'retention\|data retention'; then
          retention_ok=1
          echo "    [PASS] Retention language found at ${url}" | tee -a "$links_txt"
        fi
      done <<< "$all_urls"

      if [[ "$gdpr_ok" -eq 0 ]]; then
        phase_flag "11" "MEDIUM" "No GDPR/data-protection language found in any linked external docs." "$links_txt"
      fi
      if [[ "$retention_ok" -eq 0 ]]; then
        phase_flag "11" "MEDIUM" "No data retention language found in any linked external docs." "$links_txt"
      fi
    fi
  fi

  phase_pass "11" "Legal/governance inventory and external link check completed."
}

export -f run_legal
