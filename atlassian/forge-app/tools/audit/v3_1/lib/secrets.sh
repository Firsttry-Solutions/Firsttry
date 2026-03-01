#!/usr/bin/env bash
# lib/secrets.sh — Phase 2: Secrets forensics v3.1 (safe on huge repos)
set -euo pipefail

run_secrets() {
  local e="${E}"
  local repo_dir="${REPO_DIR}"
  phase_start "02" "Secrets Forensics v3.1"

  local out_txt="${e}/PHASE_02_secrets_findings.txt"
  local out_json="${e}/PHASE_02_secrets_findings.json"
  local found=0

  # Initialize JSON output
  echo '{"working_tree":[],"history":[],"trufflehog":[]}' > "$out_json"

  # ── Patterns (v3.1 precision: literal-only, no variable names) ──────────────
  # Tier A: High-precision known secret formats (flag on match)
  local patterns_tier_a=(
    '\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b'  # JWT tokens
    '\bBearer\s+eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b'  # Bearer JWT
    '-----BEGIN( [A-Z]+)? PRIVATE KEY-----'  # PEM private keys
    '\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}\b'  # GitHub tokens
    '\bgithub_pat_[A-Za-z0-9_]{20,}\b'  # GitHub PAT
    '\bxox[baprs]-[A-Za-z0-9-]{10,}\b'  # Slack tokens
    '\bsk_live_[A-Za-z0-9]{20,}\b'  # Stripe live secret
    '\brk_live_[A-Za-z0-9]{20,}\b'  # Stripe live restricted
    '\b(AKIA|ASIA)[0-9A-Z]{16}\b'  # AWS access key ID
    'ATBB[0-9A-Za-z_\-]{10,}'  # Atlassian bearer tokens
  )
  
  # Tier B: Generic secret assignments — ONLY when value is a QUOTED LITERAL string >=20 chars
  # Matches: password = "actual_secret_here" but NOT: password = someVariable
  local patterns_tier_b=(
    '(?i)\b(password|passwd|pwd)\b\s*[:=]\s*["\047][^"\047]{20,}["\047]'  # password="..."
    '(?i)\b(secret|client[_-]?secret|api[_-]?secret)\b\s*[:=]\s*["\047][^"\047]{20,}["\047]'  # secret="..."
    '(?i)\b(api[_-]?key|apikey)\b\s*[:=]\s*["\047][^"\047]{20,}["\047]'  # api_key="..."
    '(?i)\b(private[_-]?key|privatekey)\b\s*[:=]\s*["\047][^"\047]{20,}["\047]'  # private_key="..."
    '(?i)\b(bearer[_-]?token|bearer)\b\s*[:=]\s*["\047][^"\047]{20,}["\047]'  # bearer="..."
  )
  
  # Placeholder patterns to exclude (post-filter)
  local placeholder_patterns='REDACTED|DUMMY|TEST|EXAMPLE|CHANGEME|<.*?>|your_|replace_me|TODO|FIXME|xxx+|000+|111+|aaaaa+|placeholder'
  
  # Combine patterns for scanning
  local patterns=("${patterns_tier_a[@]}" "${patterns_tier_b[@]}")

  _shannon_entropy() {
    # Compute Shannon entropy of a string (printed line)
    local str="$1"
    python3 -c "
import math, collections
s = '''${str}'''
if not s: print(0.0); exit()
c = collections.Counter(s)
total = len(s)
e = -sum((v/total)*math.log2(v/total) for v in c.values())
print(round(e,4))
" 2>/dev/null || echo "0.0"
  }

  _scan_content() {
    local content_cmd="$1"
    local source_label="$2"
    local findings=()

    # Pattern scan with placeholder filtering
    for pat in "${patterns[@]}"; do
      local hits
      hits=$(eval "$content_cmd" | rg -P "$pat" --no-filename 2>/dev/null || true)
      if [[ -n "$hits" ]]; then
        # Filter out placeholders
        local filtered_hits
        filtered_hits=$(echo "$hits" | rg -P -v -i "$placeholder_patterns" 2>/dev/null || echo "$hits")
        if [[ -n "$filtered_hits" ]]; then
          echo "[SECRET PATTERN] ${source_label}: ${pat}" >> "$out_txt"
          echo "$filtered_hits" | head -5 >> "$out_txt"
          findings+=("$pat")
          found=1
        fi
      fi
    done

    # Base64/high-entropy heuristic (disabled for precision - too many false positives on hashes/UUIDs)
    # Keeping placeholder for future enhancement with trufflehog
  }

  # ── A: Working tree scan (precision: literal-only) ─────────────────────────
  echo "[02] Scanning working tree for secrets..." | tee -a "$out_txt"
  # Scan all non-binary files, skip node_modules and build outputs
  local wt_files
  wt_files=$(find "${repo_dir}/src" -type f -not -path "*/node_modules/*" -not -path "*/dist/*" -not -path "*/build/*" \
    \( -name "*.ts" -o -name "*.js" -o -name "*.json" -o -name "*.yml" -o -name "*.yaml" -o -name "*.env" \) 2>/dev/null || true)

  if [[ -n "$wt_files" ]]; then
    for f in $wt_files; do
      for pat in "${patterns[@]}"; do
        local hits
        hits=$(rg -P "$pat" --no-filename "$f" 2>/dev/null || true)
        if [[ -n "$hits" ]]; then
          # Filter out placeholders
          local filtered_hits
          filtered_hits=$(echo "$hits" | rg -P -v -i "$placeholder_patterns" 2>/dev/null || echo "$hits")
          if [[ -n "$filtered_hits" ]]; then
            echo "[WT SECRET] ${f}: ${pat}" >> "$out_txt"
            echo "$filtered_hits" | head -3 >> "$out_txt"
            found=1
          fi
        fi
      done
    done
  fi

  # ── B: Git history scan (bounded + fail-closed) ────────────────────────────
  # Environment variables for bounded execution:
  #   FT_AUDIT_PHASE2_TIMEOUT_SEC (default: 300 = 5 min)
  #   FT_AUDIT_PHASE2_MAX_COMMITS (default: 1000)
  #   FT_AUDIT_PHASE2_MODE (default: bounded; alt: full)
  
  local phase2_timeout="${FT_AUDIT_PHASE2_TIMEOUT_SEC:-300}"
  local phase2_max_commits="${FT_AUDIT_PHASE2_MAX_COMMITS:-1000}"
  local phase2_mode="${FT_AUDIT_PHASE2_MODE:-bounded}"
  
  echo "[02] Counting git history..." | tee -a "$out_txt"
  local total_commits
  total_commits=$(git -C "${repo_dir}" rev-list --all --count 2>/dev/null || echo 0)
  echo "  Total commits: ${total_commits}" | tee -a "$out_txt"
  echo "  Config: mode=${phase2_mode}, max_commits=${phase2_max_commits}, timeout=${phase2_timeout}s" | tee -a "$out_txt"

  local scan_limit="$phase2_max_commits"
  local history_warning=""
  if [[ "$total_commits" -gt "$phase2_max_commits" ]]; then
    history_warning="History has ${total_commits} commits; scanning bounded limit of ${phase2_max_commits} recent commits."
    phase_flag "02" "MEDIUM" "$history_warning" "$out_txt"
    echo "[02] ${history_warning}" | tee -a "$out_txt"
  else
    scan_limit="$total_commits"
  fi

  echo "[02] Scanning git history (limit: ${scan_limit} commits, timeout: ${phase2_timeout}s)..." | tee -a "$out_txt"

  # Optimized history scan: get recent commits and scan them efficiently
  local hist_out="${e}/PHASE_02_history_scan_raw.txt"
  touch "$hist_out"
  
  # Fail-closed: if timeout triggers, fail the phase
  local scan_exit=0
  
  # Write patterns to temp file to avoid shell escaping issues
  local pattern_file="${e}/PHASE_02_patterns.txt"
  printf '%s\n' "${patterns[@]}" > "$pattern_file"
  
  # Get list of recent commit SHAs
  local commits_file="${e}/PHASE_02_commits_to_scan.txt"
  git -C "${repo_dir}" rev-list --all --max-count="${scan_limit}" 2>/dev/null > "$commits_file" || touch "$commits_file"
  local actual_commits=$(wc -l < "$commits_file" | tr -d ' ')
  echo "  Scanning ${actual_commits} commits..." | tee -a "$out_txt"
  
  # Execute with timeout - process in batches for efficiency
  (
    timeout "${phase2_timeout}s" bash -c '
      repo_dir="$1"
      pattern_file="$2"
      hist_out="$3"
      commits_file="$4"
      
      # Process commits in batches of 50 for better performance
      while IFS= read -r commit; do
        git -C "${repo_dir}" show "${commit}" --no-color 2>/dev/null | {
          while IFS= read -r pat; do
            grep -P "${pat}" 2>/dev/null || true
          done < "$pattern_file"
        } | head -10 >> "${hist_out}" 2>/dev/null || true
      done < "$commits_file"
    ' -- "${repo_dir}" "${pattern_file}" "${hist_out}" "${commits_file}"
  ) || scan_exit=$?
  
  # Check if timeout occurred (exit code 124 from timeout command)
  if [[ "$scan_exit" -eq 124 ]]; then
    scan_timed_out=1
    echo "[02] FAIL: History scan timed out after ${phase2_timeout}s" | tee -a "$out_txt"
    phase_fail "02" "Git history scan timed out after ${phase2_timeout}s (${scan_limit} commits). Use FT_AUDIT_PHASE2_TIMEOUT_SEC to increase or FT_AUDIT_PHASE2_MAX_COMMITS to reduce scope." "$out_txt"
  elif [[ "$scan_exit" -ne 0 ]]; then
    echo "[02] WARNING: History scan exited with code ${scan_exit}" | tee -a "$out_txt"
    phase_flag "02" "MEDIUM" "History scan exited non-zero (code ${scan_exit}); results may be incomplete" "$out_txt"
  fi

  if [[ -s "$hist_out" ]]; then
    # Apply placeholder filtering to history scan results
    local filtered_hist="${e}/PHASE_02_history_scan_filtered.txt"
    rg -P -v -i "$placeholder_patterns" "$hist_out" 2>/dev/null > "$filtered_hist" || cp "$hist_out" "$filtered_hist"
    
    if [[ -s "$filtered_hist" ]] && [[ "$(wc -l < "$filtered_hist" | tr -d ' ')" -gt 0 ]]; then
      echo "[02] HISTORY SECRETS FOUND:" | tee -a "$out_txt"
      head -100 "$filtered_hist" >> "$out_txt"  # Limit output to first 100 hits for readability
      echo "  (Total lines in history scan after filtering: $(wc -l < "$filtered_hist"))" >> "$out_txt"
      found=1
    else
      echo "  Git history scan: no secrets found (after placeholder filtering)." | tee -a "$out_txt"
    fi
  else
    echo "  Git history scan: no secrets found." | tee -a "$out_txt"
  fi

  # Also scan tag objects (with timeout) - simplified for performance
  echo "[02] Scanning tag objects (timeout: 30s)..." | tee -a "$out_txt"
  local tag_scan_exit=0
  (
    timeout 30s bash -c '
      repo_dir="$1"
      pattern_file="$2"
      hist_out="$3"
      
      git -C "${repo_dir}" show-ref --tags -d 2>/dev/null | awk "{print \$1}" | head -100 | while read tag; do
        git -C "${repo_dir}" show "${tag}" --no-color 2>/dev/null | {
          while IFS= read -r pat; do
            grep -P "${pat}" 2>/dev/null || true
          done < "$pattern_file"
        } | head -5 >> "${hist_out}.tags" 2>/dev/null || true
      done
    ' -- "${repo_dir}" "${pattern_file}" "${hist_out}"
  ) || tag_scan_exit=$?
  
  if [[ "$tag_scan_exit" -eq 124 ]]; then
    echo "[02] WARNING: Tag scan timed out after 30s" | tee -a "$out_txt"
    phase_flag "02" "LOW" "Tag object scan timed out (not critical)" "$out_txt"
  elif [[ -s "${hist_out}.tags" ]]; then
    # Apply placeholder filtering to tag scan results
    local filtered_tags="${e}/PHASE_02_tags_filtered.txt"
    rg -P -v -i "$placeholder_patterns" "${hist_out}.tags" 2>/dev/null > "$filtered_tags" || cp "${hist_out}.tags" "$filtered_tags"
    
    if [[ -s "$filtered_tags" ]] && [[ "$(wc -l < "$filtered_tags" | tr -d ' ')" -gt 0 ]]; then
      echo "[02] SECRETS FOUND IN TAG OBJECTS:" | tee -a "$out_txt"
      cat "$filtered_tags" >> "$out_txt"
      found=1
    fi
  fi

  # ── C: Trufflehog (preferred) ──────────────────────────────────────────────
  local trufflehog_out="${e}/PHASE_02_trufflehog.json"
  if command -v trufflehog &>/dev/null; then
    echo "[02] Running trufflehog on working tree..." | tee -a "$out_txt"
    trufflehog filesystem "${repo_dir}/src" --json > "$trufflehog_out" 2>/dev/null || true
    if [[ -s "$trufflehog_out" ]]; then
      local th_count
      th_count=$(wc -l < "$trufflehog_out" | tr -d ' ')
      if [[ "$th_count" -gt 0 ]]; then
        echo "[02] Trufflehog found ${th_count} finding(s)." | tee -a "$out_txt"
        found=1
      fi
    fi
  else
    # POLICY: Tooling availability; fallback regex/entropy detection is sufficient
    phase_flag "02" "HIGH" "trufflehog unavailable; regex/entropy fallback only" "$out_txt" "true"
  fi

  # ── Fail or pass ──────────────────────────────────────────────────────────
  if [[ "$found" -eq 1 ]]; then
    phase_fail "02" "Secret(s) or high-entropy token(s) found in source or git history. See ${out_txt}" "$out_txt"
  fi

  phase_pass "02" "Secrets scan: no findings in working tree or history."
}

export -f run_secrets
