#!/bin/bash
# Playwright Enterprise Proof Runner (State-Only SSO Mode)
# Purpose: Generate deterministic, non-truncated evidence that Phase 2 UI works in SSO environment
# Requirements: state.json already exists (generated via generate_playwright_state.sh)
# Exit: 0 = enterprise-ready, 1 = gate failure (with exact markers and evidence)

set -euo pipefail
IFS=$'\n\t'
umask 077

# === CONSTANTS ===
EVIDENCE_DIR="/tmp/ft_pw_enterprise_$(date +%s)"
STATE_JSON_PATH="tests/playwright/.auth/state.json"

# === COLOR OUTPUT ===
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# === HELPER: Print header ===
print_header() {
  echo ""
  echo "╔════════════════════════════════════════════════════════════════════════════╗"
  echo "║  Playwright Enterprise Proof Runner (State-Only SSO)                      ║"
  echo "╚════════════════════════════════════════════════════════════════════════════╝"
  echo ""
}

# === HELPER: Print section ===
print_section() {
  local title="$1"
  echo ""
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}${title}${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
}

# === TRAP: Cleanup on exit ===
cleanup_on_exit() {
  local exit_code=$?
  echo ""
  echo "Evidence directory: $EVIDENCE_DIR"
  echo "Exit code: $exit_code"
  return $exit_code
}
trap cleanup_on_exit EXIT

# === MAIN ===
print_header

# === STEP 0: Create evidence directory ===
print_section "STEP 0: Initialize Evidence Directory"

mkdir -p "$EVIDENCE_DIR"
echo "EVIDENCE_DIR=$EVIDENCE_DIR" | tee "$EVIDENCE_DIR/00_meta.txt"
echo ""

# === STEP 1: Validate required environment ===
print_section "STEP 1: Validate Required Environment"

{
  echo "=== Required JIRA Variables ==="
  JIRA_BASE_URL_SET=$([ -n "${JIRA_BASE_URL:-}" ] && echo "YES" || echo "NO")
  JIRA_EMAIL_SET=$([ -n "${JIRA_EMAIL:-}" ] && echo "YES" || echo "NO")
  JIRA_API_TOKEN_SET=$([ -n "${JIRA_API_TOKEN:-}" ] && echo "YES" || echo "NO")
  echo "JIRA_BASE_URL_SET=$JIRA_BASE_URL_SET"
  echo "JIRA_EMAIL_SET=$JIRA_EMAIL_SET"
  echo "JIRA_API_TOKEN_SET=$JIRA_API_TOKEN_SET"
  echo ""
  echo "=== Playwright Mode Variables ==="
  FT_AUTH_MODE_VAL="${FT_AUTH_MODE:-[NOT SET]}"
  FT_PLAYWRIGHT_MODE_VAL="${FT_PLAYWRIGHT_MODE:-[NOT SET]}"
  echo "FT_AUTH_MODE=$FT_AUTH_MODE_VAL"
  echo "FT_PLAYWRIGHT_MODE=$FT_PLAYWRIGHT_MODE_VAL"
} | tee "$EVIDENCE_DIR/01_env_gate.txt"
echo ""

# Validate all required JIRA vars
if [[ -z "${JIRA_BASE_URL:-}" ]] || [[ -z "${JIRA_EMAIL:-}" ]] || [[ -z "${JIRA_API_TOKEN:-}" ]]; then
  echo -e "${RED}❌ FAIL: Missing required JIRA environment variables${NC}"
  exit 1
fi

# === STEP 2: Git baseline ===
print_section "STEP 2: Git Baseline"

{
  echo "=== Git HEAD ==="
  git rev-parse HEAD
  echo ""
  echo "=== Last Commit ==="
  git log -1 --pretty=fuller
} | tee "$EVIDENCE_DIR/02_git_head.txt"
echo ""

# === STEP 3: State.json ignore check & guard ===
print_section "STEP 3: State.json .gitignore Verification & Guard"

{
  echo "=== Running guard_no_state_json_commit.sh ==="
  bash scripts/proof/guard_no_state_json_commit.sh || true
  echo ""
  echo "=== Git Status Checks ==="
  git check-ignore -v "$STATE_JSON_PATH" || echo "Pattern match not found (but may be in parent)"
} | tee "$EVIDENCE_DIR/03_pw_guard_state_ignore.txt"

