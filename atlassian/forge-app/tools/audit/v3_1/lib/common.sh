#!/usr/bin/env bash
# lib/common.sh — F100 Hostile Audit v3.1 common utilities
# Provides: need_cmd, phase_start/pass/flag/fail, write_json_result
# Requires: E (evidence dir), RESULTS_JSON, SCORE_FILE

set -euo pipefail

BOLD='\033[1m'
RED='\033[0;31m'
YLW='\033[0;33m'
GRN='\033[0;32m'
RST='\033[0m'

# ── Absolute requirements ───────────────────────────────────────────────────
need_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" &>/dev/null; then
    echo -e "${RED}FATAL: required command '${cmd}' not found. Cannot continue.${RST}" >&2
    echo "FAIL: required command '${cmd}' missing" >> "${E}/PHASE_00_environment.txt" 2>/dev/null || true
    # Write partial results.json if it exists
    _finalize_fail "MISSING_CMD_${cmd}" "Required command '${cmd}' not found on PATH" "PHASE_00"
    exit 1
  fi
}

# ── Phase lifecycle helpers ─────────────────────────────────────────────────
phase_start() {
  local phase="$1" label="$2"
  echo -e "\n${BOLD}[PHASE ${phase}]${RST} ${label}"
  CURRENT_PHASE="$phase"
  CURRENT_PHASE_LABEL="$label"
}

phase_pass() {
  local phase="$1" msg="$2"
  echo -e "  ${GRN}PASS${RST}  [${phase}] ${msg}"
  write_json_result "$phase" "PASS" "$msg" "" ""
}

phase_flag() {
  local phase="$1" severity="$2" msg="$3" evidence="${4:-}" allowlisted="${5:-false}"
  echo -e "  ${YLW}FLAG${RST}  [${phase}] (${severity}) ${msg}"
  write_json_result "$phase" "FLAG" "$msg" "$severity" "$evidence" "$allowlisted"
  # Accumulate flag into scoring state
  echo "${severity}" >> "${E}/.flags_${phase}" 2>/dev/null || true
  echo "${severity}" >> "${E}/.all_flags" 2>/dev/null || true
}

phase_fail() {
  local phase="$1" msg="$2" evidence="${3:-}"
  echo -e "  ${RED}FAIL${RST}  [${phase}] ${msg}"
  write_json_result "$phase" "FAIL" "$msg" "CRITICAL" "$evidence"
  echo "CRITICAL" >> "${E}/.all_fails" 2>/dev/null || true
  _finalize_fail "$phase" "$msg" "$phase"
  exit 1
}

# ── JSON result writer ──────────────────────────────────────────────────────
# Merges one phase result into $E/results.json
write_json_result() {
  local phase="$1" status="$2" msg="$3" severity="${4:-}" evidence="${5:-}" allowlisted="${6:-false}"
  local ts
  ts=$(date -u +%Y-%m-%dT%H:%M:%SZ)

  # Convert string "true"/"false" to JSON boolean
  local allow_json
  if [[ "$allowlisted" == "true" ]]; then
    allow_json="true"
  else
    allow_json="false"
  fi

  # Build entry
  local entry
  entry=$(jq -n \
    --arg phase  "$phase" \
    --arg status "$status" \
    --arg msg    "$msg" \
    --arg sev    "$severity" \
    --arg ev     "$evidence" \
    --argjson allow "$allow_json" \
    --arg ts     "$ts" \
    '{phase:$phase, status:$status, message:$msg, severity:$sev, evidence:$ev, allowlisted:$allow, timestamp:$ts}')

  # Merge into results.json
  local rj="${E}/results.json"
  if [[ -f "$rj" ]]; then
    jq --argjson entry "$entry" '.results += [$entry]' "$rj" > "${rj}.tmp" && mv "${rj}.tmp" "$rj"
  else
    jq -n --argjson entry "$entry" '{"results":[$entry]}' > "$rj"
  fi
}

# ── Private: write FINAL_REPORT and exit non-zero ───────────────────────────
_finalize_fail() {
  local phase="$1" reason="$2" _phase="$3"
  _write_final_report "REJECT" "FAIL in phase ${phase}: ${reason}"
}

_write_final_report() {
  local decision="$1" summary="$2"
  local rpt="${E}/FINAL_REPORT.md"
  {
    echo "# F100 Hostile Audit v3.1 — FINAL REPORT"
    echo ""
    echo "**Decision:** ${decision}"
    echo "**Summary:** ${summary}"
    echo ""
    echo "## Results"
    if [[ -f "${E}/results.json" ]]; then
      jq -r '.results[] | "- [\(.status)] Phase \(.phase): \(.message) \(if .severity != "" then "(\(.severity))" else "" end)"' \
        "${E}/results.json" 2>/dev/null || echo "(results.json not readable)"
    else
      echo "(No results captured)"
    fi
    echo ""
    echo "## What this does NOT prove"
    echo "- True runtime quota exhaustion on Atlassian infrastructure cannot be fully proven offline."
    echo "- Network-gated egress checks cannot verify live Atlassian sandbox behaviour."
    echo "- Semgrep rules represent a best-effort static approximation; runtime dynamic analysis is out of scope."
    echo "- License compliance for transitive dependencies beyond npm audit scope."
    echo ""
    echo "_Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)_"
  } > "$rpt"
}

# Export for sub-shells
export -f need_cmd phase_start phase_pass phase_flag phase_fail write_json_result _finalize_fail _write_final_report
