#!/usr/bin/env bash
# run_deterministic.sh — Deterministic operator entrypoint for F100 Audit v3.1
# Single canonical command. Fail-closed. Reproducible. No ambiguity.
#
# Usage: cd atlassian/forge-app && bash tools/audit/v3_1/run_deterministic.sh
#
# EXIT CODES:
#   0 = PASS (CONDITIONAL_ACCEPT)
#   1 = FAIL (REJECT, CONDITIONAL_REMEDIATION_REQUIRED, HIGH_RISK, or preflight failure)
#
# EVIDENCE:
#   Creates: /tmp/ft_audit_deterministic_TIMESTAMP_RANDOM
#   Symlink: /tmp/ft_audit_deterministic_latest -> EROOT
#   Symlink: /tmp/ft_f100_hostile_audit_v3_1_latest -> underlying audit dir
#
# OUTPUTS:
#   - Full audit log: EROOT/full.log
#   - results.json with final_decision, score, counts
#   - Artifact copies in EROOT/artifacts/

set -euo pipefail

# ── Strict mode ──────────────────────────────────────────────────────────────
set -o pipefail

# ── Evidence directory (deterministic with stable symlink) ───────────────────
EROOT="/tmp/ft_audit_deterministic_$(date -u +%Y%m%dT%H%M%SZ)_${RANDOM}"
mkdir -p "$EROOT"
export EROOT

# Create stable symlink
ln -sfn "$EROOT" /tmp/ft_audit_deterministic_latest

echo "============================================================"
echo "  DETERMINISTIC AUDIT RUNNER — F100 v3.1"
echo "  Evidence: ${EROOT}"
echo "  Symlink:  /tmp/ft_audit_deterministic_latest"
echo "  Started:  $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "============================================================"
echo ""

# ── Source preflight contract ────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PREFLIGHT="${SCRIPT_DIR}/lib/preflight_contract.sh"

if [[ ! -f "$PREFLIGHT" ]]; then
  echo "[ERROR] Preflight contract not found: $PREFLIGHT"
  exit 1
fi

# shellcheck disable=SC1090
source "$PREFLIGHT"
run_preflight_checks

