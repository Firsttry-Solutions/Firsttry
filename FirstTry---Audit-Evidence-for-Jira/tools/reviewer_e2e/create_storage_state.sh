#!/bin/bash
set -euo pipefail

# StorageState Generator for Jira Authentication
# Interactive script that opens a headed browser for manual login

# ============================================================================
# Configuration
# ============================================================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FORGE_APP="$REPO_ROOT/atlassian/forge-app"
AUTH_DIR="$FORGE_APP/tests/playwright/.auth"
STORAGE_STATE="$AUTH_DIR/storageState.json"

JIRA_BASE_URL="${JIRA_BASE_URL:-}"

# ============================================================================
# Prerequisites
# ============================================================================
echo "============================================================"
echo "JIRA STORAGE STATE GENERATOR"
echo "============================================================"
echo ""

if [ -z "$JIRA_BASE_URL" ]; then
  echo "[FATAL] JIRA_BASE_URL environment variable is required" >&2
  echo "" >&2
  echo "Example:" >&2
  echo "  export JIRA_BASE_URL=https://yourcompany.atlassian.net" >&2
  echo "  bash $0" >&2
  echo "" >&2
  exit 2
fi

# Validate URL format
if ! echo "$JIRA_BASE_URL" | grep -qE '^https://[A-Za-z0-9.-]+\.atlassian\.net$'; then
  echo "[FATAL] JIRA_BASE_URL must match: https://*.atlassian.net" >&2
  echo "Got: $JIRA_BASE_URL" >&2
  exit 2
fi

echo "[INFO] JIRA Base URL: $JIRA_BASE_URL"
echo "[INFO] Storage State: $STORAGE_STATE"
echo ""

# Check if playwright is installed
if ! command -v npx >/dev/null 2>&1; then
  echo "[FATAL] npx not found. Install Node.js." >&2
  exit 2
fi

cd "$FORGE_APP"

if [ ! -f "package.json" ] || ! grep -q "@playwright/test" package.json; then
  echo "[FATAL] Playwright not found in package.json" >&2
  echo "[FATAL] Run: cd $FORGE_APP && npm install" >&2
  exit 2
fi

# ============================================================================
# Create auth directory
# ============================================================================
mkdir -p "$AUTH_DIR"

if [ -f "$STORAGE_STATE" ]; then
  echo "[WARN] Existing storageState found. It will be overwritten."
  echo "[WARN] Press Ctrl+C to cancel, or Enter to continue..."
  read -r
fi

# ============================================================================
# Generate interactive auth script
# ============================================================================
echo "[INFO] Creating interactive authentication script..."

AUTH_SCRIPT="$AUTH_DIR/generate_storage_state.mjs"

cat > "$AUTH_SCRIPT" <<'EOF'
import { chromium } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const JIRA_BASE_URL = process.env.JIRA_BASE_URL;
const STORAGE_STATE_PATH = process.argv[2];

if (!JIRA_BASE_URL) {
  console.error('[FATAL] JIRA_BASE_URL environment variable required');
  process.exit(2);
}

if (!STORAGE_STATE_PATH) {
  console.error('[FATAL] Usage: node generate_storage_state.mjs <output_path>');
  process.exit(2);
}

console.log('============================================================');
console.log('INTERACTIVE JIRA LOGIN');
console.log('============================================================');
console.log('');
console.log('A browser window will open. Please:');
console.log('  1. Log in to Jira with your credentials');
console.log('  2. Complete any 2FA/MFA challenges');
console.log('  3. Wait for the Jira homepage to load');
console.log('  4. This script will auto-detect login and save session');
console.log('');
console.log('Do NOT close the browser manually. It will close automatically.');
console.log('============================================================');
console.log('');

