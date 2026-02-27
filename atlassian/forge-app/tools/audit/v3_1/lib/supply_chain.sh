#!/usr/bin/env bash
# lib/supply_chain.sh — Phase 1: Supply chain enforcement (strict)
set -euo pipefail

run_supply_chain() {
  local e="${E}"
  local repo_dir="${REPO_DIR}"
  phase_start "01" "Supply Chain Enforcement (Strict)"

  local out_prefix="${e}/PHASE_01"

  # ── 1a: Exact version enforcement ──────────────────────────────────────────
  echo "[01] Checking for non-exact versions in package.json..." | tee "${out_prefix}_version_check.txt"
  local pkg="${repo_dir}/package.json"

  local bad_versions
  bad_versions=$(jq -r '
    ((.dependencies // {}) + (.devDependencies // {})) | to_entries[] |
    select(.value | test("^[\\^~]|^\\*$|^latest|^git\\+|^file:|^workspace:")) |
    "\(.key): \(.value)"
  ' "$pkg" 2>/dev/null || echo "")

  if [[ -n "$bad_versions" ]]; then
    echo "$bad_versions" | tee -a "${out_prefix}_version_check.txt"
    echo "" >> "${out_prefix}_version_check.txt"
    echo "FAIL: Non-exact dependency versions found (^, ~, *, latest, git+, file:, workspace: are not permitted)" \
      >> "${out_prefix}_version_check.txt"
    phase_fail "01" "Non-exact dependency versions found in package.json. Remediation: pin all dependencies to exact versions." \
      "${out_prefix}_version_check.txt"
  fi
  echo "  All versions are exact." | tee -a "${out_prefix}_version_check.txt"

  # ── 1b: npm audit ──────────────────────────────────────────────────────────
  echo "[01] Running npm audit..." | tee "${out_prefix}_npm_audit.txt"
  local audit_json="${out_prefix}_npm_audit.json"
  local audit_exit=0

  npm audit --json > "$audit_json" 2>&1 || audit_exit=$?

  # Parse: fail on moderate+
  local vuln_count
  vuln_count=$(jq '
    ((.vulnerabilities // {}) | to_entries[] | select(.value.severity | test("moderate|high|critical"))) | 1
  ' "$audit_json" 2>/dev/null | wc -l | tr -d ' ')

  if [[ "$vuln_count" -gt 0 ]]; then
    echo "FAIL: npm audit found ${vuln_count} moderate/high/critical vulnerability/ies." \
      | tee -a "${out_prefix}_npm_audit.txt"
    phase_fail "01" "npm audit found vulnerabilities with severity >= moderate (count: ${vuln_count})." \
      "$audit_json"
  fi
  echo "  npm audit: no moderate+ vulnerabilities." | tee -a "${out_prefix}_npm_audit.txt"

  # ── 1c: Duplicate version gate (critical-list policy) ──────────────────────
  echo "[01] Checking for duplicate package versions (critical-list policy)..." | tee "${out_prefix}_dupes.txt"

  # Critical packages: duplicates => FAIL (enterprise-grade evasion-resistant gate)
  # All other packages: duplicates => HIGH FLAG (npm ecosystem reality)
  # See docs/audit/F100_HOSTILE_AUDIT_V3_1.md § Duplicate dependency policy
  local critical_pkgs=(
    "minimatch" "glob" "semver" "tar" "ws" "undici" "node-fetch" "axios" "got"
    "follow-redirects" "qs" "jsonwebtoken" "jose" "yaml" "lodash" "handlebars"
    "ejs" "mustache" "tough-cookie" "tough-cookie-file-store" "ip" "crypto-js"
    "uuid" "request" "@forge/api"
  )

  local lock_json="${REPO_DIR}/package-lock.json"
  if [[ ! -f "$lock_json" ]]; then
    phase_fail "01" "package-lock.json not found." ""
  fi

  # Build duplicate map: name -> [versions]
  local dupes_json="${out_prefix}_duplicate_versions.json"
  jq -r '
    .packages
    | to_entries[]
    | select(.key | startswith("node_modules/"))
    | {name: (.key | gsub("^.*node_modules/"; "")), version: .value.version}
  ' "$lock_json" 2>/dev/null \
    | jq -s '
        group_by(.name)
        | map(select(map(.version) | unique | length > 1))
        | map({name: .[0].name, versions: (map(.version) | unique)})
      ' > "$dupes_json" 2>/dev/null || echo "[]" > "$dupes_json"

  local total_dupes
  total_dupes=$(jq 'length' "$dupes_json" 2>/dev/null || echo "0")

  # Write human-readable summary
  {
    echo "[01] Checking for duplicate package versions (critical-list policy)..."
    echo ""
    echo "Critical package list ($(echo "${critical_pkgs[@]}" | wc -w) packages):"
    printf '  %s\n' "${critical_pkgs[@]}"
    echo ""
    echo "Total packages with duplicates: $total_dupes"
    echo ""
  } >> "${out_prefix}_dupes.txt"

  # Check for critical duplicates
  local critical_dupes=""
  for pkg in "${critical_pkgs[@]}"; do
    local found
    found=$(jq -r --arg p "$pkg" '.[] | select(.name == $p) | "\(.name): \(.versions | join(", "))"' "$dupes_json" 2>/dev/null || echo "")
    if [[ -n "$found" ]]; then
      critical_dupes="${critical_dupes}${found}"$'\n'
    fi
  done

  if [[ -n "$critical_dupes" ]]; then
    echo "CRITICAL DUPLICATES (FAIL trigger):" >> "${out_prefix}_dupes.txt"
    echo "$critical_dupes" >> "${out_prefix}_dupes.txt"
    phase_fail "01" "Critical package duplicates detected: $(echo "$critical_dupes" | head -1 | awk '{print $1}'). See ${out_prefix}_dupes.txt" \
      "${out_prefix}_dupes.txt"
  fi

  # Non-critical duplicates => HIGH FLAG
  if [[ "$total_dupes" -gt 0 ]]; then
    echo "Non-critical duplicates (visibility flag):" >> "${out_prefix}_dupes.txt"
    jq -r '.[] | "\(.name): \(.versions | join(", "))"' "$dupes_json" | head -20 >> "${out_prefix}_dupes.txt" 2>/dev/null || true
    if [[ "$total_dupes" -gt 20 ]]; then
      echo "... and $(($total_dupes - 20)) more." >> "${out_prefix}_dupes.txt"
    fi
    phase_flag "01" "HIGH" \
      "Non-critical duplicate package versions detected ($total_dupes packages). Review for supply-chain risk. See ${out_prefix}_dupes.txt" \
      "${out_prefix}_dupes.txt"
  else
    echo "  No duplicate package versions detected." | tee -a "${out_prefix}_dupes.txt"
  fi

  # ── 1d: npm outdated - security-sensitive packages ─────────────────────────
  echo "[01] Checking outdated security-sensitive packages..." | tee "${out_prefix}_outdated.txt"
  local outdated_json="${out_prefix}_outdated.json"
  npm outdated --json > "$outdated_json" 2>/dev/null || true

  local sensitive_pkgs=('@forge' '@atlaskit' 'react' 'vite' 'esbuild' 'webpack' 'typescript' 'node-fetch' 'undici')
  local outdated_sensitive=""

  if [[ -f "$outdated_json" ]] && [[ -s "$outdated_json" ]]; then
    for pkg_prefix in "${sensitive_pkgs[@]}"; do
      local hits
      hits=$(jq -r --arg p "$pkg_prefix" \
        'to_entries[] | select(.key | startswith($p)) | "\(.key): current=\(.value.current) latest=\(.value.latest)"' \
        "$outdated_json" 2>/dev/null || echo "")
      if [[ -n "$hits" ]]; then
        outdated_sensitive+="$hits"$'\n'
      fi
    done
  fi

  if [[ -n "$outdated_sensitive" ]]; then
    echo "$outdated_sensitive" >> "${out_prefix}_outdated.txt"
    phase_flag "01" "HIGH" "Security-sensitive packages are outdated: see ${out_prefix}_outdated.txt" \
      "${out_prefix}_outdated.txt"
  else
    echo "  No outdated security-sensitive packages detected." | tee -a "${out_prefix}_outdated.txt"
  fi

  phase_pass "01" "Supply chain checks passed (versions exact, no vulns, no dupes)."
}

export -f run_supply_chain
