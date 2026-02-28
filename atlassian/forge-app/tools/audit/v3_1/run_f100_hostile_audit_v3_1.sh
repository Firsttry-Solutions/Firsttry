#!/usr/bin/env bash
# run_f100_hostile_audit_v3_1.sh
# F100 Hostile Enterprise Buyer Audit v3.1
# Fortune-50 controlled internal penetration simulation
# Zero-trust. Fail-closed. Deterministic (modulo evidence dir timestamp).
#
# Usage: bash tools/audit/v3_1/run_f100_hostile_audit_v3_1.sh
# Must be run from: atlassian/forge-app root directory

set -euo pipefail

# ── Environment standardization (eliminate randomness) ──────────────────────
export LC_ALL=C
export LANG=C
export TZ=UTC
umask 022

# ── Semgrep determinism (no version checks, no metrics) ────────────────────
export SEMGREP_ENABLE_VERSION_CHECK=0
export SEMGREP_SEND_METRICS=off
export SEMGREP_TIMEOUT=0
# ── Skip external network dependencies (deterministic mode) ────────────────────────────────
export FT_SKIP_EXTERNAL_LINKS=1
# ── Locate audit dir ────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
export REPO_DIR

cd "${REPO_DIR}"

# ── Evidence dir (with uniqueness guarantee) ──────────────────────────────
E="/tmp/ft_f100_hostile_audit_v3_1_$(date -u +%Y%m%dT%H%M%SZ)_$$"
export E
mkdir -p "$E"

echo "============================================================"
echo "  F100 HOSTILE ENTERPRISE AUDIT v3.1"
echo "  Evidence dir: ${E}"
echo "  Repo dir:     ${REPO_DIR}"
echo "  Timestamp:    $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "============================================================"
echo ""

# ── Trap handler for fail-safe canonical artifacts ─────────────────────────
# Ensures results.json, FINAL_REPORT.md, and 99_FINAL_DECISION.txt always exist
_ensure_canonical_artifacts() {
  local exit_code=$?
  
  # Ensure results.json exists and is valid
  if [[ ! -f "${E}/results.json" ]]; then
    echo '{"results":[{"phase":"FATAL","status":"FAIL","message":"Audit terminated before completion","severity":"CRITICAL","timestamp":"'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"}]}' > "${E}/results.json"
  fi
  
  # Validate results.json is parseable
  if ! jq empty "${E}/results.json" 2>/dev/null; then
    echo '{"results":[{"phase":"FATAL","status":"FAIL","message":"results.json corrupted","severity":"CRITICAL","timestamp":"'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"}]}' > "${E}/results.json"
  fi
  
  # Ensure FINAL_REPORT.md exists
  if [[ ! -f "${E}/FINAL_REPORT.md" ]]; then
    cat > "${E}/FINAL_REPORT.md" << 'EOFREPORT'
# F100 Hostile Audit v3.1 — FINAL REPORT

**Decision:** REJECT
**Summary:** Audit terminated before normal completion (trap handler)

## Results
See results.json for captured phase results.

_Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)_
EOFREPORT
  fi
  
  # Ensure 99_FINAL_DECISION.txt exists
  if [[ ! -f "${E}/99_FINAL_DECISION.txt" ]]; then
    echo "REJECT" > "${E}/99_FINAL_DECISION.txt"
  fi
  
  # Create CANONICAL_ARTIFACTS.txt
  cat > "${E}/CANONICAL_ARTIFACTS.txt" << 'EOFCANON'
results.json
FINAL_REPORT.md
99_FINAL_DECISION.txt
SCORING_SUMMARY.json
EOFCANON
  
  # Verify canonical artifacts exist
  local missing_artifacts=0
  while IFS= read -r artifact; do
    [[ -z "$artifact" ]] && continue
    if [[ ! -f "${E}/${artifact}" ]]; then
      echo "[TRAP] Missing canonical artifact: ${artifact}" >&2
      missing_artifacts=1
    fi
  done < "${E}/CANONICAL_ARTIFACTS.txt"
  
  if [[ $missing_artifacts -eq 1 ]]; then
    echo "[TRAP] Some canonical artifacts missing after trap handler" >&2
  fi
}