(async () => {
  const browser = await chromium.launch({ 
    headless: false,
    channel: 'chromium'
  });
  
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  });
  
  const page = await context.newPage();
  
  console.log(`[INFO] Opening: ${JIRA_BASE_URL}`);
  await page.goto(JIRA_BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  
  console.log('[INFO] Waiting for login...');
  console.log('[INFO] Please complete login in the browser window');
  console.log('');
  
  // Wait for one of several post-login indicators
  const loginIndicators = [
    '[data-testid="navigation-apps-sidebar-next-gen"]',  // Jira nav
    '[data-testid="jira-navigation"]',
    '[data-test-id="atlassian-navigation"]',
    'a[href*="/jira/dashboards"]',
    'button[aria-label*="Profile"]',
    '[data-testid="global-pages-AppSwitcher"]'
  ];
  
  let loginDetected = false;
  const maxWaitTime = 180000; // 3 minutes
  const startTime = Date.now();
  
  while (!loginDetected && (Date.now() - startTime) < maxWaitTime) {
    for (const selector of loginIndicators) {
      try {
        const element = await page.locator(selector).first();
        if (await element.isVisible({ timeout: 1000 })) {
          console.log(`[OK] Login detected: ${selector}`);
          loginDetected = true;
          break;
        }
      } catch (e) {
        // Continue checking other selectors
      }
    }
    
    if (!loginDetected) {
      await page.waitForTimeout(2000);
    }
  }
  
  if (!loginDetected) {
    console.error('[FATAL] Login timeout after 3 minutes');
    console.error('[FATAL] Could not detect successful login');
    await browser.close();
    process.exit(1);
  }
  
  // Wait a bit longer for session to stabilize
  console.log('[INFO] Login successful. Waiting for session to stabilize...');
  await page.waitForTimeout(3000);
  
  // Save storage state
  console.log(`[INFO] Saving session to: ${STORAGE_STATE_PATH}`);
  await context.storageState({ path: STORAGE_STATE_PATH });
  
  // Verify file was created
  if (!fs.existsSync(STORAGE_STATE_PATH)) {
    console.error('[FATAL] Failed to create storageState file');
    await browser.close();
    process.exit(1);
  }
  
  const stats = fs.statSync(STORAGE_STATE_PATH);
  console.log(`[OK] StorageState saved: ${stats.size} bytes`);
  
  // Validate JSON
  try {
    const content = JSON.parse(fs.readFileSync(STORAGE_STATE_PATH, 'utf-8'));
    if (!content.cookies || content.cookies.length === 0) {
      console.error('[FATAL] StorageState has no cookies');
      await browser.close();
      process.exit(1);
    }
    console.log(`[OK] Validated: ${content.cookies.length} cookies saved`);
  } catch (e) {
    console.error('[FATAL] Invalid JSON in storageState:', e.message);
    await browser.close();
    process.exit(1);
  }
  
  await browser.close();
  
  console.log('');
  console.log('============================================================');
  console.log('✓ STORAGE STATE CREATED SUCCESSFULLY');
  console.log('============================================================');
  console.log('');
  console.log('Next steps:');
  console.log('  1. Set JIRA_DASHBOARD_URL (e.g., https://yourcompany.atlassian.net/jira/dashboards/10000)');
  console.log('  2. Run: bash tools/reviewer_e2e/run_reviewer_e2e_strict.sh');
  console.log('');
})();
EOF

chmod +x "$AUTH_SCRIPT"

# ============================================================================
# Run the auth script
# ============================================================================
echo "[INFO] Starting interactive browser..."
echo ""

node "$AUTH_SCRIPT" "$STORAGE_STATE"

# ============================================================================
# Verify result
# ============================================================================
if [ ! -f "$STORAGE_STATE" ]; then
  echo "[FATAL] StorageState was not created" >&2
  exit 1
fi

if [ ! -s "$STORAGE_STATE" ]; then
  echo "[FATAL] StorageState is empty" >&2
  exit 1
fi

echo ""
echo "[OK] StorageState ready at: $STORAGE_STATE"
echo ""
echo "Next: Set JIRA_DASHBOARD_URL and run E2E test"

exit 0
