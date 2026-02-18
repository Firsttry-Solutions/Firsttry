#!/bin/bash
# Deterministic Playwright Proof Runner (Reviewer-Grade)
# Non-Bypassable Guardrail Runner: pre-guard → cleanup → playwright → post-guard (always)
# Fail-closed: validates required env vars (incl auth), origin binding, headed/headless modes
# No secret leaks: PASSWORD/TOKEN/SECRET/KEY vars masked, JIRA_EMAIL masked
# Exit codes: 0 = success, 1 = env/validation failure, 2 = other error
# GUARDRAIL CONTRACT: PRE_GUARD and POST_GUARD ALWAYS run; cleanup always executes; exit code reflects primary failure

set -euo pipefail
IFS=$'\n\t'
umask 077

# === EXIT CODE TRACKING (NON-BYPASSABLE TRAP INFRASTRUCTURE) ===
RUNNER_EXIT=0
PLAYWRIGHT_EXIT=0
POST_GUARD_EXIT=0
PRE_GUARD_EXIT=0
CLEANUP_EXIT=0

# === COLOR OUTPUT ===
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# === HELPER: Mask sensitive env values ===
mask_env_value() {
  local var_name="$1"
  local var_value="${!var_name:-}"
  
  if [[ -z "$var_value" ]]; then
    echo "(not set)"
    return
  fi
  
  # Mask PASSWORD, TOKEN, SECRET, KEY vars
  if [[ "$var_name" =~ (PASSWORD|TOKEN|SECRET|KEY) ]]; then
    echo "(set)"
    return
  fi
  
  # Mask JIRA_EMAIL: show only first 2 chars + *** + @domain
  if [[ "$var_name" == "JIRA_EMAIL" ]]; then
    local first_two="${var_value:0:2}"
    local at_index=$(expr index "$var_value" "@" || true)
    if [[ $at_index -gt 0 ]]; then
      local domain="${var_value:$((at_index - 1))}"  # domain includes @
      echo "${first_two}***${domain}"
    else
      echo "${first_two}***"
    fi
    return
  fi
  
  # Normal vars: print value
  echo "$var_value"
}

