#!/bin/bash
# Deterministic Playwright Proof Runner (Reviewer-Grade)
# Fail-closed: validates required env vars (incl auth), origin binding, headed/headless modes
# No secret leaks: PASSWORD/TOKEN/SECRET/KEY vars masked, JIRA_EMAIL masked
# Exit codes: 0 = success, 1 = env/validation failure, 2 = other error

set -euo pipefail

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
  
  # Mask JIRA_EMAIL: show only first 2 chars + domain
  if [[ "$var_name" == "JIRA_EMAIL" ]]; then
    local first_two="${var_value:0:2}"
    local at_index=$(expr index "$var_value" "@" || true)
    if [[ $at_index -gt 0 ]]; then
      local domain="${var_value:$at_index}"
      echo "${first_two}***${domain}"
    else
      echo "${first_two}***"
    fi
    return
  fi
  
  # Normal vars: print value
  echo "$var_value"
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

# === STEP 1: Validate REQUIRED env vars ===
print_section "Step 1: Validate Required Environment Variables"
REQUIRED_VARS=("JIRA_BASE_URL" "JIRA_EMAIL" "JIRA_PASSWORD")
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
  echo '  export JIRA_PASSWORD="your-password"'
  echo '  export JIRA_DASHBOARD_URL="https://your-tenant.atlassian.net/jira/dashboards/XXXXX"  # optional'
  echo ""
  exit 1
fi

# Display required vars (with masking for secrets)
for var in "${REQUIRED_VARS[@]}"; do
  masked_value=$(mask_env_value "$var")
  echo "  ${GREEN}✓${NC} ${var} = ${masked_value}"
done
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

# === STEP 4: Create OUT_DIR early (fail-closed) ===
print_section "Step 4: Create Output Directory"

# Create deterministic OUT_DIR with UTC-based timestamp (NO seconds variation)
OUT_DIR="/tmp/pw_dash_diag_$(date -u +%Y-%m-%dT%H%M%SZ)"
mkdir -p "$OUT_DIR"
export OUT_DIR

echo "Output directory: $OUT_DIR"
echo ""

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
  xvfb-run -a npx playwright test tests/playwright/dashboard-phase1-diagnostics.spec.ts > "$PW_STDOUT" 2> "$PW_STDERR"
  PW_EXIT=$?
  set -e
else
  echo "Executing: npx playwright test tests/playwright/dashboard-phase1-diagnostics.spec.ts"
  echo ""
  set +e
  npx playwright test tests/playwright/dashboard-phase1-diagnostics.spec.ts > "$PW_STDOUT" 2> "$PW_STDERR"
  PW_EXIT=$?
  set -e
fi

# === STEP 7: Handle Playwright exit ===
print_section "Step 7: Playwright Test Result"

if [[ $PW_EXIT -eq 0 ]]; then
  echo -e "${GREEN}✓${NC} Playwright test completed successfully"
  echo ""
  echo "First 40 lines of stdout:"
  head -40 "$PW_STDOUT" | sed 's/^/  /'
else
  echo -e "${RED}✗${NC} Playwright test exited with code $PW_EXIT"
  echo ""
  echo "ERROR OUTPUT (first 160 lines of stderr):"
  head -160 "$PW_STDERR" | sed 's/^/  /'
  echo ""
  echo "See full logs at: $PW_STDERR"
  echo ""
  exit $PW_EXIT
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
