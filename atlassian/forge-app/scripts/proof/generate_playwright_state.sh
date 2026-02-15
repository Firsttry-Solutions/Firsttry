#!/bin/bash
# Deterministic Playwright State.json Generator (SSO-Safe One-Time Setup)
# Purpose: Generate cached authentication state by running interactive login once
# Security: state.json contains session cookies/tokens - TREAT AS SECRET (like API keys)
# Usage: FT_AUTH_GENERATE_STATE=1 bash scripts/proof/generate_playwright_state.sh
# Then: Tests/CI must pass state.json via --storageState or env var to minimize repeated SSO flows

set -euo pipefail
IFS=$'\n\t'
umask 077

# === CONSTANTS ===
STATE_PATH="tests/playwright/.auth/state.json"
STATE_BACKUP_PATH="${STATE_PATH}.backup"
STATE_HASH_ALGO="sha256"

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
  echo "║  Playwright State.json Generator (SSO-Safe Interactive Setup)             ║"
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

# === STEP 1: Require explicit opt-in ===
print_section "Step 1: Safety Check (Prevent Accidental Runs)"

if [[ -z "${FT_AUTH_GENERATE_STATE:-}" ]] || [[ "${FT_AUTH_GENERATE_STATE}" != "1" ]]; then
  echo -e "${RED}ERROR: This script requires explicit opt-in${NC}"
  echo ""
  echo "This script will open an interactive browser to login to Jira."
  echo "The resulting session state will be saved to:"
  echo "  $STATE_PATH"
  echo ""
  echo "To proceed (understanding the security implications):"
  echo "  FT_AUTH_GENERATE_STATE=1 FT_PLAYWRIGHT_MODE=headed bash $0"
  echo ""
  exit 1
fi

echo -e "${GREEN}✓${NC} Explicit opt-in confirmed (FT_AUTH_GENERATE_STATE=1)"
echo ""

# === STEP 1B: Require headed mode ===
print_section "Step 1B: Headed Mode Requirement"

if [[ -z "${FT_PLAYWRIGHT_MODE:-}" ]] || [[ "${FT_PLAYWRIGHT_MODE}" != "headed" ]]; then
  echo -e "${RED}ERROR: FT_PLAYWRIGHT_MODE must be 'headed' for state generation${NC}"
  echo ""
  echo "Set it explicitly:"
  echo "  export FT_PLAYWRIGHT_MODE=headed"
  echo ""
  exit 1
fi

echo -e "${GREEN}✓${NC} Headed mode required (FT_PLAYWRIGHT_MODE=headed)"
echo ""

# === STEP 2: Validate required environment ===
print_section "Step 2: Validate Required Environment"

if [[ -z "${JIRA_BASE_URL:-}" ]]; then
  echo -e "${RED}ERROR: Missing JIRA_BASE_URL${NC}"
  echo ""
  echo "Set it explicitly:"
  echo '  export JIRA_BASE_URL="https://your-tenant.atlassian.net"'
  echo ""
  exit 1
fi

JIRA_BASE_URL_NORM="${JIRA_BASE_URL%/}"  # Remove trailing slash
echo -e "${GREEN}✓${NC} JIRA_BASE_URL = $JIRA_BASE_URL_NORM"

