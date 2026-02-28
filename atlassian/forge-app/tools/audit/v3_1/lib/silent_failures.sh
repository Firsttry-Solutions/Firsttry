#!/usr/bin/env bash
# lib/silent_failures.sh — Phase 10: Silent failure / partial success (hard fail)
set -euo pipefail

run_silent_failures() {
  local e="${E}"
  local repo_dir="${REPO_DIR}"
  phase_start "10" "Silent Failure / Partial Success Detection"

  local findings_txt="${e}/PHASE_10_silent_failures.txt"
  local findings_json="${e}/PHASE_10_silent_failures.json"
  echo '{"findings":[]}' > "$findings_json"

  echo "[10] Scanning export path for silent failure patterns..." | tee "$findings_txt"

  local failed=0

  # Focus on export-related directories
  local scan_paths=(
    "${repo_dir}/src/export"
    "${repo_dir}/src/exports"
    "${repo_dir}/src/evidence"
    "${repo_dir}/src/governance"
    "${repo_dir}/src/resolvers"
    "${repo_dir}/src/backbone"
    "${repo_dir}/src/milestone1"
    "${repo_dir}/src/access-review"
  )

  _add_sf_finding() {
    local pattern="$1" file="$2" line="$3" content="$4"
    jq --arg p "$pattern" --arg f "$file" --arg l "$line" --arg c "$content" \
      '.findings += [{"pattern":$p,"file":$f,"line":$l,"content":$c}]' \
      "$findings_json" > "${findings_json}.tmp" && mv "${findings_json}.tmp" "$findings_json"
    echo "  [SILENT_FAIL] ${pattern} | ${file}:${line}" | tee -a "$findings_txt"
    echo "    ${content}" | tee -a "$findings_txt"
    failed=1
  }

  for scan_path in "${scan_paths[@]}"; do
    [[ -d "$scan_path" ]] || [[ -f "$scan_path" ]] || continue

    # ── Pattern 1: catch block without rethrow ─────────────────────────────
    # Look for catch blocks that don't contain throw or return (with error propagation)
    # Allowlist patterns:
    #   - "throw" or "rethrow" anywhere in catch block
    #   - "process.exit(" anywhere in catch block
    #   - Comment containing "AUDIT-ALLOW:" or "safe to" or "Ignore" before/in block
    local catch_files
    catch_files=$(rg -l --glob '!**/node_modules/**' --glob '*.ts' \
      'catch\s*\(' "$scan_path" 2>/dev/null || true)

    for cf in $catch_files; do
      # Find all catch block line numbers
      local catch_lines
      catch_lines=$(rg -n 'catch\s*\(' "$cf" 2>/dev/null || true)
      
      while IFS= read -r catch_line; do
        [[ -z "$catch_line" ]] && continue
        local ln; ln=$(echo "$catch_line" | cut -d: -f1)
        
        # Extract ~15 lines after catch to get the full block
        local block; block=$(sed -n "${ln},$((ln+15))p" "$cf" 2>/dev/null || true)
        
        # Check for allowlist patterns in the block
        local is_allowed=0
        
        # Allow if block contains throw/rethrow
        if echo "$block" | grep -qE 'throw\s|rethrow'; then
          is_allowed=1
        fi
        
        # Allow if block contains process.exit
        if echo "$block" | grep -qE 'process\.exit\('; then
          is_allowed=1
        fi
        
        # Allow if block has explicit audit allowlist comment
        if echo "$block" | grep -qiE '//.*AUDIT-ALLOW:|//.*safe to|//.*Ignore'; then
          is_allowed=1
        fi
        
        # Allow if block returns an error object (not null/[])
        if echo "$block" | grep -qE 'return\s+\{.*error|return\s+\{.*ok:\s*false'; then
          is_allowed=1
        fi
        
        # If not allowed, check if it's actually a problem (has console but no rethrow)
        if [[ "$is_allowed" -eq 0 ]]; then
          # Flag only if it has console/return but no proper error propagation
          if echo "$block" | grep -qE 'console\.|return\s+(null|undefined|\[\]|\{\})'; then
            local snippet; snippet=$(echo "$block" | head -5 | tr '\n' '|')
            _add_sf_finding "catch_silent_failure" "$cf" "$ln" "$snippet"
          fi
        fi
      done <<< "$catch_lines"
    done

    # ── Pattern 2: return null / return [] on error path ──────────────────
    local ret_null_hits
    ret_null_hits=$(rg -n --glob '!**/node_modules/**' --glob '*.ts' \
      'return\s+null\s*;\s*//.*error|return\s+\[\]\s*;\s*//.*error|catch.{0,50}return\s+(null|\[\]|\{\})' \
      "$scan_path" 2>/dev/null || true)
    if [[ -n "$ret_null_hits" ]]; then
      while IFS= read -r hit; do
        [[ -z "$hit" ]] && continue
        local fp; fp=$(echo "$hit" | cut -d: -f1)
        local ln; ln=$(echo "$hit" | cut -d: -f2)
        local ct; ct=$(echo "$hit" | cut -d: -f3-)
        _add_sf_finding "return_null_on_error" "$fp" "$ln" "$ct"
      done <<< "$(echo "$ret_null_hits" | head -20)"
    fi

    # ── Pattern 3: optional chaining on required fields without guard ──────
    local opt_chain_hits
    opt_chain_hits=$(rg -n --glob '!**/node_modules/**' --glob '*.ts' \
      '\?\.[a-zA-Z]+\s*[,;)]' "$scan_path" 2>/dev/null | \
      grep -v '\/\/' | head -30 || true)
    if [[ -n "$opt_chain_hits" ]]; then
      # Only flag if in context of export/canonical/hash computation
      while IFS= read -r hit; do
        [[ -z "$hit" ]] && continue
        local content; content=$(echo "$hit" | cut -d: -f3-)
        # Flag if the optional chain appears on fields like .data, .items, .issues
        if echo "$content" | grep -qE '\?\.(data|items|issues|results|hash|id|key|tenantId|cloudId|fields)'; then
          local fp; fp=$(echo "$hit" | cut -d: -f1)
          local ln; ln=$(echo "$hit" | cut -d: -f2)
          # This is a FLAG not FAIL (optional chaining is common; FLAG if on required schema fields)
          phase_flag "10" "MEDIUM" "Optional chaining on likely-required field without guard: ${content}" \
            "$findings_txt"
        fi
      done <<< "$opt_chain_hits"
    fi

    # ── Pattern 4: default fallbacks masking missing schema fields ─────────
    local default_fallback_hits
    default_fallback_hits=$(rg -n --glob '!**/node_modules/**' --glob '*.ts' \
      '\|\|\s*\[\]|\|\|\s*\{\}|\?\?\s*\[\]|\?\?\s*\{\}|\|\|\s*""|\|\|\s*0' \
      "$scan_path" 2>/dev/null | head -30 || true)
    if [[ -n "$default_fallback_hits" ]]; then
      while IFS= read -r hit; do
        [[ -z "$hit" ]] && continue
        local fp; fp=$(echo "$hit" | cut -d: -f1)
        local ln; ln=$(echo "$hit" | cut -d: -f2)
        local ct; ct=$(echo "$hit" | cut -d: -f3-)
        # Flag only in canonicalization/hash paths
        if echo "$fp" | grep -qiE 'canonical|hash|export|pack|ledger'; then
          phase_flag "10" "MEDIUM" "Default fallback on schema field in critical path may mask missing data: ${ct}" \
            "$findings_txt"
        fi
      done <<< "$default_fallback_hits"
    fi

  done

  # Write finding count
  local count
  count=$(jq '.findings | length' "$findings_json")
  echo "  Total FAIL-grade silent failure findings: ${count}" | tee -a "$findings_txt"

  if [[ "$failed" -eq 1 ]]; then
    phase_fail "10" \
      "Silent failure patterns found in export path (${count} findings). Catch blocks must rethrow; null returns hide errors." \
      "$findings_json"
  fi

  phase_pass "10" "Silent failure scan: no critical patterns found in export path."
}

export -f run_silent_failures