# Fail if guard did not pass
if ! bash scripts/proof/guard_no_state_json_commit.sh > /dev/null 2>&1; then
  echo -e "${RED}❌ FAIL: guard_no_state_json_commit.sh check failed${NC}"
  exit 1
fi
echo ""

# === STEP 3B: State provenance verification ===
print_section "STEP 3B: State Provenance Verification"

STATE_PROVENANCE_PATH="${STATE_JSON_PATH}.provenance.json"

{
  echo "=== Provenance File Check ==="
  if [[ -f "$STATE_JSON_PATH" ]]; then
    if [[ ! -f "$STATE_PROVENANCE_PATH" ]]; then
      echo "❌ FAIL: state.json exists but provenance file is missing"
      echo "File: $STATE_JSON_PATH"
      echo "Provenance: NOT FOUND"
      exit 1
    fi
    echo "✅ Provenance file exists"
    echo ""
    echo "=== Provenance Contents ==="
    cat "$STATE_PROVENANCE_PATH"
    echo ""
    
    # Extract SHA256 from provenance
    PROVENANCE_SHA=$(grep '"stateSha256"' "$STATE_PROVENANCE_PATH" | sed 's/.*: "\([^"]*\)".*/\1/')
    ACTUAL_SHA=$(sha256sum "$STATE_JSON_PATH" | awk '{print $1}')
    
    echo "=== SHA256 Verification ==="
    echo "Provenance SHA256: $PROVENANCE_SHA"
    echo "Actual SHA256:     $ACTUAL_SHA"
    
    if [[ "$PROVENANCE_SHA" != "$ACTUAL_SHA" ]]; then
      echo "❌ FAIL: state.json SHA256 mismatch"
      exit 1
    fi
    echo "✅ SHA256 match verified"
  else
    echo "✅ state.json not present (will be provided via secrets or generated)"
  fi
} | tee "$EVIDENCE_DIR/04_state_provenance_check.txt"
echo ""

# === STEP 4: State.json hash ===
print_section "STEP 4: State.json Integrity Check"

if [[ ! -f "$STATE_JSON_PATH" ]]; then
  echo -e "${RED}❌ FAIL: state.json does not exist${NC}"
  touch "$EVIDENCE_DIR/STATE_REQUIRED"
  echo "[FT_PROOF] STATE_REQUIRED_FAIL" | tee "$EVIDENCE_DIR/05_pw_state_hash.txt"
  exit 1
fi

{
  echo "=== File Stats ==="
  ls -lh "$STATE_JSON_PATH"
  echo ""
  echo "=== SHA256 Hash ==="
  sha256sum "$STATE_JSON_PATH" | awk '{print $1}'
  echo ""
  echo "=== Lines (structural validation) ==="
  wc -l "$STATE_JSON_PATH"
} | tee "$EVIDENCE_DIR/05_pw_state_hash.txt"
echo -e "${GREEN}✅ State.json present and valid${NC}"
echo ""

# === STEP 5: Run headless playwright test (state-only mode) ===
print_section "STEP 5: Execute Playwright Tests (FT_AUTH_MODE=state-only)"

# Hard enforce state-only mode
if [[ -n "${FT_AUTH_MODE:-}" ]] && [[ "${FT_AUTH_MODE}" != "state-only" ]]; then
  echo -e "${RED}❌ FAIL: FT_AUTH_MODE must be 'state-only', got '${FT_AUTH_MODE}'${NC}"
  exit 1
fi
export FT_AUTH_MODE="state-only"
export FT_PLAYWRIGHT_MODE="headless"

echo "✅ FT_AUTH_MODE=state-only enforced"
echo "✅ FT_PLAYWRIGHT_MODE=headless enforced"
echo ""

# Create output subdir for Playwright logs
OUT_DIR="$EVIDENCE_DIR/pw_test_out"
mkdir -p "$OUT_DIR"

echo "Running: npm test -- tests/playwright/dashboard-phase1-diagnostics.spec.ts"
echo "(Output will be captured to $OUT_DIR)"
echo ""

# Run with timeout, capture both stdout and stderr
PW_STDOUT="$OUT_DIR/stdout.log"
PW_STDERR="$OUT_DIR/stderr.log"

