#!/usr/bin/env bash
# lib/exfiltration.sh — Phase 4: Outbound network / telemetry (hard fail)
set -euo pipefail

run_exfiltration() {
  local e="${E}"
  local repo_dir="${REPO_DIR}"
  phase_start "04" "Outbound Network / Telemetry (Hard Fail)"

  local findings_json="${e}/PHASE_04_exfil_findings.json"
  local summary_txt="${e}/PHASE_04_exfil_summary.txt"

  # Initialize findings
  echo '{"findings":[]}' > "$findings_json"

  # Precision patterns v3.1 — actual function calls only, not comments/strings
  local network_patterns=(
    '\bfetch\s*\('  # Actual fetch calls (word boundary)
    '\baxios\.\w+\('  # Actual axios method calls (axios.get, axios.post, etc.)
    '\bhttp\.request\s*\('  # Actual http.request calls
    '\bhttps\.request\s*\('  # Actual https.request calls
    '\bnew\s+WebSocket\s*\('  # Actual WebSocket instantiation
    '\bnew\s+XMLHttpRequest\s*\('  # Actual XMLHttpRequest instantiation
  )

  # Precision telemetry patterns — actual package usage, not domain terms
  local telemetry_patterns=(
    '@sentry/\w+'  # Actual Sentry SDK imports
    'Sentry\.\w+\('  # Actual Sentry API calls (not just Sentry.)
    '\bmixpanel\.\w+\('  # Actual Mixpanel calls
    '@segment/\w+'  # Actual Segment SDK imports
    'analytics\.load\('  # Actual analytics.js initialization
    'gtag\('  # Google Analytics gtag calls
    '\bga\('  # Google Analytics ga calls (not random ga( in words)
    'datadog-\w+'  # Datadog packages
    '\bDDTrace\.\w+'  # Datadog tracing API (not just "Trace")
    'newrelic\.start'  # New Relic initialization
    'amplitude\.\w+\('  # Actual Amplitude calls
  )

  local failed=0
  echo "[04] Scanning src/** for network/telemetry patterns (excluding Forge-sanctioned APIs)..." \
    | tee "$summary_txt"

  # Combined scan target: src/** but NOT node_modules
  local scan_dirs=("${repo_dir}/src")

  _add_finding() {
    local file="$1" pattern="$2" line_content="$3"
    jq --arg f "$file" --arg p "$pattern" --arg l "$line_content" \
      '.findings += [{"file":$f,"pattern":$p,"line":$l}]' \
      "$findings_json" > "${findings_json}.tmp" && mv "${findings_json}.tmp" "$findings_json"
  }

  for dir in "${scan_dirs[@]}"; do
    [[ -d "$dir" ]] || continue

    # Network patterns
    for pat in "${network_patterns[@]}"; do
      local hits
      hits=$(rg -n --glob '!**/node_modules/**' --glob '*.ts' --glob '*.js' \
        -P "$pat" "$dir" 2>/dev/null || true)

      if [[ -n "$hits" ]]; then
        # Filter: allow only lines that also import from @forge/api
        while IFS= read -r hit_line; do
          local filepath
          filepath=$(echo "$hit_line" | cut -d: -f1)
          local lineno
          lineno=$(echo "$hit_line" | cut -d: -f2 || echo "?")
          local content
          content=$(echo "$hit_line" | cut -d: -f3- || echo "")

          # Exclude comments (lines starting with // or within /* */)
          if echo "$content" | grep -qE '^\s*(//|/\*|\*)'; then
            continue
          fi
          
          # Exclude string literals defining patterns (e.g., security scan definitions)
          if echo "$content" | grep -qE '(re:|regex:|pattern:)\s*[/\[{]'; then
            continue
          fi
          
          # Exclude same-origin fetch calls (window.location.href)
          if echo "$content" | grep -qE 'fetch\s*\(\s*window\.location'; then
            continue
          fi

          # Check if file uses @forge/api import
          local is_forge_sanctioned=0
          grep -q "from '@forge/api'" "$filepath" 2>/dev/null && is_forge_sanctioned=1 || true
          grep -q 'from "@forge/api"' "$filepath" 2>/dev/null && is_forge_sanctioned=1 || true

          # Even if @forge/api is imported, non-forge fetch calls are suspicious
          # Allow: requestJira, requestConfluence from @forge/api
          local is_forge_call=0
          echo "$content" | grep -qE 'requestJira|requestConfluence' && is_forge_call=1 || true

          if [[ "$is_forge_call" -eq 0 ]]; then
            echo "  [NETWORK] ${filepath}:${lineno} - ${content}" | tee -a "$summary_txt"
            _add_finding "$filepath" "$pat" "${lineno}: ${content}"
            failed=1
          fi
        done <<< "$hits"
      fi
    done

    # Telemetry patterns (always fail — no whitelist)
    for pat in "${telemetry_patterns[@]}"; do
      local hits
      hits=$(rg -in --glob '!**/node_modules/**' --glob '*.ts' --glob '*.js' \
        -P "$pat" "$dir" 2>/dev/null || true)
      if [[ -n "$hits" ]]; then
        # Filter out comments and test files
        local filtered_hits=""
        while IFS= read -r hit_line; do
          local fp; fp=$(echo "$hit_line" | cut -d: -f1)
          local lc; lc=$(echo "$hit_line" | cut -d: -f2-)
          
          # Exclude test files
          if echo "$fp" | grep -qE '(\.test\.|\.spec\.|/test_)'; then
            continue
          fi
          
          # Exclude comments
          local content; content=$(echo "$lc" | cut -d: -f2-)
          if echo "$content" | grep -qE '^\s*(//|/\*|\*)'; then
            continue
          fi
          
          filtered_hits="${filtered_hits}${hit_line}\n"
        done <<< "$hits"
        
        if [[ -n "$filtered_hits" ]] && [[ "$filtered_hits" != "\n" ]]; then
          echo "  [TELEMETRY] Pattern '${pat}' found:" | tee -a "$summary_txt"
          echo -e "$filtered_hits" | head -5 | tee -a "$summary_txt"
          while IFS= read -r hit_line; do
            [[ -z "$hit_line" ]] && continue
            local fp; fp=$(echo "$hit_line" | cut -d: -f1)
            local lc; lc=$(echo "$hit_line" | cut -d: -f2-)
            _add_finding "$fp" "$pat" "$lc"
          done <<< "$(echo -e "$filtered_hits")"
          failed=1
        fi
      fi
    done
  done

  # Also scan node_modules for telemetry beacon injection
  echo "[04] Scanning node_modules for embedded telemetry beacons..." | tee -a "$summary_txt"
  for pat in "${telemetry_patterns[@]}"; do
    local nm_hits
    nm_hits=$(rg -rl --glob '*.js' "$pat" "${repo_dir}/node_modules" 2>/dev/null | \
      grep -v '\.map$' | head -10 || true)
    if [[ -n "$nm_hits" ]]; then
      echo "  [NM TELEMETRY] ${pat}: $(echo "$nm_hits" | wc -l) files" | tee -a "$summary_txt"
      echo "$nm_hits" >> "$summary_txt"
      # This is a FLAG, not a FAIL (third-party deps may have dev telemetry hooks)
      phase_flag "04" "MEDIUM" "Telemetry pattern '${pat}' found in node_modules (may be dev dependency)" \
        "$summary_txt"
    fi
  done

  if [[ "$failed" -eq 1 ]]; then
    local count
    count=$(jq '.findings | length' "$findings_json")
    phase_fail "04" "Non-Forge-sanctioned outbound network/telemetry call(s) found in src/** (${count} findings). Whitelist: only requestJira/requestConfluence from @forge/api." \
      "$findings_json"
  fi

  local total_findings
  total_findings=$(jq '.findings | length' "$findings_json")
  echo "  Total non-whitelisted network findings: ${total_findings}" | tee -a "$summary_txt"
  phase_pass "04" "No non-Forge-sanctioned outbound network or telemetry patterns in src/**."
}

export -f run_exfiltration