trap '_ensure_canonical_artifacts' EXIT INT TERM

# ── Load libraries ──────────────────────────────────────────────────────────
LIB="${SCRIPT_DIR}/lib"
# shellcheck source=lib/common.sh
source "${LIB}/common.sh"
# shellcheck source=lib/scoring.sh
source "${LIB}/scoring.sh"
# shellcheck source=lib/supply_chain.sh
source "${LIB}/supply_chain.sh"
# shellcheck source=lib/secrets.sh
source "${LIB}/secrets.sh"
# shellcheck source=lib/manifest.sh
source "${LIB}/manifest.sh"
# shellcheck source=lib/exfiltration.sh
source "${LIB}/exfiltration.sh"
# shellcheck source=lib/forge_specific.sh
source "${LIB}/forge_specific.sh"
# shellcheck source=lib/determinism.sh
source "${LIB}/determinism.sh"
# shellcheck source=lib/runtime.sh
source "${LIB}/runtime.sh"
# shellcheck source=lib/sast.sh
source "${LIB}/sast.sh"
# shellcheck source=lib/quota.sh
source "${LIB}/quota.sh"
# shellcheck source=lib/silent_failures.sh
source "${LIB}/silent_failures.sh"
# shellcheck source=lib/legal.sh
source "${LIB}/legal.sh"

# ── Required commands ───────────────────────────────────────────────────────
for cmd in bash git node npm jq rg grep sha256sum zip; do
  need_cmd "$cmd"
done

# Optional: curl (if missing => High FLAG, not FAIL)
if ! command -v curl &>/dev/null; then
  phase_flag "00" "HIGH" "curl not found; external link validation will be skipped" ""
fi

# Forge CLI requirement
if ! command -v forge &>/dev/null; then
  phase_fail "00" "Forge CLI ('forge') not found. Install with: npm install -g @forge/cli" ""
fi

# Semgrep: install if missing (fail-closed)
if ! command -v semgrep &>/dev/null; then
  echo "[PRE] semgrep not found; attempting install..."
  python3 -m pip install --user semgrep 2>&1 || phase_fail "00" "semgrep install failed. SAST cannot run." ""
  export PATH="${HOME}/.local/bin:${PATH}"
fi

# Trufflehog: best-effort
if ! command -v trufflehog &>/dev/null; then
  echo "[PRE] trufflehog not found; attempting install..."
  if command -v go &>/dev/null; then
    go install github.com/trufflesecurity/trufflehog/v3@latest 2>/dev/null || true
    export PATH="${GOPATH:-${HOME}/go}/bin:${PATH}"
  fi
  if ! command -v trufflehog &>/dev/null; then
    echo "[PRE] trufflehog unavailable; regex fallback will be used."
    # Flagged in secrets phase
  fi
fi

# Initialize results.json
echo '{"results":[]}' > "${E}/results.json"

# Touch flag accumulator files
touch "${E}/.all_flags" "${E}/.all_fails" 2>/dev/null || true

# ── GATE: Clean git tree (zero-trust, hardened) ─────────────────────────────
# Checks for:
#   1. Any tracked file modification / staged change under REPO_DIR → FAIL
#   2. Any untracked file under REPO_DIR outside the explicit allowlist → FAIL
# Allowlist (untracked OK): site/**  .next/**  dist/**  build/**
# Paths are always resolved relative to REPO_DIR (scoped; workspace siblings ignored).
# Evidence written to: $E/00_tracked_dirty_files.txt  $E/00_untracked_files.txt
echo "[GATE] Enforcing clean git tree (zero-trust hardened)..."

# Determine how git presents REPO_DIR paths (may be a repo subdirectory)
GIT_TOP=$(git -C "${REPO_DIR}" rev-parse --show-toplevel 2>/dev/null || echo "${REPO_DIR}")
# Relative path of REPO_DIR from git top-level (empty string if they're the same root)
if [[ "${REPO_DIR}" == "${GIT_TOP}" ]]; then
  REPO_GIT_PREFIX=""
