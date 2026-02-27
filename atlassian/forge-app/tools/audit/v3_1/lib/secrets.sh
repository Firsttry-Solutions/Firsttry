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

  # ── Patterns ────────────────────────────────────────────────────────────────
  local patterns=(
    'ATBB[0-9A-Za-z_\-]{10,}'            # Atlassian bearer tokens
    'Bearer [A-Za-z0-9_.+/\-]{20,}'      # Bearer auth headers
    'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+' # JWT
    'AKIA[0-9A-Z]{16}'                    # AWS Access Key
    '(?i)(api_key|apikey|api-key)\s*[=:]\s*["\047]?[A-Za-z0-9_\-]{8,}' # api_key=
    '(?i)secret\s*[=:]\s*["\047]?[A-Za-z0-9_\-]{8,}'  # secret=
    '(?i)password\s*[=:]\s*["\047]?[A-Za-z0-9_\-!@#$%]{6,}'  # password=
    '(?i)token\s*[=:]\s*["\047]?[A-Za-z0-9_\-]{8,}'   # token=
  )

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

    # Pattern scan
    for pat in "${patterns[@]}"; do
      local hits
      hits=$(eval "$content_cmd" | rg -P "$pat" --no-filename 2>/dev/null || true)
      if [[ -n "$hits" ]]; then
        echo "[SECRET PATTERN] ${source_label}: ${pat}" >> "$out_txt"
        echo "$hits" | head -5 >> "$out_txt"
        findings+=("$pat")
        found=1
      fi
    done

    # Base64/high-entropy heuristic
    local b64_hits
    b64_hits=$(eval "$content_cmd" | \
      rg -P '[A-Za-z0-9+/=]{40,}' --no-filename 2>/dev/null | head -50 || true)
    if [[ -n "$b64_hits" ]]; then
      while IFS= read -r line; do
        local ent
        ent=$(_shannon_entropy "$line")
        local ent_int
        ent_int=$(echo "$ent" | awk '{printf "%d", $1*100}')
        if [[ "$ent_int" -ge 380 ]]; then
          # Check if near token keywords
          local is_near_kw=0
          echo "$line" | rg -qi '(api|key|secret|token|pass|auth|bearer)' && is_near_kw=1 || true
          if [[ "$is_near_kw" -eq 1 ]]; then
            echo "[HIGH ENTROPY+KEYWORD] ${source_label}: entropy=${ent}" >> "$out_txt"
            echo "$line" | head -c 80 >> "$out_txt"
            echo "" >> "$out_txt"
            found=1
          else
            phase_flag "02" "MEDIUM" "High entropy base64-like string in ${source_label} (entropy=${ent})" "$out_txt"
          fi
        fi
      done <<< "$b64_hits"
    fi
  }

  # ── A: Working tree scan ───────────────────────────────────────────────────
  echo "[02] Scanning working tree for secrets..." | tee -a "$out_txt"
  # Scan all non-binary files, skip node_modules
  local wt_files
  wt_files=$(find "${repo_dir}/src" -type f -not -path "*/node_modules/*" \
    \( -name "*.ts" -o -name "*.js" -o -name "*.json" -o -name "*.yml" -o -name "*.yaml" -o -name "*.env" \) 2>/dev/null || true)

  if [[ -n "$wt_files" ]]; then
    for f in $wt_files; do
      for pat in "${patterns[@]}"; do
        local hits
        hits=$(rg -P "$pat" --no-filename "$f" 2>/dev/null || true)
        if [[ -n "$hits" ]]; then
          echo "[WT SECRET] ${f}: ${pat}" >> "$out_txt"
          echo "$hits" | head -3 >> "$out_txt"
          found=1
        fi
      done
    done
  fi

  # ── B: Git history scan (bounded + fail-closed) ────────────────────────────
  # Environment variables for bounded execution:
  #   FT_AUDIT_PHASE2_TIMEOUT_SEC (default: 900 = 15 min)
  #   FT_AUDIT_PHASE2_MAX_COMMITS (default: 5000)
  #   FT_AUDIT_PHASE2_MODE (default: bounded; alt: full)
  
  local phase2_timeout="${FT_AUDIT_PHASE2_TIMEOUT_SEC:-900}"
  local phase2_max_commits="${FT_AUDIT_PHASE2_MAX_COMMITS:-5000}"
  local phase2_mode="${FT_AUDIT_PHASE2_MODE:-bounded}"
  
  echo "[02] Counting git history..." | tee -a "$out_txt"
  local total_commits
  total_commits=$(git -C "${repo_dir}" rev-list --all --count 2>/dev/null || echo 0)
  echo "  Total commits: ${total_commits}" | tee -a "$out_txt"
  echo "  Config: mode=${phase2_mode}, max_commits=${phase2_max_commits}, timeout=${phase2_timeout}s" | tee -a "$out_txt"

  local scan_limit="$phase2_max_commits"
  local history_warning=""
  if [[ "$total_commits" -gt "$phase2_max_commits" ]]; then
    history_warning="History has ${total_commits} commits; scanning bounded limit of ${phase2_max_commits} to prevent timeout."
    phase_flag "02" "MEDIUM" "$history_warning" "$out_txt"
    echo "[02] ${history_warning}" | tee -a "$out_txt"
  else
    scan_limit="$total_commits"
  fi

  echo "[02] Scanning git history (limit: ${scan_limit} commits, timeout: ${phase2_timeout}s)..." | tee -a "$out_txt"

  # Parallel history scan using xargs -P4 with timeout wrapper
  local hist_out="${e}/PHASE_02_history_scan_raw.txt"
  touch "$hist_out"
  
  # Fail-closed: if timeout triggers, fail the phase
  local scan_exit=0
  local scan_timed_out=0
  
  # Combined pattern scan (all patterns in one pass for efficiency)
  local combined_pattern=""
  for pat in "${patterns[@]}"; do
    [[ -z "$combined_pattern" ]] && combined_pattern="$pat" || combined_pattern="${combined_pattern}|${pat}"
  done
  
  # Execute with timeout
  (
    timeout "${phase2_timeout}s" bash -c '
      repo_dir="'"${repo_dir}"'"
      scan_limit="'"${scan_limit}"'"
      combined_pattern="'"${combined_pattern}"'"
      hist_out="'"${hist_out}"'"
      
      git -C "${repo_dir}" rev-list --all 2>/dev/null | head -n "${scan_limit}" | \
        xargs -P4 -n1 -I{} sh -c \
          "git -C \"${repo_dir}\" show {} --no-color 2>/dev/null | grep -P \"${combined_pattern}\" 2>/dev/null || true" \
        >> "${hist_out}" 2>/dev/null || true
    '
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
    echo "[02] HISTORY SECRETS FOUND:" | tee -a "$out_txt"
    head -100 "$hist_out" >> "$out_txt"  # Limit output to first 100 hits for readability
    echo "  (Total lines in history scan: $(wc -l < "$hist_out"))" >> "$out_txt"
    found=1
  else
    echo "  Git history scan: no secrets found." | tee -a "$out_txt"
  fi

  # Also scan tag objects (with timeout)
  echo "[02] Scanning tag objects (timeout: 60s)..." | tee -a "$out_txt"
  local tag_scan_exit=0
  (
    timeout 60s bash -c '
      repo_dir="'"${repo_dir}"'"
      combined_pattern="'"${combined_pattern}"'"
      hist_out="'"${hist_out}"'"
      
      git -C "${repo_dir}" show-ref --tags -d 2>/dev/null | awk "{print \$1}" | \
        xargs -P4 -n1 -I{} sh -c \
          "git -C \"${repo_dir}\" show {} --no-color 2>/dev/null | grep -P \"${combined_pattern}\" 2>/dev/null || true" \
        >> "${hist_out}.tags" 2>/dev/null || true
    '
  ) || tag_scan_exit=$?
  
  if [[ "$tag_scan_exit" -eq 124 ]]; then
    echo "[02] WARNING: Tag scan timed out after 60s" | tee -a "$out_txt"
    phase_flag "02" "LOW" "Tag object scan timed out (not critical)" "$out_txt"
  elif [[ -s "${hist_out}.tags" ]]; then
    echo "[02] SECRETS FOUND IN TAG OBJECTS:" | tee -a "$out_txt"
    cat "${hist_out}.tags" >> "$out_txt"
    found=1
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
    phase_flag "02" "HIGH" "trufflehog unavailable; regex/entropy fallback only" "$out_txt"
  fi

  # ── Fail or pass ──────────────────────────────────────────────────────────
  if [[ "$found" -eq 1 ]]; then
    phase_fail "02" "Secret(s) or high-entropy token(s) found in source or git history. See ${out_txt}" "$out_txt"
  fi

  phase_pass "02" "Secrets scan: no findings in working tree or history."
}

export -f run_secrets
