#!/usr/bin/env bash
# lib/forge_specific.sh — Phase 5: Forge-specific risks (storage key + env entropy)
set -euo pipefail

run_forge_specific() {
  local e="${E}"
  local repo_dir="${REPO_DIR}"
  phase_start "05" "Forge-Specific Risks (Storage Key + Env Entropy)"

  local audit_json="${e}/PHASE_05_storage_key_audit.json"
  local summary_txt="${e}/PHASE_05_forge_specific_summary.txt"

  echo '{"storage_keys":[],"asapp_usages":[],"requestJira_usages":[],"pagination_ok":null,"rate_limit_ok":null}' \
    > "$audit_json"

  echo "[05] Storage key audit..." | tee "$summary_txt"

  local failed=0
  
  # Load allowlist if exists
  local allowlist_file="${repo_dir}/tools/audit/v3_1/allowlists/phase05_storage_constants.txt"
  local has_allowlist=0
  [[ -f "$allowlist_file" ]] && has_allowlist=1

  # ── Storage key audit ─────────────────────────────────────────────────────
  # Find all storage.get/set/delete/query calls
  local storage_hits
  storage_hits=$(rg -n --glob '!**/node_modules/**' --glob '*.ts' --glob '*.js' \
    'storage\.(get|set|delete|query)\(' "${repo_dir}/src" 2>/dev/null || true)

  if [[ -z "$storage_hits" ]]; then
    echo "  No storage.get/set/delete/query calls found." | tee -a "$summary_txt"
  else
    echo "$storage_hits" | tee -a "$summary_txt"

    while IFS= read -r hit; do
      local fp; fp=$(echo "$hit" | cut -d: -f1)
      local ln; ln=$(echo "$hit" | cut -d: -f2)
      local content; content=$(echo "$hit" | cut -d: -f3-)

      # Determine key type
      local key_type="unknown"
      local is_fail=0
      local is_flag=0

      # Check for process.env usage in key
      if echo "$content" | grep -q 'process\.env'; then
        key_type="process.env"
        is_flag=1
        # Check if it's used as tenant discriminator
        if echo "$content" | grep -qE '(cloudId|installationId|tenantId|tenant)'; then
          is_fail=1
        fi
      # Check for static literal (simple string)
      elif echo "$content" | grep -qP "storage\.(get|set|delete|query)\(['\"][^'\"]+['\"]"; then
        # Check if static key includes any tenant context
        local static_key
        static_key=$(echo "$content" | grep -oP "(?<=storage\.(get|set|delete|query)\()['\"][^'\"]+['\"]" | tr -d "'\"" || echo "")
        if echo "$static_key" | grep -qE '(cloud|tenant|install|org)'; then
          key_type="static_with_tenant_hint"
        else
          key_type="static_no_tenant_binding"
          is_fail=1  # Static key without tenant binding = FAIL
        fi
      # Check for template string or concatenation
      elif echo "$content" | grep -qE '`[^`]*\${|"[^"]*"\s*\+|'"'"'[^'"'"']*'"'"'\s*\+'; then
        key_type="dynamic_template"
        # Check tenant binding
        if echo "$content" | grep -qE '(cloudId|installationId|context\.|tenantId)'; then
          key_type="dynamic_with_tenant_binding"
        else
          key_type="dynamic_no_tenant_binding"
          is_fail=1
        fi
      else
        key_type="unknown_dynamic"
        is_fail=1  # Cannot prove binding statically
      fi

      # Update JSON
      jq --arg fp "$fp" --arg ln "$ln" --arg kt "$key_type" --arg c "$content" \
        '.storage_keys += [{"file":$fp,"line":$ln,"key_type":$kt,"content":$c}]' \
        "$audit_json" > "${audit_json}.tmp" && mv "${audit_json}.tmp" "$audit_json"

      echo "    [${key_type}] ${fp}:${ln}" | tee -a "$summary_txt"

      # Check allowlist before marking as FAIL
      local is_allowlisted=0
      if [[ "$has_allowlist" -eq 1 ]] && [[ "$is_fail" -eq 1 ]]; then
        # Extract relative path from repo root
        local rel_fp="${fp#${repo_dir}/}"
        # Check if this file:content pattern is in allowlist
        while IFS= read -r allow_line; do
          # Skip comments and empty lines
          [[ "$allow_line" =~ ^[[:space:]]*# ]] && continue
          [[ -z "$allow_line" ]] && continue
          # Match format: "file:pattern"
          local allow_file="${allow_line%%:*}"
          local allow_pattern="${allow_line#*:}"
          if [[ "$rel_fp" == "$allow_file" ]] && echo "$content" | grep -q "$allow_pattern"; then
            is_allowlisted=1
            echo "    ALLOWLISTED: ${allow_pattern} (Forge provides implicit tenant isolation)" | tee -a "$summary_txt"
            break
          fi
        done < "$allowlist_file"
      fi

      if [[ "$is_fail" -eq 1 ]] && [[ "$is_allowlisted" -eq 0 ]]; then
        echo "    FAIL: Key at ${fp}:${ln} lacks verifiable tenant binding (type: ${key_type})" \
          | tee -a "$summary_txt"
        failed=1
      fi
      if [[ "$is_flag" -eq 1 ]] && [[ "$is_fail" -eq 0 ]]; then
        phase_flag "05" "HIGH" "Storage key uses process.env at ${fp}:${ln}" "$summary_txt"
      fi
    done <<< "$storage_hits"
  fi

  # ── asApp() usage list ──────────────────────────────────────────────────────
  echo "[05] Scanning for asApp() usage..." | tee -a "$summary_txt"
  local asapp_hits
  asapp_hits=$(rg -n --glob '!**/node_modules/**' --glob '*.ts' \
    'asApp\(\)' "${repo_dir}/src" 2>/dev/null || true)
  if [[ -n "$asapp_hits" ]]; then
    echo "$asapp_hits" | tee -a "$summary_txt"
    jq --arg v "$asapp_hits" '.asapp_usages = ($v | split("\n"))' \
      "$audit_json" > "${audit_json}.tmp" && mv "${audit_json}.tmp" "$audit_json"
  else
    echo "  No asApp() usage found." | tee -a "$summary_txt"
  fi

  # ── requestJira() usage list ───────────────────────────────────────────────
  echo "[05] Scanning for requestJira() usage..." | tee -a "$summary_txt"
  local rj_hits
  rj_hits=$(rg -n --glob '!**/node_modules/**' --glob '*.ts' \
    'requestJira\(' "${repo_dir}/src" 2>/dev/null || true)
  if [[ -n "$rj_hits" ]]; then
    echo "$rj_hits" | tee -a "$summary_txt"
    jq --arg v "$rj_hits" '.requestJira_usages = ($v | split("\n"))' \
      "$audit_json" > "${audit_json}.tmp" && mv "${audit_json}.tmp" "$audit_json"
  fi

  # ── Pagination handling ────────────────────────────────────────────────────
  echo "[05] Checking pagination handling..." | tee -a "$summary_txt"
  local pag_hits
  pag_hits=$(rg -l --glob '!**/node_modules/**' --glob '*.ts' \
    'startAt\|maxResults\|nextPage\|cursor\|pagination\|paginate\|isLast' \
    "${repo_dir}/src" 2>/dev/null || true)
  if [[ -z "$pag_hits" ]]; then
    phase_flag "05" "HIGH" "No pagination handling found in src/**. Jira API pagination may be ignored." "$summary_txt"
    jq '.pagination_ok = false' "$audit_json" > "${audit_json}.tmp" && mv "${audit_json}.tmp" "$audit_json"
  else
    echo "  Pagination evidence found in: $(echo "$pag_hits" | head -3)" | tee -a "$summary_txt"
    jq '.pagination_ok = true' "$audit_json" > "${audit_json}.tmp" && mv "${audit_json}.tmp" "$audit_json"
  fi

  # ── 429 / rate limit handling ──────────────────────────────────────────────
  echo "[05] Checking 429/rate-limit handling..." | tee -a "$summary_txt"
  local rl_hits
  rl_hits=$(rg -l --glob '!**/node_modules/**' --glob '*.ts' \
    '429\|TooManyRequests\|rate.?limit\|Retry-After\|retry\|backoff' \
    "${repo_dir}/src" 2>/dev/null || true)
  if [[ -z "$rl_hits" ]]; then
    phase_flag "05" "HIGH" "No 429/rate-limit handling found in src/**. DoS risk." "$summary_txt"
    jq '.rate_limit_ok = false' "$audit_json" > "${audit_json}.tmp" && mv "${audit_json}.tmp" "$audit_json"
  else
    echo "  Rate limit evidence found in: $(echo "$rl_hits" | head -3)" | tee -a "$summary_txt"
    jq '.rate_limit_ok = true' "$audit_json" > "${audit_json}.tmp" && mv "${audit_json}.tmp" "$audit_json"
  fi

  if [[ "$failed" -eq 1 ]]; then
    phase_fail "05" "Storage key audit failed: keys without verifiable tenant binding found." "$audit_json"
  fi

  phase_pass "05" "Forge-specific risk checks passed (storage keys, asApp, ratelimit, pagination reviewed)."
}

export -f run_forge_specific
