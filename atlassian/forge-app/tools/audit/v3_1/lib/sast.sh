#!/usr/bin/env bash
# lib/sast.sh — Phase 8: SAST (concrete config + local Forge rules)
set -euo pipefail

run_sast() {
  local e="${E}"
  local repo_dir="${REPO_DIR}"
  local audit_dir="${repo_dir}/tools/audit/v3_1"
  phase_start "08" "SAST (Semgrep + Local Forge Rules)"

  local semgrep_json="${e}/PHASE_08_semgrep.json"
  local semgrep_txt="${e}/PHASE_08_semgrep_summary.txt"

  # ── Ensure semgrep available ───────────────────────────────────────────────
  if ! command -v semgrep &>/dev/null; then
    echo "[08] semgrep not found; attempting install via pip..." | tee "$semgrep_txt"
    local pip_exit=0
    python3 -m pip install --user semgrep 2>&1 | tee -a "$semgrep_txt" || pip_exit=$?
    if [[ "$pip_exit" -ne 0 ]]; then
      phase_fail "08" "semgrep install failed (pip exit ${pip_exit}). SAST cannot run." "$semgrep_txt"
    fi
    # Refresh PATH for user bin
    export PATH="${HOME}/.local/bin:${PATH}"
    if ! command -v semgrep &>/dev/null; then
      phase_fail "08" "semgrep installed but still not on PATH. Add ~/.local/bin to PATH." "$semgrep_txt"
    fi
  fi
  echo "  semgrep: $(semgrep --version 2>/dev/null || echo 'unknown')" | tee -a "$semgrep_txt"

  local forge_rules="${audit_dir}/semgrep/forge.yml"
  [[ -f "$forge_rules" ]] || phase_fail "08" "Local Forge semgrep rules not found at ${forge_rules}" "$semgrep_txt"

  # ── Run semgrep ────────────────────────────────────────────────────────────
  echo "[08] Running semgrep with p/security-audit + local Forge rules..." | tee -a "$semgrep_txt"

  local sg_exit=0
  (
    cd "${repo_dir}"
    semgrep \
      --config p/security-audit \
      --config "${forge_rules}" \
      --json \
      --exclude "node_modules" \
      --exclude "dist" \
      --exclude "*.min.js" \
      src/ \
      2>&1
  ) > "$semgrep_json" || sg_exit=$?

  # Exit code 1 = findings, exit code 0 = no findings; other = error
  if [[ "$sg_exit" -gt 1 ]]; then
    echo "  semgrep exited with error code ${sg_exit}" | tee -a "$semgrep_txt"
    # Check if output is valid JSON anyway
    if ! jq . "$semgrep_json" > /dev/null 2>&1; then
      phase_fail "08" "semgrep exited with error (${sg_exit}) and produced no valid JSON output." "$semgrep_json"
    fi
  fi

  # ── Parse results ─────────────────────────────────────────────────────────
  local error_count=0
  local warning_count=0
  local info_count=0

  # Fail-closed: JSON must be valid and parseable
  if [[ ! -f "$semgrep_json" ]]; then
    phase_fail "08" "semgrep JSON output file not found at ${semgrep_json}" "$semgrep_txt"
  fi

  if ! jq . "$semgrep_json" > /dev/null 2>&1; then
    echo "  Could not parse semgrep JSON output." | tee -a "$semgrep_txt"
    phase_fail "08" \
      "semgrep JSON output could not be parsed. This audit cannot proceed with unparseable SAST output." \
      "$semgrep_json"
  fi

  # JSON is valid - extract findings
  error_count=$(jq '[.results[]? | select(.extra.severity == "ERROR")] | length' "$semgrep_json" 2>/dev/null || echo 0)
  warning_count=$(jq '[.results[]? | select(.extra.severity == "WARNING")] | length' "$semgrep_json" 2>/dev/null || echo 0)
  info_count=$(jq '[.results[]? | select(.extra.severity == "INFO")] | length' "$semgrep_json" 2>/dev/null || echo 0)

  echo "  Semgrep results: ERROR=${error_count} WARNING=${warning_count} INFO=${info_count}" \
    | tee -a "$semgrep_txt"

  # Top findings summary
  jq -r '.results[]? | "\(.extra.severity // "?")\t\(.path)\t[\(.start.line)] \(.extra.message // .check_id)"' \
    "$semgrep_json" 2>/dev/null | head -30 | tee -a "$semgrep_txt" || true

  # ── Apply fail rules ───────────────────────────────────────────────────────
  if [[ "$error_count" -gt 0 ]]; then
    phase_fail "08" \
      "Semgrep found ${error_count} ERROR-severity finding(s). See ${semgrep_json}" \
      "$semgrep_json"
  fi

  if [[ "$warning_count" -gt 0 ]] || [[ "$info_count" -gt 0 ]]; then
    phase_flag "08" "HIGH" \
      "Semgrep security-audit found ${warning_count} WARNING + ${info_count} INFO findings." \
      "$semgrep_json"
  fi

  phase_pass "08" "SAST: semgrep passed with no ERROR-severity findings."
}

export -f run_sast