# ── Optional: Run Real-World Capability Gates ───────────────────────────────
if [[ "${FT_REALWORLD_GATES:-0}" == "1" ]]; then
  echo ""
  echo "============================================================"
  echo "  OPTIONAL GATE: Real-World Capability Tests"
  echo "============================================================"
  echo ""
  
  REALWORLD_SCRIPT="${SCRIPT_DIR}/../../realworld/run_realworld_gates.sh"
  
  if [[ ! -f "$REALWORLD_SCRIPT" ]]; then
    echo "[ERROR] Real-world gates script not found: $REALWORLD_SCRIPT"
    echo "[ERROR] Set FT_REALWORLD_GATES=1 but gates not available"
    exit 1
  fi
  
  REALWORLD_EXIT=0
  if ! bash "$REALWORLD_SCRIPT" 2>&1 | tee "$EROOT/realworld_gates.log"; then
    REALWORLD_EXIT=$?
  fi
  
  if [[ $REALWORLD_EXIT -ne 0 ]]; then
    echo ""
    echo "[ERROR] Real-world gates FAILED (exit $REALWORLD_EXIT)"
    echo "[ERROR] Evidence: /tmp/ft_realworld_latest"
    echo "[ERROR] Cannot proceed with audit"
    
    # Create minimal results.json for failure
    mkdir -p "$EROOT/artifacts"
    cat > "$EROOT/artifacts/results.json" << EOF
{
  "final_decision": "ERROR",
  "score": 0,
  "fail_count": 1,
  "high_count": 0,
  "blocking_high_count": 0,
  "allowlisted_high_count": 0,
  "medium_count": 0,
  "low_count": 0,
  "reject_reason": "Real-world capability gates failed; see /tmp/ft_realworld_latest",
  "results": [
    {
      "phase": "00",
      "status": "FAIL",
      "message": "Real-world gates failed (scale/concurrency/license)",
      "severity": "CRITICAL",
      "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    }
  ],
  "meta": {
    "version": "3.1",
    "runner": "run_deterministic.sh",
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "realworld_gates": true
  }
}
EOF
    exit 1
  fi
  
  # Copy realworld summary into artifacts
  if [[ -f "/tmp/ft_realworld_latest/artifacts/REALWORLD_SUMMARY.json" ]]; then
    mkdir -p "$EROOT/artifacts"
    cp "/tmp/ft_realworld_latest/artifacts/REALWORLD_SUMMARY.json" "$EROOT/artifacts/"
    echo "[DETERMINISTIC] Real-world gates: PASS"
    echo "[DETERMINISTIC] Copied: REALWORLD_SUMMARY.json"
  fi
  
  echo ""
  echo "============================================================"
  echo ""
fi

# ── Capture environment snapshot ─────────────────────────────────────────────
echo "[DETERMINISTIC] Capturing environment snapshot..."
{
  echo "# Environment Snapshot — F100 Audit v3.1"
  echo "Timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo ""
  echo "## System"
  echo "Hostname: $(hostname)"
  echo "User: $(whoami)"
  echo "PWD: $PWD"
  echo "Shell: $SHELL"
  echo ""
  echo "## Tool Versions"
  echo "Node: $(node --version 2>/dev/null || echo 'N/A')"
  echo "npm: $(npm --version 2>/dev/null || echo 'N/A')"
  echo "semgrep: $(semgrep --version 2>/dev/null | head -1 || echo 'N/A')"
  echo "jq: $(jq --version 2>/dev/null || echo 'N/A')"
  echo "git: $(git --version 2>/dev/null || echo 'N/A')"
  echo ""
  echo "## Environment Variables (Audit-relevant)"
  echo "LC_ALL: ${LC_ALL:-}"
  echo "LANG: ${LANG:-}"
  echo "TZ: ${TZ:-}"
  echo "FT_SKIP_EXTERNAL_LINKS: ${FT_SKIP_EXTERNAL_LINKS:-}"
  echo "FT_SKIP_TESTS_IN_AUDIT: ${FT_SKIP_TESTS_IN_AUDIT:-}"
  echo "FT_AUDIT_OFFLINE: ${FT_AUDIT_OFFLINE:-}"
  echo "FT_AUDIT_NO_INSTALL: ${FT_AUDIT_NO_INSTALL:-}"
} > "$EROOT/env.txt"

# ── Capture git state ────────────────────────────────────────────────────────
echo "[DETERMINISTIC] Capturing git state..."
{
  echo "# Git State — F100 Audit v3.1"
  echo ""
  git rev-parse HEAD 2>/dev/null || echo "Not in git repo"
  echo ""
  git status --porcelain 2>/dev/null || echo "Not in git repo"
  echo ""
  echo "## Last commit"
  git log -1 --oneline 2>/dev/null || echo "Not in git repo"
} > "$EROOT/git.txt"

# ── Capture command invocation ───────────────────────────────────────────────
echo "[DETERMINISTIC] Recording command invocation..."
{
  echo "# Command Invocation — F100 Audit v3.1"
  echo ""
  echo "Command: bash tools/audit/v3_1/run_deterministic.sh"
  echo "Arguments: $*"
  echo "Invoked at: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "Working directory: $PWD"
} > "$EROOT/command.txt"

# ── Capture list of evidence dirs BEFORE audit run ──────────────────────────
echo "[DETERMINISTIC] Capturing pre-audit evidence directory list..."
find /tmp -maxdepth 1 -type d -name "ft_f100_hostile_audit_v3_1_*" 2>/dev/null | sort > "$EROOT/evidence_dirs_before.txt" || touch "$EROOT/evidence_dirs_before.txt"

# ── Run underlying audit (capture stdout/stderr) ─────────────────────────────
echo "[DETERMINISTIC] Running F100 Hostile Audit v3.1..."
echo ""
echo "============================================================"
echo ""

AUDIT_EXIT=0
if ! bash "$SCRIPT_DIR/run_f100_hostile_audit_v3_1.sh" 2>&1 | tee "$EROOT/full.log"; then
  AUDIT_EXIT=$?
fi

echo ""
echo "============================================================"
echo ""
echo "[DETERMINISTIC] Audit completed with exit code: $AUDIT_EXIT"

# ── Capture list of evidence dirs AFTER audit run ───────────────────────────
echo "[DETERMINISTIC] Capturing post-audit evidence directory list..."
find /tmp -maxdepth 1 -type d -name "ft_f100_hostile_audit_v3_1_*" 2>/dev/null | sort > "$EROOT/evidence_dirs_after.txt" || touch "$EROOT/evidence_dirs_after.txt"

# ── Determine created evidence directory (deterministic) ─────────────────────
echo "[DETERMINISTIC] Identifying created evidence directory..."
NEW_DIRS=$(comm -13 "$EROOT/evidence_dirs_before.txt" "$EROOT/evidence_dirs_after.txt" || true)
NEW_DIR_COUNT=$(echo "$NEW_DIRS" | grep -c . || true)

if [[ $NEW_DIR_COUNT -eq 0 ]]; then
  echo "[ERROR] No new evidence directory created by audit"
  echo "[ERROR] Expected exactly 1 new /tmp/ft_f100_hostile_audit_v3_1_* directory"
  echo "[ERROR] This indicates audit did not run or failed before creating evidence dir"
  
  # Create synthetic results.json
  cat > "$EROOT/artifacts/results.json" << 'EOF'
{
  "final_decision": "ERROR",
  "score": 0,
  "fail_count": 1,
  "high_count": 0,
  "blocking_high_count": 0,
  "allowlisted_high_count": 0,
  "medium_count": 0,
  "low_count": 0,
  "reject_reason": "No evidence directory created - audit did not execute",
  "results": [
    {
      "phase": "00",
      "status": "FAIL",
      "message": "Evidence directory not created by audit execution",
      "severity": "CRITICAL",
      "timestamp": "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"
    }
  ],
  "meta": {
    "version": "3.1",
    "runner": "run_deterministic.sh",
    "timestamp": "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"
  }
}
EOF
  
  echo "[DETERMINISTIC] See $EROOT/full.log for details"
  exit 1
fi

if [[ $NEW_DIR_COUNT -gt 1 ]]; then
  echo "[ERROR] Multiple evidence directories created by audit:"
  echo "$NEW_DIRS"
  echo "[ERROR] Expected exactly 1 new directory. This indicates non-deterministic behavior."
  
  # Create synthetic results.json
  mkdir -p "$EROOT/artifacts"
  cat > "$EROOT/artifacts/results.json" << EOF
{
  "final_decision": "ERROR",
  "score": 0,
  "fail_count": 1,
  "high_count": 0,
  "blocking_high_count": 0,
  "allowlisted_high_count": 0,
  "medium_count": 0,
  "low_count": 0,
  "reject_reason": "Multiple evidence directories created - non-deterministic audit execution",
  "results": [
    {
      "phase": "00",
      "status": "FAIL",
      "message": "${NEW_DIR_COUNT} evidence directories created (expected 1)",
      "severity": "CRITICAL",
      "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    }
  ],
  "meta": {
    "version": "3.1",
    "runner": "run_deterministic.sh",
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  }
}
EOF
  
  exit 1
fi

# Exactly 1 new directory - deterministic!
AUDIT_DIR=$(echo "$NEW_DIRS" | head -1)
echo "[DETERMINISTIC] Created evidence directory: $AUDIT_DIR"

# Create stable symlink to underlying audit dir
ln -sfn "$AUDIT_DIR" /tmp/ft_f100_hostile_audit_v3_1_latest
echo "[DETERMINISTIC] Symlink: /tmp/ft_f100_hostile_audit_v3_1_latest -> $AUDIT_DIR"

# ── Validate required files ──────────────────────────────────────────────────
echo "[DETERMINISTIC] Validating audit artifacts..."
mkdir -p "$EROOT/artifacts"

# Check results.json
if [[ ! -f "$AUDIT_DIR/results.json" ]]; then
  echo "[ERROR] results.json missing from audit output: $AUDIT_DIR"
  
  # Create synthetic results.json
  cat > "$EROOT/artifacts/results.json" << EOF
{
  "final_decision": "ERROR",
  "score": 0,
  "fail_count": 999,
  "high_count": 999,
  "blocking_high_count": 999,
  "allowlisted_high_count": 0,
  "medium_count": 0,
  "low_count": 0,
  "reject_reason": "results.json missing from audit output",
  "results": [
    {
      "phase": "00",
      "status": "FAIL",
      "message": "results.json missing from audit output directory",
      "severity": "HIGH",
      "evidence": "$AUDIT_DIR",
      "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    }
  ],
  "meta": {
    "version": "3.1",
    "runner": "run_deterministic.sh",
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  }
}
EOF
  
  echo "[DETERMINISTIC] Audit artifact validation FAILED"
  exit 1
fi

# Validate results.json is valid JSON
if ! jq empty "$AUDIT_DIR/results.json" 2>/dev/null; then
  echo "[ERROR] results.json is not valid JSON"
  
  # Create synthetic results.json
  cat > "$EROOT/artifacts/results.json" << EOF
{
  "final_decision": "ERROR",
  "score": 0,
  "fail_count": 999,
  "high_count": 999,
  "blocking_high_count": 999,
  "allowlisted_high_count": 0,
  "medium_count": 0,
  "low_count": 0,
  "reject_reason": "results.json corrupted - not valid JSON",
  "results": [
    {
      "phase": "00",
      "status": "FAIL",
      "message": "results.json corrupted - failed JSON validation",
      "severity": "HIGH",
      "evidence": "$AUDIT_DIR/results.json",
      "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    }
  ],
  "meta": {
    "version": "3.1",
    "runner": "run_deterministic.sh",
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  }
}
EOF
  
  echo "[DETERMINISTIC] Audit artifact validation FAILED"
  exit 1
fi

echo "[DETERMINISTIC] results.json: valid"

# ── Copy artifacts to EROOT ──────────────────────────────────────────────────
echo "[DETERMINISTIC] Copying artifacts to $EROOT/artifacts/..."

cp "$AUDIT_DIR/results.json" "$EROOT/artifacts/" 2>/dev/null || true

if [[ -f "$AUDIT_DIR/FINAL_REPORT.md" ]]; then
  cp "$AUDIT_DIR/FINAL_REPORT.md" "$EROOT/artifacts/"
  echo "[DETERMINISTIC] Copied: FINAL_REPORT.md"
fi

if [[ -f "$AUDIT_DIR/99_FINAL_DECISION.txt" ]]; then
  cp "$AUDIT_DIR/99_FINAL_DECISION.txt" "$EROOT/artifacts/"
  echo "[DETERMINISTIC] Copied: 99_FINAL_DECISION.txt"
fi

if [[ -f "$AUDIT_DIR/SCORING_SUMMARY.json" ]]; then
  cp "$AUDIT_DIR/SCORING_SUMMARY.json" "$EROOT/artifacts/"
  echo "[DETERMINISTIC] Copied: SCORING_SUMMARY.json"
fi

# Copy phase summaries
find "$AUDIT_DIR" -maxdepth 1 -name "PHASE_*.txt" -o -name "PHASE_*.md" -o -name "PHASE_*.csv" 2>/dev/null | \
  while read -r f; do
    cp "$f" "$EROOT/artifacts/" 2>/dev/null || true
  done

# ── Extract final decision and metadata ─────────────────────────────────────
echo "[DETERMINISTIC] Extracting final decision..."

FINAL_DECISION=$(jq -r '.final_decision // "UNKNOWN"' "$EROOT/artifacts/results.json" 2>/dev/null || echo "UNKNOWN")
SCORE=$(jq -r '.score // 0' "$EROOT/artifacts/results.json" 2>/dev/null || echo 0)
FAIL_COUNT=$(jq -r '[.results[] | select(.status=="FAIL")] | length' "$EROOT/artifacts/results.json" 2>/dev/null || echo 0)
FLAG_COUNT=$(jq -r '[.results[] | select(.status=="FLAG")] | length' "$EROOT/artifacts/results.json" 2>/dev/null || echo 0)
PASS_COUNT=$(jq -r '[.results[] | select(.status=="PASS")] | length' "$EROOT/artifacts/results.json" 2>/dev/null || echo 0)
BLOCKING_HIGHS=$(jq -r '.blocking_high_count // 0' "$EROOT/artifacts/results.json" 2>/dev/null || echo 0)
ALLOWLISTED_HIGHS=$(jq -r '.allowlisted_high_count // 0' "$EROOT/artifacts/results.json" 2>/dev/null || echo 0)
REJECT_REASON=$(jq -r '.reject_reason // ""' "$EROOT/artifacts/results.json" 2>/dev/null || echo "")

# ── Print final summary ──────────────────────────────────────────────────────
echo ""
echo "============================================================"
echo "  DETERMINISTIC AUDIT — FINAL SUMMARY"
echo "============================================================"
echo ""
echo "Decision:           ${FINAL_DECISION}"
echo "Score:              ${SCORE}/100"
echo "Exit code:          ${AUDIT_EXIT}"
echo ""
echo "Phase Results:"
echo "  FAIL:             ${FAIL_COUNT}"
echo "  FLAG:             ${FLAG_COUNT}"
echo "  PASS:             ${PASS_COUNT}"
echo ""
echo "HIGH Flags:"
echo "  Blocking:         ${BLOCKING_HIGHS}"
echo "  Allowlisted:      ${ALLOWLISTED_HIGHS}"
echo ""
if [[ -n "$REJECT_REASON" ]]; then
  echo "Reject Reason:      ${REJECT_REASON}"
  echo ""
fi
echo "Evidence:"
echo "  EROOT:            ${EROOT}"
echo "  Audit dir:        ${AUDIT_DIR}"
echo "  Symlink:          /tmp/ft_audit_deterministic_latest"
echo "  Symlink (audit):  /tmp/ft_f100_hostile_audit_v3_1_latest"
echo ""
echo "Key Artifacts:"
echo "  results.json:     ${EROOT}/artifacts/results.json"
if [[ -f "$EROOT/artifacts/FINAL_REPORT.md" ]]; then
  echo "  FINAL_REPORT.md:  ${EROOT}/artifacts/FINAL_REPORT.md"
fi
if [[ -f "$EROOT/artifacts/99_FINAL_DECISION.txt" ]]; then
  echo "  Decision file:    ${EROOT}/artifacts/99_FINAL_DECISION.txt"
fi
echo ""
echo "Full log:           ${EROOT}/full.log"
echo ""
echo "============================================================"
echo ""

# ── Exit with appropriate code ───────────────────────────────────────────────
if [[ "$FINAL_DECISION" == "CONDITIONAL_ACCEPT" ]]; then
  echo "[DETERMINISTIC] EXIT 0 — PASS (CONDITIONAL_ACCEPT)"
  exit 0
else
  echo "[DETERMINISTIC] EXIT 1 — FAIL (${FINAL_DECISION})"
  exit 1
fi