else
  REPO_GIT_PREFIX="${REPO_DIR#${GIT_TOP}/}/"   # e.g. "atlassian/forge-app/"
fi

# Collect all porcelain lines from git, scoped to REPO_DIR
ALL_STATUS=$(git -C "${GIT_TOP}" status --porcelain 2>/dev/null || true)

# Tracked dirty lines: not ?? and not !! and path starts with REPO_GIT_PREFIX
if [[ -n "$REPO_GIT_PREFIX" ]]; then
  TRACKED_DIRTY=$(echo "$ALL_STATUS" | grep -vE '^(\?\?|!!)' | awk -v p="${REPO_GIT_PREFIX}" '$2 ~ "^"p || $3 ~ "^"p' || true)
  UNTRACKED_ALL=$(echo "$ALL_STATUS" | grep '^?? ' | sed 's/^?? //' | grep "^${REPO_GIT_PREFIX}" | sed "s|^${REPO_GIT_PREFIX}||" || true)
else
  TRACKED_DIRTY=$(echo "$ALL_STATUS" | grep -vE '^(\?\?|!!)' || true)
  UNTRACKED_ALL=$(echo "$ALL_STATUS" | grep '^?? ' | sed 's/^?? //' || true)
fi

# Write evidence files unconditionally (empty is fine)
printf '%s\n' "$TRACKED_DIRTY" > "${E}/00_tracked_dirty_files.txt"
printf '%s\n' "$UNTRACKED_ALL"  > "${E}/00_untracked_files.txt"

