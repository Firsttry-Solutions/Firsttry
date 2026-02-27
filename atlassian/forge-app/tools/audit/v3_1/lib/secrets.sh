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

  # ── B: Git history scan (safe + bounded) ─────────────────────────────────
  echo "[02] Counting git history..." | tee -a "$out_txt"
  local total_commits
  total_commits=$(git -C "${repo_dir}" rev-list --all --count 2>/dev/null || echo 0)
  echo "  Total commits: ${total_commits}" | tee -a "$out_txt"

  local scan_limit=10000
  local history_warning=""
  if [[ "$total_commits" -gt 10000 ]]; then
    history_warning="History >10k commits; scanned recent 10k + tags; full scan skipped to avoid OOM/hang."
    phase_flag "02" "HIGH" "$history_warning" "$out_txt"
    echo "[02] ${history_warning}" | tee -a "$out_txt"
  else
    scan_limit="$total_commits"
  fi

  echo "[02] Scanning git history (limit: ${scan_limit} commits) with parallel workers..." | tee -a "$out_txt"

  # Parallel history scan using xargs -P4
  local hist_out="${e}/PHASE_02_history_scan_raw.txt"
  touch "$hist_out"

  for pat in "${patterns[@]}"; do
    git -C "${repo_dir}" rev-list --all 2>/dev/null | head -"$scan_limit" | \
      xargs -P4 -I{} sh -c \
        "git -C '${repo_dir}' show {} --no-color 2>/dev/null | grep -P '${pat}' 2>/dev/null || true" \
      >> "$hist_out" 2>/dev/null || true
  done

  if [[ -s "$hist_out" ]]; then
    echo "[02] HISTORY SECRETS FOUND:" | tee -a "$out_txt"
    cat "$hist_out" >> "$out_txt"
    found=1
  else
    echo "  Git history scan: no secrets found." | tee -a "$out_txt"
  fi

  # Also scan tag objects
  echo "[02] Scanning tag objects..." | tee -a "$out_txt"
  for pat in "${patterns[@]}"; do
    git -C "${repo_dir}" show-ref --tags -d 2>/dev/null | awk '{print $1}' | \
      xargs -P4 -I{} sh -c \
        "git -C '${repo_dir}' show {} --no-color 2>/dev/null | grep -P '${pat}' 2>/dev/null || true" \
      >> "$hist_out" 2>/dev/null || true
  done

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