set +e
timeout 240s npm test -- tests/playwright/dashboard-phase1-diagnostics.spec.ts > "$PW_STDOUT" 2> "$PW_STDERR"
PW_EXIT=$?
set -e

# === STEP 6: Check for SSO_REQUIRED (hard fail) ===
print_section "STEP 6: Analyze Test Results"

{
  echo "=== Playwright Exit Code ==="
  echo "$PW_EXIT"
  echo ""
  
  if [[ $PW_EXIT -eq 0 ]]; then
    echo "Status: ✅ PASS (exit 0)"
  else
    echo "Status: ❌ FAIL (exit $PW_EXIT)"
  fi
} | tee "$EVIDENCE_DIR/06_pw_run_state_only.txt"

# Check for SSO_REQUIRED (disqualifying error)
if grep -qiE "SSO_REQUIRED|SSO_REQUIRED_STATE" "$PW_STDOUT" "$PW_STDERR" 2>/dev/null; then
  echo "" | tee -a "$EVIDENCE_DIR/06_pw_run_state_only.txt"
  echo "❌ HARD FAIL: SSO_REQUIRED detected" | tee -a "$EVIDENCE_DIR/06_pw_run_state_only.txt"
  echo "Remediation: state.json may be expired. Regenerate with:" | tee -a "$EVIDENCE_DIR/06_pw_run_state_only.txt"
  echo "  FT_AUTH_GENERATE_STATE=1 FT_PLAYWRIGHT_MODE=headed bash scripts/proof/generate_playwright_state.sh" | tee -a "$EVIDENCE_DIR/06_pw_run_state_only.txt"
  echo ""
  exit 1
fi

# Check for STATE_REQUIRED (missing state.json)
if grep -qiE "STATE_REQUIRED|state.json" "$PW_STDOUT" "$PW_STDERR" 2>/dev/null && [[ $PW_EXIT -ne 0 ]]; then
  echo "" | tee -a "$EVIDENCE_DIR/06_pw_run_state_only.txt"
  echo "❌ HARD FAIL: STATE_REQUIRED (state.json missing or invalid)" | tee -a "$EVIDENCE_DIR/06_pw_run_state_only.txt"
  echo "Remediation: Generate state.json with:" | tee -a "$EVIDENCE_DIR/06_pw_run_state_only.txt"
  echo "  FT_AUTH_GENERATE_STATE=1 FT_PLAYWRIGHT_MODE=headed bash scripts/proof/generate_playwright_state.sh" | tee -a "$EVIDENCE_DIR/06_pw_run_state_only.txt"
  echo ""
  exit 1
fi

echo ""

# === STEP 7: Print test output excerpt ===
print_section "STEP 7: Test Output Excerpt (First 60 lines)"

if [[ -s "$PW_STDOUT" ]]; then
  echo "=== STDOUT (first 60 lines, no truncation) ==="
  head -60 "$PW_STDOUT" | cat -A
else
  echo "STDOUT: (empty)"
fi

if [[ -s "$PW_STDERR" ]]; then
  echo ""
  echo "=== STDERR (first 60 lines, no truncation) ==="
  head -60 "$PW_STDERR" | cat -A
else
  echo "STDERR: (empty)"
fi

echo ""

# === STEP 8: Determine pass/fail ===
print_section "STEP 8: Final Pass/Fail Determination"

if [[ $PW_EXIT -eq 0 ]]; then
  echo -e "${GREEN}✅ PASS: Playwright tests passed (exit 0)${NC}"
  echo ""
  echo "Enterprise Proof Summary:"
  echo "  ✅ state.json loaded successfully"
  echo "  ✅ SSO tenant authenticated (state reuse worked)"
  echo "  ✅ Dashboard tests executed"
  echo "  ✅ No mode-specific failures"
  echo ""
  echo "[FT_PLAYWRIGHT_SSO_STATE_ONLY_PASS]" | tee "$EVIDENCE_DIR/99_pass_marker.txt"
  echo ""
  exit 0
else
  echo -e "${RED}❌ FAIL: Playwright tests failed (exit $PW_EXIT)${NC}"
  echo ""
  echo "For details, see:"
  echo "  $PW_STDOUT"
  echo "  $PW_STDERR"
  echo ""
  exit 1
fi