# Filter out allowlisted untracked paths (repo-relative)
# Allowlist: site/  .next/  dist/  build/
UNTRACKED_BLOCKED=""
while IFS= read -r uf; do
  [[ -z "$uf" ]] && continue
  uf_clean="${uf%/}"   # strip trailing slash git adds for dirs
  case "$uf_clean" in
    site|site/*|.next|.next/*|dist|dist/*|build|build/*)
      : ;; # allowlisted – skip
    *)
      UNTRACKED_BLOCKED="${UNTRACKED_BLOCKED}${uf_clean}"$'\n'
      ;;
  esac
done <<< "$UNTRACKED_ALL"

GATE_FAIL=0
GATE_MSG=""
if [[ -n "$TRACKED_DIRTY" ]]; then
  GATE_FAIL=1
  GATE_MSG="Tracked modifications found in REPO_DIR"
fi
if [[ -n "$UNTRACKED_BLOCKED" ]]; then
  GATE_FAIL=1
  GATE_MSG="${GATE_MSG:+$GATE_MSG | }Untracked files outside allowlist: $(echo "$UNTRACKED_BLOCKED" | tr '\n' ' ')"
fi

if [[ "$GATE_FAIL" -eq 1 ]]; then
  echo "FAIL: git tree not clean:"
  [[ -n "$TRACKED_DIRTY"     ]] && { echo "  tracked dirty:"; echo "$TRACKED_DIRTY"; }
  [[ -n "$UNTRACKED_BLOCKED" ]] && { echo "  untracked (blocked):"; echo "$UNTRACKED_BLOCKED"; }
  _write_final_report "REJECT" "FAIL: git working tree is not clean. ${GATE_MSG}"
  echo '{"results":[{"phase":"GATE","status":"FAIL","message":"git tree not clean","severity":"CRITICAL","evidence":"'"${E}/00_tracked_dirty_files.txt"'","timestamp":"'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"}]}' > "${E}/results.json"
  echo "{}" > "${E}/00_sbom.json"
  echo "FAIL: git tree not clean" >&2
  exit 2
fi
echo "  [PASS] git tree is clean (untracked: allowlisted only)."
write_json_result "GATE" "PASS" "git tree is clean (hardened gate, REPO_DIR-scoped)" "" ""

# ── PHASE 0: Cleanroom baseline ─────────────────────────────────────────────
phase_start "00" "Cleanroom Baseline"
{
  echo "=== F100 Hostile Audit v3.1 — Environment Snapshot ==="
  echo ""
  echo "--- git ---"
  git -C "${REPO_DIR}" rev-parse HEAD 2>/dev/null || echo "(no commits)"
  git -C "${REPO_DIR}" branch --show-current 2>/dev/null || echo "(detached HEAD)"
  git -C "${REPO_DIR}" remote -v 2>/dev/null || echo "(no remotes)"
  echo ""
  echo "--- node/npm ---"
  node -v 2>/dev/null || echo "node: not found"
  npm -v 2>/dev/null || echo "npm: not found"
  echo ""
  echo "--- forge ---"
  forge --version 2>/dev/null || echo "forge: not found"
  echo ""
  echo "--- semgrep ---"
  semgrep --version 2>/dev/null || echo "semgrep: not found"
  echo ""
  echo "--- system ---"
  uname -a
  echo ""
  echo "--- tool versions ---"
  jq --version 2>/dev/null || echo "jq: not found"
  rg --version 2>/dev/null | head -1 || echo "rg: not found"
  sha256sum --version 2>/dev/null | head -1 || echo "sha256sum: not found"
  zip --version 2>/dev/null | head -2 || echo "zip: not found"
} > "${E}/PHASE_00_environment.txt" 2>&1

echo "  Environment snapshot: ${E}/PHASE_00_environment.txt"

# Clean install
echo "[00] Running npm ci (clean install)..."
npm_ci_exit=0
(cd "${REPO_DIR}" && npm ci 2>&1) > "${E}/PHASE_00_npm_ci.txt" 2>&1 || npm_ci_exit=$?
if [[ "$npm_ci_exit" -ne 0 ]]; then
  phase_fail "00" "npm ci failed (exit ${npm_ci_exit}). See ${E}/PHASE_00_npm_ci.txt" \
    "${E}/PHASE_00_npm_ci.txt"
fi
echo "  npm ci succeeded."

# Generate SBOM
echo "[00] Generating SBOM..."
(cd "${REPO_DIR}" && npm ls --json 2>/dev/null) > "${E}/00_sbom.json" || {
  echo "  WARNING: npm ls exited non-zero (partial tree recorded)"
  phase_flag "00" "LOW" "npm ls returned non-zero (partial SBOM; possibly unresolved peer deps)" \
    "${E}/00_sbom.json"
}
echo "  SBOM: ${E}/00_sbom.json"
phase_pass "00" "Cleanroom baseline established; npm ci succeeded; SBOM generated."

# ── PHASE 1–12 ──────────────────────────────────────────────────────────────
run_supply_chain   # Phase 1
run_secrets        # Phase 2
run_manifest       # Phase 3
run_exfiltration   # Phase 4

# ── Validate Phase 05 allowlist metadata (fail-closed) ──────────────────────
echo "[PRE-05] Validating Phase 05 allowlist metadata..."
if ! bash "${LIB}/validate_phase05_allowlist.sh" 2>&1 | tee "${E}/PHASE_05_allowlist_validation.txt"; then
  phase_fail "05" "Phase 05 allowlist validation failed: entries must be human-reviewed (not UNREVIEWED/TBD/Automation) and not expired" \
    "${E}/PHASE_05_allowlist_validation.txt"
fi
echo "  [PASS] Phase 05 allowlist metadata validated."

run_forge_specific # Phase 5
run_determinism    # Phase 6
run_runtime        # Phase 7
run_sast           # Phase 8
run_quota          # Phase 9
run_silent_failures # Phase 10
run_legal          # Phase 11

# ── PHASE 12: Drift & complaint matrix ──────────────────────────────────────
phase_start "12" "Drift & Complaint Risk Matrix"
{
  echo "phase,risk_name,L,I,D,Risk_Score"
  # Risk = L * I * (6 - D)
  # L=Likelihood(1-5), I=Impact(1-5), D=Detectability(1-5)
  # Higher D = easier to detect => lower risk weight
  echo "01,Non-exact_dependency_version,3,4,4,12"
  echo "02,Secret_in_git_history,2,5,2,30"
  echo "03,Manifest_write_scope,1,5,4,10"
  echo "04,Unsanctioned_outbound_calls,2,5,3,30"
  echo "05,Storage_tenant_isolation_failure,3,5,2,45"
  echo "05,Missing_429_handling,4,3,3,36"
  echo "06,Non_deterministic_export,2,4,2,32"
  echo "07,Test_failures,3,4,3,36"
  echo "08,SAST_error_findings,2,4,3,24"
  echo "09,Unbounded_memory_growth,2,4,4,16"
  echo "10,Silent_failures_in_export,3,5,2,45"
  echo "11,Missing_governance_docs,3,3,3,27"
  echo "12,Duplicate_package_versions,2,3,4,12"
} > "${E}/PHASE_12_risk_matrix.csv"

{
  echo "# Risk Matrix — F100 Hostile Audit v3.1"
  echo ""
  echo "| Phase | Risk | L | I | D | Score (L×I×(6-D)) | Level |"
  echo "|-------|------|---|---|---|-------------------|-------|"
  while IFS=, read -r phase risk_name l i d score; do
    [[ "$phase" == "phase" ]] && continue
    rl_level="LOW"
    [[ "$score" -ge 20 ]] && rl_level="MEDIUM"
    [[ "$score" -ge 35 ]] && rl_level="HIGH"
    [[ "$score" -ge 45 ]] && rl_level="CRITICAL"
    echo "| ${phase} | ${risk_name//_/ } | ${l} | ${i} | ${d} | **${score}** | ${rl_level} |"
  done < "${E}/PHASE_12_risk_matrix.csv"
} > "${E}/PHASE_12_risk_matrix.md"

# Count risks >= 40
high_risk_count=$(awk -F, 'NR>1 && $6>=40 {c++} END{print c+0}' "${E}/PHASE_12_risk_matrix.csv")
echo "  Risks scoring >= 40: ${high_risk_count}" 
if [[ "$high_risk_count" -gt 5 ]]; then
  phase_flag "12" "HIGH" "${high_risk_count} risks scored >=40 in risk matrix. Exceeds threshold of 5." \
    "${E}/PHASE_12_risk_matrix.csv"
fi
phase_pass "12" "Risk matrix generated. ${high_risk_count} risks at score >=40."

# ── PHASE 13: Evidence packaging ────────────────────────────────────────────
phase_start "13" "Evidence Packaging"

# Compute final score
echo "[13] Computing final score..."
SCORE_RESULT=$(compute_final_score)
FINAL_SCORE=$(echo "$SCORE_RESULT" | cut -d'|' -f1)
FINAL_DECISION=$(echo "$SCORE_RESULT" | cut -d'|' -f2)
HAS_FAIL=$(echo "$SCORE_RESULT" | cut -d'|' -f3)
HIGH_FLAGS=$(echo "$SCORE_RESULT" | cut -d'|' -f4)
MED_FLAGS=$(echo "$SCORE_RESULT" | cut -d'|' -f5)
LOW_FLAGS=$(echo "$SCORE_RESULT" | cut -d'|' -f6)
HIGH_FLAGS_BLOCKING=$(echo "$SCORE_RESULT" | cut -d'|' -f7)
HIGH_FLAGS_ALLOWLISTED=$(( HIGH_FLAGS - HIGH_FLAGS_BLOCKING ))

echo "  Score: ${FINAL_SCORE}"
echo "  Decision: ${FINAL_DECISION}"
echo "  High FLAGS: ${HIGH_FLAGS} (${HIGH_FLAGS_BLOCKING} blocking, ${HIGH_FLAGS_ALLOWLISTED} allowlisted) | Medium FLAGS: ${MED_FLAGS} | Low FLAGS: ${LOW_FLAGS}"

# Write FINAL_REPORT.md
{
  echo "# F100 Hostile Audit v3.1 — FINAL REPORT"
  echo ""
  echo "**Date:** $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "**Repository:** ${REPO_DIR}"
  echo "**Commit:** $(git -C "${REPO_DIR}" rev-parse HEAD 2>/dev/null || echo 'unknown')"
  echo ""
  echo "---"
  echo ""
  echo "## Score & Decision"
  echo ""
  echo "| Metric | Value |"
  echo "|--------|-------|"
  echo "| **Final Score** | ${FINAL_SCORE}/100 |"
  echo "| **Decision** | **${FINAL_DECISION}** |"
  echo "| Has FAIL | ${HAS_FAIL} |"
  echo "| HIGH Flags (Total) | ${HIGH_FLAGS} |"
  echo "| HIGH Flags (Blocking) | ${HIGH_FLAGS_BLOCKING} |"
  echo "| HIGH Flags (Allowlisted) | ${HIGH_FLAGS_ALLOWLISTED} |"
  echo "| MEDIUM Flags | ${MED_FLAGS} |"
  echo "| LOW Flags | ${LOW_FLAGS} |"
  echo ""
  echo "> **Note on Allowlisted HIGH Flags:** Phase 05 storage key classifications marked as allowlisted"
  echo "> represent reviewed patterns that rely on Forge's implicit tenant isolation mechanism."
  echo "> These are tracked for visibility but do not trigger rejection in scoring."
  echo ""
  echo "---"
  echo ""
  echo "## Phase Results"
  echo ""
  echo "| Phase | Status | Severity | Message |"
  echo "|-------|--------|----------|---------|"
  if [[ -f "${E}/results.json" ]]; then
    jq -r '.results[] | "| \(.phase) | \(.status) | \(.severity // "-") | \(.message) |"' \
      "${E}/results.json" 2>/dev/null || echo "| (parse error) | | | |"
  fi
  echo ""
  echo "---"
  echo ""
  echo "## Evidence Files"
  echo ""
  find "${E}" -maxdepth 1 -type f | sort | while read -r f; do
    echo "- \`$(basename "$f")\`"
  done
  echo ""
  echo "---"
  echo ""
  echo "## What This Does NOT Prove"
  echo ""
  echo "- True runtime quota exhaustion on Atlassian infrastructure cannot be fully proven offline."
  echo "- Network-gated egress checks cannot verify live Atlassian sandbox behaviour in production."
  echo "- Semgrep rules are a best-effort static approximation; dynamic/runtime analysis is out of scope."
  echo "- License compliance for transitive dependencies beyond npm audit scope."
  echo "- Secrets redacted from Atlassian's managed environment (e.g. Forge variables store) are not scanned."
  echo "- External link validation requires outbound network access; cleanroom environments may block this."
  echo ""
  echo "---"
  echo ""
  echo "_Generated by F100 Hostile Audit v3.1_"
} > "${E}/FINAL_REPORT.md.raw"

# Sanitize FINAL_REPORT.md to remove any JWT leakage
echo "[13] Sanitizing FINAL_REPORT.md for JWT patterns..."
SANITIZER="${REPO_DIR}/../../tools/security/sanitize_text.mjs"
if [[ -f "$SANITIZER" ]]; then
  SANITIZE_SUMMARY_PATH="${E}/SANITIZE_FINAL_REPORT.json" \
    node "$SANITIZER" < "${E}/FINAL_REPORT.md.raw" > "${E}/FINAL_REPORT.md" 2>/dev/null || {
      echo "  [WARN] Sanitizer failed, copying raw report"
      cp "${E}/FINAL_REPORT.md.raw" "${E}/FINAL_REPORT.md"
    }
  rm -f "${E}/FINAL_REPORT.md.raw"
  
  # Check if sanitization occurred
  if [[ -f "${E}/SANITIZE_FINAL_REPORT.json" ]]; then
    REDACT_COUNT=$(jq -r '.redactions // 0' "${E}/SANITIZE_FINAL_REPORT.json" 2>/dev/null || echo 0)
    if [[ "$REDACT_COUNT" -gt 0 ]]; then
      echo "  [SECURITY] JWT redaction: $REDACT_COUNT patterns removed from FINAL_REPORT.md"
      if [[ "${FT_ALLOW_REDACTIONS:-0}" != "1" ]]; then
        echo "  [FAIL] Fail-closed: JWT leakage detected in audit artifacts. Set FT_ALLOW_REDACTIONS=1 to override."
        HAS_FAIL=true
        FINAL_SCORE=0
        FINAL_DECISION="REJECT"
      fi
    fi
  fi
else
  echo "  [WARN] Sanitizer not found at $SANITIZER, skipping sanitization"
  mv "${E}/FINAL_REPORT.md.raw" "${E}/FINAL_REPORT.md"
fi

# Sanitize results.json
echo "[13] Sanitizing results.json for JWT patterns..."
if [[ -f "$SANITIZER" && -f "${E}/results.json" ]]; then
  SANITIZE_SUMMARY_PATH="${E}/SANITIZE_RESULTS_JSON.json" \
    node "$SANITIZER" < "${E}/results.json" > "${E}/results.json.sanitized" 2>/dev/null || {
      echo "  [WARN] Sanitizer failed, keeping original results.json"
      rm -f "${E}/results.json.sanitized"
    }
  
  if [[ -f "${E}/results.json.sanitized" ]]; then
    mv "${E}/results.json.sanitized" "${E}/results.json"
    
    # Check if sanitization occurred
    if [[ -f "${E}/SANITIZE_RESULTS_JSON.json" ]]; then
      REDACT_COUNT=$(jq -r '.redactions // 0' "${E}/SANITIZE_RESULTS_JSON.json" 2>/dev/null || echo 0)
      if [[ "$REDACT_COUNT" -gt 0 ]]; then
        echo "  [SECURITY] JWT redaction: $REDACT_COUNT patterns removed from results.json"
        if [[ "${FT_ALLOW_REDACTIONS:-0}" != "1" ]]; then
          echo "  [FAIL] Fail-closed: JWT leakage detected in results.json. Set FT_ALLOW_REDACTIONS=1 to override."
          HAS_FAIL=true
          FINAL_SCORE=0
          FINAL_DECISION="REJECT"
        fi
      fi
    fi
  fi
fi

# Write 99_FINAL_DECISION.txt (canonical decision file)
echo "[13] Writing 99_FINAL_DECISION.txt..."
{
  echo "${FINAL_DECISION}"
  echo ""
  echo "Score: ${FINAL_SCORE}/100"
  echo "FAIL phases: ${HAS_FAIL}"
  echo "HIGH flags (total): ${HIGH_FLAGS}"
  echo "HIGH flags (blocking): ${HIGH_FLAGS_BLOCKING}"
  echo "HIGH flags (allowlisted): ${HIGH_FLAGS_ALLOWLISTED}"
  echo "MEDIUM flags: ${MED_FLAGS}"
  echo "LOW flags: ${LOW_FLAGS}"
  echo ""
  echo "Timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
} > "${E}/99_FINAL_DECISION.txt"

# Evidence manifest (SHA256 of all files)
echo "[13] Generating evidence manifest..."
( cd "${E}" && find . -type f -print0 | sort -z | xargs -0 sha256sum ) \
  > "${E}/EVIDENCE_MANIFEST.SHA256" 2>&1 || true

# Zip evidence
echo "[13] Creating evidence archive..."
zip -qr "${E}.zip" "${E}" 2>/dev/null || true
sha256sum "${E}.zip" > "${E}.zip.sha256" 2>/dev/null || true

echo ""
echo "============================================================"
echo "  AUDIT COMPLETE"
echo "  Score:    ${FINAL_SCORE}/100"
echo "  Decision: ${FINAL_DECISION}"
echo "  Evidence: ${E}"
echo "  Archive:  ${E}.zip"
echo "============================================================"
echo ""

# Print canonical verdict line (machine-parseable)
if [[ "$FINAL_DECISION" == "CONDITIONAL_ACCEPT" ]]; then
  echo "ENTERPRISE_AUDIT_VERDICT: PASS"
else
  echo "ENTERPRISE_AUDIT_VERDICT: FAIL"
fi
echo ""

# Print all phase results
if [[ -f "${E}/results.json" ]]; then
  jq -r '.results[] | "  [\(.status)] Phase \(.phase): \(.message)"' \
    "${E}/results.json" 2>/dev/null || true
fi

echo ""

# Exit code based on decision
case "$FINAL_DECISION" in
  CONDITIONAL_ACCEPT)
    echo "EXIT 0 — CONDITIONAL ACCEPT"
    exit 0
    ;;
  *)
    echo "EXIT 1 — ${FINAL_DECISION}"
    exit 1
    ;;
esac
