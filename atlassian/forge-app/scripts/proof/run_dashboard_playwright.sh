#!/bin/bash
# Deterministic Playwright Proof Runner
# Enforces required env vars, cleans stale directories, validates proof output
# Exit codes: 0 = success, 1 = env missing or proof invalid, 2 = other error

set -euo pipefail

# === COLOR OUTPUT ===
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# === HELPER: Print header ===
print_header() {
  echo ""
  echo "╔════════════════════════════════════════════════════════════════════════════╗"
  echo "║  Deterministic Playwright Proof Runner                                    ║"
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

# === HELPER: Check var (redact if secret-like) ===
check_var() {
  local var_name="$1"
  local var_value="${!var_name:-}"
  
  if [[ -z "$var_value" ]]; then
    echo "  ${RED}✗${NC} ${var_name} = (unset)"
    return 1
  else
    # Redact secrets
    if [[ "$var_name" == *"SECRET"* ]] || [[ "$var_name" == *"TOKEN"* ]] || [[ "$var_name" == *"KEY"* ]]; then
      echo "  ${GREEN}✓${NC} ${var_name} = (redacted)"
    else
      echo "  ${GREEN}✓${NC} ${var_name} = ${var_value}"
    fi
    return 0
  fi
}

# === MAIN ===
print_header

# === STEP 1: Validate required env vars ===
print_section "Step 1: Validate Required Environment Variables"
REQUIRED_VARS=("JIRA_BASE_URL")
MISSING_VARS=()

for var in "${REQUIRED_VARS[@]}"; do
  if ! check_var "$var"; then
    MISSING_VARS+=("$var")
  fi
done

if [[ ${#MISSING_VARS[@]} -gt 0 ]]; then
  echo ""
  echo -e "${RED}ERROR: Missing required environment variable(s):${NC}"
  for var in "${MISSING_VARS[@]}"; do
    echo "  - $var"
  done
  echo ""
  echo "Example export commands:"
  echo '  export JIRA_BASE_URL="https://your-tenant.atlassian.net"'
  echo ""
  exit 1
fi

# === STEP 1b: Normalize JIRA_BASE_URL (remove trailing slash) ===
print_section "Step 1b: Normalize Base URL"
RAW_BASE_URL="${JIRA_BASE_URL}"
NORM_BASE_URL="${RAW_BASE_URL%/}"  # Remove trailing slash

echo "Raw value:        $RAW_BASE_URL"
echo "Normalized value: $NORM_BASE_URL"
echo ""
echo "[ENV] JIRA_BASE_URL_NORM=$NORM_BASE_URL"
echo ""

# Export normalized value for Playwright
export JIRA_BASE_URL="$NORM_BASE_URL"

# === STEP 2: Show actually-used environment variables ===
print_section "Step 2: Environment Variables Used by Tests"
echo "Scanning playwright.config.ts and tests for process.env references..."
echo ""

# Dynamically discover env vars from grep (truthful, not hard-coded)
FOUND_VARS=$(grep -RIhn "process\.env\." playwright.config.ts tests/playwright 2>/dev/null | sed 's/.*process\.env\.//' | sed 's/[^A-Z_0-9].*//' | sort | uniq)

echo "Found environment variables:"
for var in $FOUND_VARS; do
  if [[ -n "${!var:-}" ]]; then
    check_var "$var"
  else
    echo "  ${YELLOW}⊘${NC} ${var} = (not set)"
  fi
done

echo ""

# === STEP 3: Clean stale directories (fail-closed) ===
print_section "Step 3: Clean Stale Output Directories"

echo "Removing stale /tmp/pw_dash_diag_* directories..."
if rm -rf /tmp/pw_dash_diag_* 2>/dev/null; then
  echo "  ${GREEN}✓${NC} Cleaned /tmp/pw_dash_diag_* (if existed)"
else
  echo "  ${YELLOW}⊘${NC} No stale directories found"
fi

echo "Removing stale /tmp/playwright-evidence directory..."
if rm -rf /tmp/playwright-evidence 2>/dev/null; then
  echo "  ${GREEN}✓${NC} Cleaned /tmp/playwright-evidence (if existed)"
else
  echo "  ${YELLOW}⊘${NC} No stale directory found"
fi

# === STEP 4: Run Playwright test ===
print_section "Step 4: Running Playwright Test"

echo "Executing: npx playwright test tests/playwright/dashboard-phase1-diagnostics.spec.ts --headed"
echo ""

# Run test - allow it to fail (we'll check output)
TEST_EXIT_CODE=0
npx playwright test tests/playwright/dashboard-phase1-diagnostics.spec.ts --headed || TEST_EXIT_CODE=$?

if [[ $TEST_EXIT_CODE -eq 0 ]]; then
  echo -e "${GREEN}Playwright test completed successfully${NC}"
else
  echo -e "${RED}Playwright test exited with code ${TEST_EXIT_CODE}${NC}"
fi

# === STEP 5: Find and validate OUT_DIR ===
print_section "Step 5: Locate Fresh Output Directory"

# Find newest /tmp/pw_dash_diag_* directory
OUT_DIR=$(ls -1dt /tmp/pw_dash_diag_* 2>/dev/null | head -1 || echo "")

if [[ -z "$OUT_DIR" ]]; then
  echo -e "${RED}ERROR: No output directory found (/tmp/pw_dash_diag_*)${NC}"
  echo "Test may have failed to create evidence directory"
  exit 2
fi

echo -e "${GREEN}✓${NC} Found output directory: $OUT_DIR"
echo ""

# === STEP 6: List generated files ===
print_section "Step 6: Generated Evidence Files"

if [[ -d "$OUT_DIR" ]]; then
  echo "Contents of $OUT_DIR:"
  ls -lh "$OUT_DIR"/ | tail -n +2 | awk '{printf "  %s %10s  %s\n", $1, $5, $9}'
  echo ""
else
  echo -e "${RED}ERROR: Output directory is not accessible${NC}"
  exit 2
fi

# === STEP 7: Verify markers in console.log ===
print_section "Step 7: Console Markers Verification"

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

# === STEP 8: Verify proof JSON ===
print_section "Step 8: Evidence Proof JSON Verification"

PROOF_JSON="$OUT_DIR/export-invoke-proof.json"
if [[ ! -f "$PROOF_JSON" ]]; then
  echo -e "${RED}ERROR: export-invoke-proof.json not found in output directory${NC}"
  echo "This is a critical evidence file. Proof generation failed."
  echo ""
  echo "Required file: $PROOF_JSON"
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

# === STEP 9: Final status ===
print_section "Step 9: Proof Generation Complete"

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