# === HELPER: Sanitize output text (remove secrets) ===
sanitize_output() {
  # Read from stdin if no argument provided (for pipeline use)
  local text
  if [[ $# -eq 0 ]]; then
    text=$(cat)
  else
    text="$1"
  fi
  
  # Redact JIRA_API_TOKEN/TOKEN/SECRET/KEY env var values (if used for API)
  # NOTE: JIRA_PASSWORD is no longer used, but sanitize if present in logs for backwards compat
  if [[ -n "${JIRA_API_TOKEN:-}" ]]; then
    text="${text//"${JIRA_API_TOKEN}"/<REDACTED_API_TOKEN>}"
  fi
  if [[ -n "${JIRA_PASSWORD:-}" ]]; then
    # Legacy: sanitize if found in logs (not used in new flow)
    text="${text//"${JIRA_PASSWORD}"/<REDACTED_PASSWORD>}"
  fi
  if [[ -n "${JIRA_EMAIL:-}" ]]; then
    # Redact exact email first
    text="${text//"${JIRA_EMAIL}"/<REDACTED_EMAIL>}"
  fi
  
  # Redact email patterns: replace with generic redaction
  text=$(echo "$text" | sed -E 's/[a-zA-Z0-9._+-]+@[a-zA-Z0-9.-]+/[redacted-email]/g')
  
  # Redact JWT-like tokens (e.g., "ey...yJ....Xy...")
  text=$(echo "$text" | sed -E 's/[A-Za-z0-9_\-]{20,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}/<REDACTED_JWT>/g')
  
  # Redact "Authorization: Bearer ..." patterns
  text=$(echo "$text" | sed -E 's/Authorization: Bearer [A-Za-z0-9._\-]+/Authorization: Bearer <REDACTED>/g')
  
  # Redact "Bearer " tokens (anything after Bearer)
  text=$(echo "$text" | sed -E 's/Bearer [A-Za-z0-9._\-]+/Bearer <REDACTED>/g')
  
  # Redact any line with "password" or "token" containing a value
  text=$(echo "$text" | sed -E 's/(password|token|secret|authorization)=([^ ;,\)]+)/\1=<REDACTED>/gi')
  
  echo "$text"
}

# === HELPER: Print header ===
print_header() {
  echo ""
  echo "╔════════════════════════════════════════════════════════════════════════════╗"
  echo "║  Deterministic Playwright Proof Runner (Reviewer-Grade)                   ║"
  echo "╚════════════════════════════════════════════════════════════════════════════╝"
  echo ""
}

# === HELPER: Print section ===
print_section() {
  local title="$1"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}${title}${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# === MAIN ===
print_header

# === TRAP INFRASTRUCTURE: Non-bypassable cleanup and post-guard (ALWAYS runs) ===

# should_preserve_state: returns 0 (true) if state.json must NOT be deleted
should_preserve_state() {
  if [[ "${FT_PRESERVE_STATE_JSON:-}" == "1" ]]; then return 0; fi
  if [[ "${FT_AUTH_MODE:-}" == "state-only" ]]; then return 0; fi
  return 1
}

# cleanup_and_postguard: Executes state cleanup and post-guard verification
# MUST run on any exit: success, failure, timeout, CTRL-C
cleanup_and_postguard() {
  local trap_exit_code=$?
  RUNNER_EXIT=$trap_exit_code
  
  # === DEFENSE-IN-DEPTH: Delete state file (skip if state-only/preserve mode) ===
  if should_preserve_state; then
    echo "[FT_PROOF] STATE_JSON_PRESERVED=1"
    CLEANUP_EXIT=0
  else
    rm -f tests/playwright/.auth/state.json 2>/dev/null || true
    CLEANUP_EXIT=$?
  fi
  
  # === POST-GUARD: Always runs, even if cleanup failed ===
  echo ""
  print_section "Step X: Post-Guard Auth-State Safety Check (ON EXIT)"
  
  export FT_GUARD_PHASE="post"
  if should_preserve_state; then
    export FT_GUARD_EXPECT_STATE_CLEANUP=0
  else
    export FT_GUARD_EXPECT_STATE_CLEANUP=1
  fi
  bash scripts/proof/guard_no_auth_state_leak.sh >/dev/null 2>&1
  POST_GUARD_EXIT=$?
  
  # Get guard evidence directory
  local guard_dir_post=$(ls -1dt /tmp/pw_state_guard_* 2>/dev/null | head -1)
  if [[ -z "$guard_dir_post" ]] || [[ ! -f "$guard_dir_post/state-guard-result.json" ]]; then
    echo "[ERROR] Post-guard evidence file not created"
    POST_GUARD_EXIT=1
  else
    echo "[GUARD] POST_GUARD_DIR=$guard_dir_post"
    if [[ $POST_GUARD_EXIT -eq 0 ]]; then
      echo -e "${GREEN}✓${NC} Post-guard passed"
    else
      echo -e "${RED}✗${NC} Post-guard failed (exit $POST_GUARD_EXIT)"
    fi
  fi
  
  echo ""
  
  # Return 0 to avoid trap recursion; exit_final() will handle actual exit
  return 0
}

# exit_final: Determines final exit code with strict priority
# Priority (highest to lowest):
#   1. PRE_GUARD_EXIT (pre-guard must pass before Playwright runs)
#   2. PLAYWRIGHT_EXIT (Playwright failure is primary outcome)
#   3. CLEANUP_EXIT (should be 0; non-zero is unexpected)
#   4. POST_GUARD_EXIT (post-guard is defense-in-depth)
#   5. RUNNER_EXIT (general exit code)
exit_final() {
  local final_exit=0
  
  if [[ $PRE_GUARD_EXIT -ne 0 ]]; then
    final_exit=$PRE_GUARD_EXIT
    echo "[EXIT] PRE_GUARD_EXIT=$PRE_GUARD_EXIT (blocking Playwright execution)"
  elif [[ $PLAYWRIGHT_EXIT -ne 0 ]]; then
    final_exit=$PLAYWRIGHT_EXIT
    echo "[EXIT] PLAYWRIGHT_EXIT=$PLAYWRIGHT_EXIT (primary test failure)"
  elif [[ $CLEANUP_EXIT -ne 0 ]]; then
    final_exit=$CLEANUP_EXIT
    echo "[EXIT] CLEANUP_EXIT=$CLEANUP_EXIT (unexpected cleanup failure)"
  elif [[ $POST_GUARD_EXIT -ne 0 ]]; then
    final_exit=$POST_GUARD_EXIT
    echo "[EXIT] POST_GUARD_EXIT=$POST_GUARD_EXIT (defense-in-depth guard failure)"
  else
    final_exit=$RUNNER_EXIT
    if [[ $RUNNER_EXIT -eq 0 ]]; then
      echo "[EXIT] All gates passed (exit 0)"
    else
      echo "[EXIT] RUNNER_EXIT=$RUNNER_EXIT"
    fi
  fi
  
  exit $final_exit
}

# === TRAP: Handle EXIT, INT, TERM ===
trap 'cleanup_and_postguard; exit_final' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

# === TRAP: Interrupt handler for explicit messaging ===

# === STEP 1: Validate REQUIRED env vars ===
print_section "Step 1: Validate Required Environment Variables"
# NOTE: JIRA_PASSWORD is NO LONGER required (SSO-incompatible).
# For API-only calls, use JIRA_API_TOKEN.
# For UI automation with SSO tenants, use FT_AUTH_MODE=state-only with valid state.json.
REQUIRED_VARS=("JIRA_BASE_URL" "JIRA_EMAIL")
MISSING_VARS=()

for var in "${REQUIRED_VARS[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    MISSING_VARS+=("$var")
  fi
done

if [[ ${#MISSING_VARS[@]} -gt 0 ]]; then
  echo ""
  echo -e "${RED}ERROR: Missing required environment variable(s):${NC}"
  for var in "${MISSING_VARS[@]}"; do
    echo "  - ${var}"
  done
  echo ""
  echo "To run deterministically:"
  echo '  export JIRA_BASE_URL="https://your-tenant.atlassian.net"'
  echo '  export JIRA_EMAIL="your-email@example.com"'
  echo '  # Optional for API calls: export JIRA_API_TOKEN="your-api-token"'
  echo '  # IMPORTANT: For SSO tenants, generate state.json:'
  echo '  #   FT_AUTH_GENERATE_STATE=1 bash scripts/proof/generate_playwright_state.sh'
  echo '  #   Then rerun with: FT_AUTH_MODE=state-only'
  echo ""
  exit 1
fi

# Display required vars (with masking for secrets)
for var in "${REQUIRED_VARS[@]}"; do
  masked_value=$(mask_env_value "$var")
  echo "  ${GREEN}✓${NC} ${var} = ${masked_value}"
done

# Optional API token (allowed but not required for UI tests)
if [[ -n "${JIRA_API_TOKEN:-}" ]]; then
  echo "  ${GREEN}✓${NC} JIRA_API_TOKEN = (set)"
fi
echo ""

# === STEP 1b: Normalize JIRA_BASE_URL and validate format ===
print_section "Step 1b: Normalize & Validate Base URL"
RAW_BASE_URL="${JIRA_BASE_URL}"
NORM_BASE_URL="${RAW_BASE_URL%/}"  # Remove trailing slash

echo "Raw value:        $RAW_BASE_URL"
echo "Normalized value: $NORM_BASE_URL"
echo ""

# Validate URL format (must be https://)
if ! [[ "$NORM_BASE_URL" =~ ^https:// ]]; then
  echo -e "${RED}ERROR: JIRA_BASE_URL must use HTTPS protocol${NC}"
  echo "  Got: $NORM_BASE_URL"
  echo "  Expected format: https://your-tenant.atlassian.net"
  echo ""
  exit 1
fi

# Try parsing with node to ensure valid URL
node -e "new URL('$NORM_BASE_URL')" 2>/dev/null || {
  echo -e "${RED}ERROR: JIRA_BASE_URL is not a valid URL${NC}"
  echo "  Got: $NORM_BASE_URL"
  echo ""
  exit 1
}

echo -e "${GREEN}✓${NC} Base URL is valid HTTPS"
echo "[ENV] JIRA_BASE_URL_NORM=$NORM_BASE_URL"
echo ""

# Export normalized value for Playwright
export JIRA_BASE_URL="$NORM_BASE_URL"

# === STEP 1c: Validate JIRA_DASHBOARD_URL origin binding (if set) ===
if [[ -n "${JIRA_DASHBOARD_URL:-}" ]]; then
  print_section "Step 1c: Validate Dashboard URL Origin Binding"
  
  RAW_DASHBOARD_URL="${JIRA_DASHBOARD_URL}"
  NORM_DASHBOARD_URL="${RAW_DASHBOARD_URL%/}"  # Remove trailing slash
  
  echo "Dashboard URL: $NORM_DASHBOARD_URL"
  echo ""
  
  # Extract origin (scheme + host + optional port) from both URLs
  BASE_ORIGIN=$(node -e "const u = new URL('$NORM_BASE_URL'); console.log(u.origin)" 2>/dev/null)
  DASHBOARD_ORIGIN=$(node -e "const u = new URL('$NORM_DASHBOARD_URL'); console.log(u.origin)" 2>/dev/null)
  
  if [[ "$BASE_ORIGIN" != "$DASHBOARD_ORIGIN" ]]; then
    echo -e "${RED}ERROR: JIRA_DASHBOARD_URL origin does not match JIRA_BASE_URL${NC}"
    echo ""
    echo "  JIRA_BASE_URL origin:       $BASE_ORIGIN"
    echo "  JIRA_DASHBOARD_URL origin:  $DASHBOARD_ORIGIN"
    echo ""
    echo "Must use same origin (scheme + host) for both URLs."
    echo ""
    exit 1
  fi
  
  echo -e "${GREEN}✓${NC} Dashboard URL origin matches base URL origin: $BASE_ORIGIN"
  echo ""
fi

# === STEP 2: Validate Playwright execution mode ===
print_section "Step 2: Validate Playwright Execution Mode"

FT_PLAYWRIGHT_MODE="${FT_PLAYWRIGHT_MODE:-headless}"
echo "FT_PLAYWRIGHT_MODE=$FT_PLAYWRIGHT_MODE"
echo ""

PLAYWRIGHT_ARGS=("")
PLAYWRIGHT_MODE_DESC="headless (no UI)"

if [[ "$FT_PLAYWRIGHT_MODE" == "headed" ]]; then
  echo "Headed mode requested. Checking for display server..."
  
  if [[ -n "${DISPLAY:-}" ]]; then
    echo -e "${GREEN}✓${NC} DISPLAY is set: $DISPLAY"
    PLAYWRIGHT_ARGS+=("--headed")
    PLAYWRIGHT_MODE_DESC="headed (with DISPLAY)"
  elif command -v xvfb-run &> /dev/null; then
    echo -e "${GREEN}✓${NC} xvfb-run available (will use virtual display)"
    PLAYWRIGHT_ARGS+=("--headed")
    PLAYWRIGHT_MODE_DESC="headed (via xvfb-run)"
  else
    echo -e "${RED}ERROR: headed mode requested but no DISPLAY and xvfb-run not available${NC}"
    echo ""
    echo "Options:"
    echo "  1. Use headless mode (default): unset FT_PLAYWRIGHT_MODE"
    echo "  2. Install xvfb: apt-get install xvfb"
    echo "  3. Set DISPLAY if running with UI"
    echo ""
    exit 1
  fi
else
  echo -e "${GREEN}✓${NC} Using headless mode (default, container-friendly)"
  PLAYWRIGHT_MODE_DESC="headless (no UI, container-safe)"
fi

echo "Execution mode: $PLAYWRIGHT_MODE_DESC"
echo ""

# === STEP 3: Show environment variables scan ===
print_section "Step 3: Environment Variables Used by Tests"
echo "Scanning playwright.config.ts and tests for process.env references..."
echo ""

# Dynamically discover env vars from grep (truthful scan, not hard-coded list)
FOUND_VARS=$(grep -RIhn "process\.env\." playwright.config.ts tests/playwright 2>/dev/null | sed 's/.*process\.env\.//' | sed 's/[^A-Z_0-9].*//' | sort | uniq)

echo "Found environment variables in code:"
for var in $FOUND_VARS; do
  if [[ -n "${!var:-}" ]]; then
    masked_val=$(mask_env_value "$var")
    echo "  ${GREEN}✓${NC} ${var} = ${masked_val}"
  else
    echo "  ${YELLOW}⊘${NC} ${var} = (not set)"
  fi
done
echo ""

# === STEP 3b: Timeout configuration ===
print_section "Step 3b: Timeout Configuration"

FT_PLAYWRIGHT_TIMEOUT_SECONDS="${FT_PLAYWRIGHT_TIMEOUT_SECONDS:-240}"
echo "Playwright timeout: ${FT_PLAYWRIGHT_TIMEOUT_SECONDS}s"

if command -v timeout &> /dev/null; then
  echo -e "${GREEN}✓${NC} timeout command available (will enforce hard limit)"
else
  echo -e "${RED}ERROR: timeout command not found on system${NC}"
  echo "Cannot guarantee deterministic failure on hangs - exiting fail-closed."
  echo ""
  exit 2
fi
echo ""

# === STEP 4: Create OUT_DIR early (fail-closed) ===
print_section "Step 4: Create Output Directory"

# Create deterministic OUT_DIR with UTC-based timestamp (NO seconds variation)
OUT_DIR_VALUE="/tmp/pw_dash_diag_$(date -u +%Y-%m-%dT%H%M%SZ)"
mkdir -p "$OUT_DIR_VALUE"

# Force override any caller-provided OUT_DIR to avoid evidence going elsewhere
unset OUT_DIR || true
export OUT_DIR="$OUT_DIR_VALUE"

echo "Output directory: $OUT_DIR"
echo ""

# ============================================================================
# PRE-GUARD: Non-bypassable auth-state safety check (runs BEFORE Playwright)
# ============================================================================
print_section "Step 4b: Pre-Guard Auth-State Safety Check"

export FT_GUARD_PHASE="pre"
unset FT_GUARD_EXPECT_STATE_CLEANUP
bash scripts/proof/guard_no_auth_state_leak.sh >/dev/null 2>&1
PRE_GUARD_EXIT=$?

if [[ $PRE_GUARD_EXIT -ne 0 ]]; then
  echo "[ERROR] PRE_GUARD_EXIT=$PRE_GUARD_EXIT (auth-state safety check violated)"
  GUARD_DIR_PRE=$(ls -1dt /tmp/pw_state_guard_* 2>/dev/null | head -1 || true)
  if [[ -n "$GUARD_DIR_PRE" ]] && [[ -f "$GUARD_DIR_PRE/state-guard-result.json" ]]; then
    echo "[GUARD] PRE_GUARD_DIR=$GUARD_DIR_PRE"
    echo "Evidence:"
    cat "$GUARD_DIR_PRE/state-guard-result.json" | sed 's/^/  /'
  fi
  echo ""
  # Exit immediately; trap will still run post-guard
  exit $PRE_GUARD_EXIT
fi

GUARD_DIR_PRE=$(ls -1dt /tmp/pw_state_guard_* 2>/dev/null | head -1)
if [[ -z "$GUARD_DIR_PRE" ]] || [[ ! -f "$GUARD_DIR_PRE/state-guard-result.json" ]]; then
  echo "[ERROR] PRE_GUARD_EXIT=0 but evidence file not created"
  PRE_GUARD_EXIT=1
  exit 1
fi

echo "[GUARD] PRE_GUARD_DIR=$GUARD_DIR_PRE"
echo -e "${GREEN}✓${NC} Pre-guard passed"
echo ""

# ============================================================================
# STATE VALIDATION: Enforce auth-state based on FT_AUTH_MODE
# ============================================================================
print_section "Step 4c: Auth-State Validation"

FT_AUTH_MODE="${FT_AUTH_MODE:-interactive}"
STATE_FILE="tests/playwright/.auth/state.json"

if [[ "$FT_AUTH_MODE" == "state-only" ]]; then
  echo "Mode: state-only (requires cached state.json)"
  if [[ ! -f "$STATE_FILE" ]]; then
    echo "[AUTH_STATE] MISSING state.json for state-only mode"
    echo -e "${RED}ERROR: state-only mode requires tests/playwright/.auth/state.json${NC}"
    exit 1
  fi
  echo -e "${GREEN}✓${NC} state.json exists (injected by CI)"
else
  echo "Mode: $FT_AUTH_MODE (state.json will be managed by runner)"
  # For non-state-only modes, remove any lingering state unless explicitly allowed
  if [[ "${FT_ALLOW_LOCAL_STATE_FILE:-0}" != "1" ]]; then
    if [[ -f "$STATE_FILE" ]]; then
      rm -f "$STATE_FILE"
      echo "[STATE_CLEANUP] Removed lingering state.json before Playwright"
    fi
  fi
fi

echo ""

# ============================================================================
# TRAP: Ensure POST-GUARD sempre runs on exit (trap covers all exit paths)
# ============================================================================
cleanup_and_post_guard() {
  local exit_code=$?
  
  # Delete state before post-guard (skip if state-only/preserve mode)
  if should_preserve_state; then
    echo "[FT_PROOF] STATE_JSON_PRESERVED=1"
  else
    rm -f tests/playwright/.auth/state.json 2>/dev/null || true
  fi
  
  # Run post-guard with cleanup expectation
  echo ""
  print_section "Step X: Post-Guard Auth-State Safety Check (ON EXIT)"
  
  local expect_cleanup=1
  should_preserve_state && expect_cleanup=0
  FT_GUARD_PHASE="post" \
  FT_GUARD_EXPECT_STATE_CLEANUP=$expect_cleanup \
  bash scripts/proof/guard_no_auth_state_leak.sh || {
    echo "[ERROR] Post-guard failed: auth-state safety violation"
    exit 1
  }
  
  GUARD_DIR_POST=$(ls -1dt /tmp/pw_state_guard_* 2>/dev/null | head -1)
  if [[ -z "$GUARD_DIR_POST" ]] || [[ ! -f "$GUARD_DIR_POST/state-guard-result.json" ]]; then
    echo "[ERROR] Post-guard evidence file not created"
    exit 1
  fi
  
  echo "[GUARD] POST_GUARD_DIR=$GUARD_DIR_POST"
  echo -e "${GREEN}✓${NC} Post-guard passed"
  
  return $exit_code
}

trap cleanup_and_post_guard EXIT

# === STEP 5: Clean stale directories ===
print_section "Step 5: Clean Stale Output Directories"

# Find all previous pw_dash_diag_* directories and remove them (keep only current)
if find /tmp/pw_dash_diag_* -maxdepth 0 -type d 2>/dev/null | grep -v "^${OUT_DIR}$" > /tmp/stale_dirs.txt 2>&1; then
  while read -r stale_dir; do
    if [[ -n "$stale_dir" && "$stale_dir" != "$OUT_DIR" ]]; then
      rm -rf "$stale_dir" 2>/dev/null || true
    fi
  done < /tmp/stale_dirs.txt
  echo "  ${GREEN}✓${NC} Cleaned stale directories"
else
  echo "  ${YELLOW}⊘${NC} No stale directories found"
fi

echo "Removing stale /tmp/playwright-evidence directory..."
if rm -rf /tmp/playwright-evidence 2>/dev/null; then
  echo "  ${GREEN}✓${NC} Cleaned (if existed)"
else
  echo "  ${YELLOW}⊘${NC} None found"
fi
echo ""

# === STEP 6: Run Playwright test (capture output to files) ===
print_section "Step 6: Running Playwright Test"

PW_STDOUT="$OUT_DIR/playwright.stdout.log"
PW_STDERR="$OUT_DIR/playwright.stderr.log"

echo "Playwright output will be captured to:"
echo "  stdout: $PW_STDOUT"
echo "  stderr: $PW_STDERR"
echo ""

if [[ "$FT_PLAYWRIGHT_MODE" == "headed" && -z "${DISPLAY:-}" ]]; then
  echo "Using xvfb-run (virtual display server for headless containers)"
  echo ""
  set +e
  timeout --preserve-status "${FT_PLAYWRIGHT_TIMEOUT_SECONDS}s" xvfb-run -a npx playwright test tests/playwright/dashboard-phase1-diagnostics.spec.ts > "$PW_STDOUT" 2> "$PW_STDERR"
  PLAYWRIGHT_EXIT=$?
  set -e
else
  echo "Executing: timeout ${FT_PLAYWRIGHT_TIMEOUT_SECONDS}s npx playwright test tests/playwright/dashboard-phase1-diagnostics.spec.ts"
  echo ""
  set +e
  timeout --preserve-status "${FT_PLAYWRIGHT_TIMEOUT_SECONDS}s" \
    env OUT_DIR="$OUT_DIR" \
    JIRA_BASE_URL="$JIRA_BASE_URL" \
    npx playwright test tests/playwright/dashboard-phase1-diagnostics.spec.ts > "$PW_STDOUT" 2> "$PW_STDERR"
  PLAYWRIGHT_EXIT=$?
  set -e
fi

# === Check for timeout-class exit codes (124, 137, 143) ===
# 124 = timeout standard
# 137 = killed (SIGKILL)
# 143 = SIGTERM (what we observe with timeout --preserve-status)
if [[ $PLAYWRIGHT_EXIT -eq 124 || $PLAYWRIGHT_EXIT -eq 137 || $PLAYWRIGHT_EXIT -eq 143 ]]; then
  print_section "Step 6a: Timeout Occurred (Exit Code: $PLAYWRIGHT_EXIT)"
  
  # Write timeout evidence (no timestamps, deterministic, preserves exit code)
  # Key ordering: reasonCode, timeoutSeconds, exitCode, step (stable)
  timeout_reason="{\"reasonCode\":\"RUNNER_TIMEOUT\",\"timeoutSeconds\":${FT_PLAYWRIGHT_TIMEOUT_SECONDS},\"exitCode\":${PLAYWRIGHT_EXIT},\"step\":\"PLAYWRIGHT_EXEC\"}"
  echo "$timeout_reason" > "$OUT_DIR/runner-timeout-reason.json"
  echo "Timeout evidence written: $OUT_DIR/runner-timeout-reason.json"
  echo ""
  
  echo -e "${RED}Playwright test exceeded ${FT_PLAYWRIGHT_TIMEOUT_SECONDS}s timeout (exit code $PLAYWRIGHT_EXIT)${NC}"
  echo ""
  
  # Print failure excerpt from logs
  print_section "Step 6b: Timeout Failure Excerpt"
  
  STDOUT_SIZE=$(wc -c < "$PW_STDOUT" 2>/dev/null || echo "0")
  STDERR_SIZE=$(wc -c < "$PW_STDERR" 2>/dev/null || echo "0")
  
  echo "Output file sizes:"
  echo "  stdout: $STDOUT_SIZE bytes"
  echo "  stderr: $STDERR_SIZE bytes"
  echo ""
  
  # Prefer stderr if non-empty, else stdout, else say empty
  CHOSEN_FILE=""
  if [[ $STDERR_SIZE -gt 0 ]] && [[ -s "$PW_STDERR" ]]; then
    CHOSEN_FILE="$PW_STDERR"
    echo "Last 80 lines from stderr (timeout context):"
  elif [[ $STDOUT_SIZE -gt 0 ]] && [[ -s "$PW_STDOUT" ]]; then
    CHOSEN_FILE="$PW_STDOUT"
    echo "Last 80 lines from stdout (timeout context):"
  else
    echo "No output captured (likely killed before any output)"
  fi
  
  if [[ -n "$CHOSEN_FILE" ]]; then
    tail -80 "$CHOSEN_FILE" | sanitize_output | sed 's/^/  /'
  fi
  echo ""
  
  echo "Full logs available:"
  echo "  stdout: $PW_STDOUT"
  echo "  stderr: $PW_STDERR"
  echo ""
  
  # Normalize exit code to 124 for determinism
  exit 124
fi

# === STEP 7: Handle Playwright exit ===
print_section "Step 7: Playwright Test Result"

if [[ $PLAYWRIGHT_EXIT -eq 0 ]]; then
  echo -e "${GREEN}✓${NC} Playwright test completed successfully"
  echo ""
  echo "First 40 lines of stdout:"
  head -40 "$PW_STDOUT" | sed 's/^/  /'
else
  echo -e "${RED}✗${NC} Playwright test exited with code $PLAYWRIGHT_EXIT"
  echo ""
  
  # === STEP 7a: Print Failure Excerpt (deterministic, non-empty) ===
  print_section "Step 7a: Failure Excerpt (Sanitized)"
  
  # Get file sizes
  STDOUT_SIZE=$(wc -c < "$PW_STDOUT" 2>/dev/null || echo "0")
  STDERR_SIZE=$(wc -c < "$PW_STDERR" 2>/dev/null || echo "0")
  
  echo "Output file sizes:"
  echo "  stdout: $STDOUT_SIZE bytes"
  echo "  stderr: $STDERR_SIZE bytes"
  echo ""
  
  # Determine which stream to show (prefer stderr if non-empty, fallback to stdout)
  CHOSEN_FILE=""
  CHOSEN_LABEL=""
  
  if [[ $STDERR_SIZE -gt 0 ]] && [[ -s "$PW_STDERR" ]]; then
    CHOSEN_FILE="$PW_STDERR"
    CHOSEN_LABEL="stderr"
  elif [[ $STDOUT_SIZE -gt 0 ]] && [[ -s "$PW_STDOUT" ]]; then
    CHOSEN_FILE="$PW_STDOUT"
    CHOSEN_LABEL="stdout"
  else
    # Both empty - print error message
    echo -e "${RED}No output captured from either stdout or stderr${NC}"
    echo "Command run: npx playwright test tests/playwright/dashboard-phase1-diagnostics.spec.ts"
    echo "Output dir:  $OUT_DIR"
    echo ""
    exit $PLAYWRIGHT_EXIT
  fi
  
  echo "Using ${CHOSEN_LABEL} (has content)"
  echo ""
  
  echo "First 160 lines from $CHOSEN_LABEL:"
  head -160 "$CHOSEN_FILE" | sanitize_output | sed 's/^/  /'
  echo ""
  
  echo "Last 80 lines from $CHOSEN_LABEL (summary often at end):"
  tail -80 "$CHOSEN_FILE" | sanitize_output | sed 's/^/  /'
  echo ""
  
  # === STEP 7b: Grep for error keywords ===
  print_section "Step 7b: Error Keyword Search"
  
  echo "Searching both stdout and stderr for error keywords..."
  echo ""
  
  # Merge both logs, grep for error keywords (case-insensitive), limit to first 40 matches
  ERROR_LINES=$(
    {
      grep -iE "(error:|failed|exception|timeout|navigation|net::|ERR_|AUTH)" "$PW_STDERR" 2>/dev/null || true
      grep -iE "(error:|failed|exception|timeout|navigation|net::|ERR_|AUTH)" "$PW_STDOUT" 2>/dev/null || true
    } | head -40
  )
  
  if [[ -z "$ERROR_LINES" ]]; then
    echo -e "${YELLOW}⊘${NC} No error keywords found (may be a silent failure or non-standard error format)"
  else
    echo "Found error keywords (up to 40 lines, sanitized):"
    echo "$ERROR_LINES" | sanitize_output | sed 's/^/  /'
  fi
  echo ""
  
  echo "Full logs available:"
  echo "  stdout: $PW_STDOUT"
  echo "  stderr: $PW_STDERR"
  echo ""
    # === STEP 7c: FAIL-CLOSED on SSO_REQUIRED ===
  # SSO_REQUIRED is a hard gate failure, not a "conditional pass"
  # If tenant requires SSO, it must be handled via state-only mode with valid state.json
  if grep -qiE "SSO_REQUIRED|SSO_REQUIRED_STATE" "$PW_STDERR" "$PW_STDOUT" 2>/dev/null; then
    echo ""
    print_section "Step 7c: GATE FAILURE - SSO REQUIRED (Tenant is SSO-Only)"
    echo ""
    echo -e "${RED}❌ FAIL: Tenant is single sign-on (SSO) only${NC}"
    echo ""
    echo "Root cause: Email/password authentication cannot work with SSO tenants."
    echo ""
    echo "Remediation (choose one):"
    echo ""
    echo "  Option 1: Use state-only mode (RECOMMENDED for enterprise)"
    echo "    1. Run interactive login once to generate state.json:"
    echo "       FT_AUTH_GENERATE_STATE=1 bash scripts/proof/generate_playwright_state.sh"
    echo "    2. Verify state.json was created:"
    echo "       ls -la tests/playwright/.auth/state.json"
    echo "    3. Rerun tests with state-only mode:"
    echo "       FT_AUTH_MODE=state-only npm test -- playwright"
    echo ""
    echo "  Option 2: Use headed mode for manual SSO flow (local dev only)"
    echo "    FT_PLAYWRIGHT_MODE=headed FT_AUTH_MODE=interactive npm test -- playwright"
    echo ""
    echo "Proof standard: Gate MUST fail-closed when SSO is detected and no state.json is available."
    echo "This is not a code defect; it is correct enterprise security posture."
    echo ""
    exit 1
  fi
    # === DETERMINISTIC EVIDENCE CONTRACT CHECK ===
  # If Playwright failed during setup (auth timeout) and we find relevant error messages,
  # VERIFY that auth-failure-reason.json exists. Fail-closed if missing.
  if grep -q "AUTH_SETUP_TIMEOUT\|auth.setup" "$PW_STDERR" "$PW_STDOUT" 2>/dev/null; then
    if [[ ! -f "$OUT_DIR/auth-failure-reason.json" ]]; then
      echo -e "${RED}ERROR: Expected auth-failure-reason.json missing (evidence contract breach)${NC}"
      echo "Auth setup timeout or failure detected, but no evidence captured."
      echo "OUT_DIR: $OUT_DIR"
      echo "Files in OUT_DIR:"
      ls -lh "$OUT_DIR" 2>/dev/null || true
      echo ""
      exit 1
    fi
  fi
  
  exit $PLAYWRIGHT_EXIT
fi
echo ""

# === STEP 8: List generated files ===
print_section "Step 8: Generated Evidence Files"

if [[ -d "$OUT_DIR" ]]; then
  echo "Contents of $OUT_DIR:"
  ls -lh "$OUT_DIR"/ | tail -n +2 | awk '{printf "  %s %10s  %s\n", $1, $5, $9}'
  echo ""
else
  echo -e "${RED}ERROR: Output directory is not accessible${NC}"
  exit 2
fi

# === STEP 8: Verify markers in console.log ===
print_section "Step 9: Console Markers Verification"

CONSOLE_LOG="$OUT_DIR/console.log"
if [[ -f "$CONSOLE_LOG" ]]; then
  echo "Searching for [UI_EXPORT_STATE] marker..."
  UI_EXPORT_COUNT=$(grep -c '\[UI_EXPORT_STATE\]' "$CONSOLE_LOG" || echo "0")
  if [[ $UI_EXPORT_COUNT -gt 0 ]]; then
    echo -e "  ${GREEN}✓${NC} Found $UI_EXPORT_COUNT [UI_EXPORT_STATE] marker(s)"
  else
    echo -e "  ${YELLOW}⊘${NC} No [UI_EXPORT_STATE] marker found"
  fi
  
  echo "Searching for [PHASE1_EXPORT_*] markers..."
  EXPORT_MARKER_COUNT=$(grep -c '\[PHASE1_EXPORT_' "$CONSOLE_LOG" || echo "0")
  if [[ $EXPORT_MARKER_COUNT -gt 0 ]]; then
    echo -e "  ${GREEN}✓${NC} Found $EXPORT_MARKER_COUNT [PHASE1_EXPORT_*] marker(s)"
    echo ""
    echo "Export markers found:"
    grep '\[PHASE1_EXPORT_' "$CONSOLE_LOG" | head -5 | sed 's/^/    /'
  else
    echo -e "  ${YELLOW}⊘${NC} No [PHASE1_EXPORT_*] markers found"
  fi
else
  echo -e "${RED}ERROR: console.log not found in output directory${NC}"
  exit 2
fi
echo ""

# === STEP 9: Verify proof JSON ===
print_section "Step 10: Evidence Proof JSON Verification"

PROOF_JSON="$OUT_DIR/export-invoke-proof.json"
if [[ ! -f "$PROOF_JSON" ]]; then
  echo -e "${RED}ERROR: export-invoke-proof.json not found${NC}"
  echo "This is a critical evidence file. Proof generation failed."
  echo ""
  exit 1
fi

echo -e "${GREEN}✓${NC} export-invoke-proof.json found"
echo ""
echo "Proof content:"
cat "$PROOF_JSON" | sed 's/^/  /'
echo ""

# Verify JSON is valid and has required fields
if ! jq empty "$PROOF_JSON" 2>/dev/null; then
  echo -e "${RED}ERROR: export-invoke-proof.json is not valid JSON${NC}"
  exit 1
fi

REQUIRED_FIELDS=("exportAllowed" "invokeCount" "blockedRenderedCount")
for field in "${REQUIRED_FIELDS[@]}"; do
  if ! jq -e ".$field" "$PROOF_JSON" > /dev/null 2>&1; then
    echo -e "${RED}ERROR: export-invoke-proof.json missing required field: $field${NC}"
    exit 1
  fi
done

echo -e "${GREEN}✓${NC} Proof JSON is valid and contains all required fields"
echo ""

# === STEP 10: Final status ===
print_section "Step 11: Proof Generation Complete"

echo -e "${GREEN}✓${NC} All checks passed"
echo ""
echo "Evidence Location: $OUT_DIR"
echo "Proof Output:      $PROOF_JSON"
echo ""
echo "Next steps:"
echo "  1. Review export-invoke-proof.json"
echo "  2. Inspect console.log for markers"
echo "  3. Check network.log for resolver calls"
echo ""

exit 0