if ! [[ "$JIRA_BASE_URL_NORM" =~ ^https:// ]]; then
  echo -e "${RED}ERROR: JIRA_BASE_URL must use HTTPS${NC}"
  exit 1
fi

echo ""

# === STEP 2B: Verify .gitignore protects state.json ===
print_section "Step 2B: .gitignore Enforcement Check"

if ! git check-ignore -q tests/playwright/.auth/state.json 2>/dev/null; then
  echo -e "${RED}ERROR: state.json is NOT in .gitignore${NC}"
  echo "Add to .gitignore:"
  echo '  tests/playwright/.auth/state.json'
  exit 1
fi

echo -e "${GREEN}✓${NC} state.json is protected by .gitignore"
echo ""

# === STEP 3: Check for display server (MANDATORY) ===
print_section "Step 3: Display Server Check (Headed Mode Required)"

if [[ -z "${DISPLAY:-}" ]] && ! command -v xvfb-run &> /dev/null; then
  echo -e "${RED}ERROR: No display available. Run this script on a machine with a GUI OR install xvfb-run.${NC}"
  echo ""
  echo "This script requires headed (interactive) Playwright mode for SSO login."
  echo "It cannot be run in CI/automation without a display server."
  echo ""
  echo "Options:"
  echo "  1. If using local machine with display:"
  echo "     export DISPLAY=:0  # or your actual DISPLAY value"
  echo ""
  echo "  2. If your environment has xvfb-run available:"
  echo "     apt-get install xvfb"
  echo ""
  echo "  3. For CI with X11 forwarding:"
  echo "     ssh -X user@host"
  echo ""
  exit 1
fi

if [[ -n "${DISPLAY:-}" ]]; then
  echo -e "${GREEN}✓${NC} DISPLAY is set: $DISPLAY"
else
  echo -e "${GREEN}✓${NC} xvfb-run available (will use virtual display)"
fi

echo ""

# === STEP 4: Backup existing state (if any) ===
print_section "Step 4: Backup Existing State (if Present)"

if [[ -f "$STATE_PATH" ]]; then
  echo "Found existing state.json, creating backup..."
  cp "$STATE_PATH" "$STATE_BACKUP_PATH"
  echo -e "${GREEN}✓${NC} Backed up to: $STATE_BACKUP_PATH"
  echo ""
fi

# === STEP 5: Create auth directory ===
print_section "Step 5: Prepare Auth Directory"

AUTH_DIR=$(dirname "$STATE_PATH")
mkdir -p "$AUTH_DIR"
echo "Auth directory: $AUTH_DIR"
echo -e "${GREEN}✓${NC} Created/verified"
echo ""

# === STEP 6: Generate state with interactive login ===
print_section "Step 6: Running Interactive Playwright Login"

echo "A browser window will open for you to login."
echo "Complete the Atlassian login (including SSO/MFA) to generate state.json."
echo ""
echo "Browser will:"
echo "  1. Navigate to: $JIRA_BASE_URL_NORM/jira/your-work"
echo "  2. Show login form (or redirect to SSO)"
echo "  3. Wait for you to type username/password (or complete SSO)"
echo "  4. Save session cookies to: $STATE_PATH"
echo ""
echo "The browser window will close automatically after successful login."
echo "Do NOT close the browser manually until told."
echo ""
read -p "Press ENTER to start browser, or Ctrl+C to cancel..."
echo ""

# Create a temporary Node script to run Playwright auth generation
TEMP_AUTH_SCRIPT=$(mktemp /tmp/auth_gen_XXXXXX.mjs)
trap "rm -f '$TEMP_AUTH_SCRIPT'" EXIT

cat > "$TEMP_AUTH_SCRIPT" << 'NODEJS_EOF'
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const JIRA_BASE_URL = process.env.JIRA_BASE_URL.replace(/\/$/, '');
const STATE_PATH = 'tests/playwright/.auth/state.json';

(async () => {
  let browser = null;
  try {
    console.log('[AUTH_GEN] Starting headed browser...');
    
    browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    const jiraUrl = `${JIRA_BASE_URL}/jira/your-work`;
    console.log(`[AUTH_GEN] Navigating to: ${jiraUrl}`);
    
    await page.goto(jiraUrl, { waitUntil: 'domcontentloaded' });

    // Poll for authentication proof with user interaction
    console.log('[AUTH_GEN] Waiting for your manual login (600s timeout)...');
    console.log('[AUTH_GEN] Polling /myself API every 3s to detect successful auth...');
    
    const deadline = Date.now() + 600_000; // 10 minutes
    let authenticated = false;

    while (Date.now() < deadline && !authenticated) {
      try {
        const resp = await page.request.get(`${JIRA_BASE_URL}/rest/api/3/myself`);
        const status = resp.status();
        
        if (status === 200) {
          console.log('[AUTH_GEN] ✓ Authentication detected (myself API returned 200)');
          authenticated = true;
          break;
        } else {
          console.log(`[AUTH_GEN] Not authenticated yet (myself returned ${status}), retrying in 3s...`);
        }
      } catch (err) {
        console.log(`[AUTH_GEN] API check failed: ${err.message}, retrying in 3s...`);
      }

      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    if (!authenticated) {
      console.error('[AUTH_GEN] ❌ FAILED: Login not completed within 600s');
      process.exit(1);
    }

    // Save state
    console.log(`[AUTH_GEN] Saving auth state to: ${STATE_PATH}`);
    await context.storageState({ path: STATE_PATH });

    // Verify state was created
    if (!fs.existsSync(STATE_PATH)) {
      throw new Error('State file not created');
    }

    const stats = fs.statSync(STATE_PATH);
    console.log(`[AUTH_GEN] ✓ State saved (${stats.size} bytes)`);

    // Close browser
    await context.close();
    await browser.close();

    console.log('[AUTH_GEN] ✓ Done - Browser closed, state.json ready for use');
    process.exit(0);

  } catch (error) {
    console.error(`[AUTH_GEN] ❌ Error: ${error.message}`);
    if (browser) {
      await browser.close().catch(() => {});
    }
    process.exit(1);
  }
})();
NODEJS_EOF

# Run the auth generation (set NODE_PATH for module resolution)
export NODE_PATH="$(pwd)/node_modules"
JIRA_BASE_URL="$JIRA_BASE_URL_NORM" node "$TEMP_AUTH_SCRIPT"
AUTH_GEN_EXIT=$?

if [[ $AUTH_GEN_EXIT -ne 0 ]]; then
  echo -e "${RED}❌ State generation failed${NC}"
  echo ""
  if [[ -f "$STATE_BACKUP_PATH" ]]; then
    echo "Restoring backup state.json..."
    cp "$STATE_BACKUP_PATH" "$STATE_PATH"
    echo -e "${GREEN}✓${NC} Backup restored"
  fi
  exit 1
fi

echo ""

# === STEP 7: Verify state file ===
print_section "Step 7: State File Verification"

if [[ ! -f "$STATE_PATH" ]]; then
  echo -e "${RED}ERROR: State file not created${NC}"
  exit 1
fi

STATE_SIZE=$(wc -c < "$STATE_PATH")
echo -e "${GREEN}✓${NC} State file exists (${STATE_SIZE} bytes)"

# Calculate SHA256 hash
if command -v sha256sum &> /dev/null; then
  STATE_HASH=$(sha256sum "$STATE_PATH" | awk '{print $1}')
  echo "SHA256: $STATE_HASH"
elif command -v shasum &> /dev/null; then
  STATE_HASH=$(shasum -a 256 "$STATE_PATH" | awk '{print $1}')
  echo "SHA256: $STATE_HASH"
else
  echo "SHA256: (command not available)"
  STATE_HASH="<unavailable>"
fi

echo ""

# === STEP 7B: Generate state provenance file ===
print_section "Step 7B: Generate State Provenance"

STATE_PROVENANCE_PATH="${STATE_PATH}.provenance.json"

# Extract JIRA origin only (scheme + origin, no path)
JIRA_ORIGIN=$(echo "$JIRA_BASE_URL_NORM" | sed -E 's|^(https?://[^/]+).*|\1|')

# Get current git HEAD
GIT_HEAD=$(git rev-parse HEAD 2>/dev/null || echo "unknown")

# Hash the generator script itself
if command -v sha256sum &> /dev/null; then
  GENERATOR_HASH=$(sha256sum scripts/proof/generate_playwright_state.sh | awk '{print $1}')
elif command -v shasum &> /dev/null; then
  GENERATOR_HASH=$(shasum -a 256 scripts/proof/generate_playwright_state.sh | awk '{print $1}')
else
  GENERATOR_HASH="<unavailable>"
fi

# Create provenance JSON
{
  cat << PROVENANCE_EOF
{
  "marker": "FT_PLAYWRIGHT_STATE_PROVENANCE_V1",
  "createdUtc": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')",
  "jiraBaseUrlOrigin": "$JIRA_ORIGIN",
  "stateSha256": "$STATE_HASH",
  "generatorScriptSha256": "$GENERATOR_HASH",
  "gitHead": "$GIT_HEAD"
}
PROVENANCE_EOF
} > "$STATE_PROVENANCE_PATH"

echo -e "${GREEN}✓${NC} Provenance file created: $STATE_PROVENANCE_PATH"
echo ""

# Verify provenance
if [[ -f "$STATE_PROVENANCE_PATH" ]]; then
  echo "Provenance contents:"
  cat "$STATE_PROVENANCE_PATH"
  echo ""
else
  echo -e "${RED}ERROR: Failed to create provenance file${NC}"
  exit 1
fi

echo ""

# === STEP 8: Security reminder ===
print_section "Step 8: Security Reminder"

echo -e "${YELLOW}⚠️  IMPORTANT: State.json contains session cookies/tokens${NC}"
echo ""
echo "Security best practices:"
echo "  1. Treat state.json like an API key (it IS authentication material)"
echo "  2. Store in encrypted secrets storage only (GitHub Actions Secrets, etc.)"
echo "  3. Version control: Add to .gitignore (never commit to git)"
echo "  4. Rotation: Regenerate state.json periodically (monthly recommended)"
echo "  5. Use dedicated low-privilege test user"
echo "  6. Do NOT share state.json across environments"
echo "  7. Delete state.json from local machine after committing to secrets manager"
echo ""

# === STEP 9: .gitignore check ===
print_section "Step 9: .gitignore Configuration"

GITIGNORE_FILE=".gitignore"
STATE_GITIGNORE_PATTERN="$STATE_PATH"

if [[ ! -f "$GITIGNORE_FILE" ]]; then
  echo "Creating .gitignore..."
  echo "$STATE_GITIGNORE_PATTERN" >> "$GITIGNORE_FILE"
  echo -e "${GREEN}✓${NC} Created $GITIGNORE_FILE with $STATE_GITIGNORE_PATTERN"
elif grep -q "^${STATE_GITIGNORE_PATTERN}$" "$GITIGNORE_FILE"; then
  echo -e "${GREEN}✓${NC} $STATE_GITIGNORE_PATTERN already in $GITIGNORE_FILE"
else
  echo "Adding $STATE_GITIGNORE_PATTERN to $GITIGNORE_FILE..."
  echo "$STATE_GITIGNORE_PATTERN" >> "$GITIGNORE_FILE"
  echo -e "${GREEN}✓${NC} Added"
fi

echo ""

# === STEP 10: Enterprise Proof Marker ===
print_section "Step 10: Generation Complete (Enterprise Proof)"

echo "✅ State generation completed successfully"
echo ""
echo "Evidence:"
echo "  State file path: $STATE_PATH"
echo "  File size: $STATE_SIZE bytes"
echo "  SHA256: $STATE_HASH"
echo "  Timestamp: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo ""
echo "[FT_PLAYWRIGHT_STATE_GENERATED]"
echo ""
echo "Next steps:"
echo "  1. Securely store this state.json (do not commit to git)"
echo "  2. For CI/GitHub Actions:"
echo "     - Base64 encode: base64 -w0 $STATE_PATH | xclip"
echo "     - Create GitHub secret: PLAYWRIGHT_STATE_B64"
echo "     - Decode in CI before tests run"
echo "  3. Run tests with state-only mode:"
echo "     FT_AUTH_MODE=state-only npm test -- playwright"
echo ""
echo "To revert to backup (if you generated by mistake):"
if [[ -f "$STATE_BACKUP_PATH" ]]; then
  echo "  cp $STATE_BACKUP_PATH $STATE_PATH"
else
  echo "  rm $STATE_PATH"
fi
echo ""
