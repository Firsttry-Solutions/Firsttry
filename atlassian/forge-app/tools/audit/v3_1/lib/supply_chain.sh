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

  # ── 1c: Duplicate version gate ─────────────────────────────────────────────
  echo "[01] Checking for duplicate package versions..." | tee "${out_prefix}_dupes.txt"
  local ls_json="${out_prefix}_npm_ls.json"
  npm ls --all --json > "$ls_json" 2>/dev/null || true

  # Extract all packages and their versions, find names with >1 distinct version
  local dupes
  dupes=$(jq -r '
    [.. | objects | select(has("version")) | {name: .name?, version: .version?}]
    | group_by(.name)
    | map(select(. | map(.version) | unique | length > 1))
    | map("\(.[0].name): \(map(.version) | unique | join(", "))")[]
  ' "$ls_json" 2>/dev/null || echo "")

  if [[ -n "$dupes" ]]; then
    echo "$dupes" >> "${out_prefix}_dupes.txt"
    phase_fail "01" "Duplicate package versions detected. Remediation: resolve version conflicts." \
      "${out_prefix}_dupes.txt"
  fi
  echo "  No duplicate package versions." | tee -a "${out_prefix}_dupes.txt"

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
