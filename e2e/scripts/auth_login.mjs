#!/usr/bin/env node
/**
 * PHASE 3: ONE-TIME AUTHENTICATION SCRIPT
 * 
 * Purpose: Establish user authentication with Jira and save credentials to storageState.json
 * 
 * Usage:
 *   export JIRA_SITE="https://firsttry.atlassian.net"
 *   node e2e/scripts/auth_login.mjs
 * 
 * Output:
 *   - e2e/.auth/storageState.json (gitignored - contains cookies + tokens)
 * 
 * Mechanism:
 *   1. Launch browser in HEADED mode (not headless)
 *   2. Navigate to Jira site
 *   3. Wait for user to authenticate manually
 *   4. Detect successful login (look for Atlassian navigation header)
 *   5. Save storageState to file
 *   6. Exit
 * 
 * Hard Rules:
 *   - NEVER print credentials to console
 *   - NEVER save credentials in repo (only to .auth/storageState.json which is gitignored)
 *   - REQUIRE user to manually login (headed browser)
 */

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const jiravSite = process.env.JIRA_SITE || 'https://firsttry.atlassian.net';
const authDir = join(process.cwd(), 'e2e', '.auth');
const storageStatePath = join(authDir, 'storageState.json');

console.log('');
console.log('╔═══════════════════════════════════════════════════════════════╗');
console.log('║  PHASE 3: ONE-TIME JIRA AUTHENTICATION                        ║');
console.log('╚═══════════════════════════════════════════════════════════════╝');
console.log('');
console.log(`Jira Site: ${jiravSite}`);
console.log(`Auth Dir: ${authDir}`);
console.log(`Storage State: ${storageStatePath}`);
console.log('');
console.log('Instructions:');
console.log('  1. A browser window will open (HEADED MODE)');
console.log('  2. Log in to Jira manually');
console.log('  3. Wait for the script to detect successful login');
console.log('  4. Browser will close automatically');
console.log('  5. storageState.json will be saved (GITIGNORED)');
console.log('');
console.log('Waiting 3 seconds before launching browser...');
console.log('');

// Create auth directory if needed
mkdirSync(authDir, { recursive: true });

async function authenticate() {
  const browser = await chromium.launch({
    headless: false, // HEADED MODE - user sees browser
    args: ['--disable-blink-features=AutomationControlled'],
  });

  const context = await browser.createBrowserContext();
  const page = await context.newPage();

  console.log(`[${new Date().toISOString()}] Navigating to: ${jiravSite}`);
  
  try {
    await page.goto(jiravSite, { waitUntil: 'load' });
  } catch (e) {
    console.log(`Navigation load timeout (expected for some Jira instances), continuing...`);
  }

  console.log('[AUTH] Browser opened - please log in manually');
  console.log('[AUTH] Waiting for Atlassian navigation header to appear...');
  console.log('');

  // Wait for successful authentication by looking for Atlassian nav header
  // This selector appears after user logs in successfully
  const maxWaitTime = 5 * 60 * 1000; // 5 minutes max wait
  const startTime = Date.now();
  
  let authenticated = false;
  while (!authenticated && (Date.now() - startTime) < maxWaitTime) {
    try {
      // Look for Atlassian header (appears when user logs in)
      const headerVisible = await page.evaluate(() => {
        const header = document.querySelector('[data-testid="atlassian-navigation--header"]');
        return header && header.offsetHeight > 0;
      });

      if (headerVisible) {
        authenticated = true;
        console.log('[AUTH] ✓ Authenticated successfully!');
        console.log('[AUTH] Saving authentication state...');
        break;
      }
    } catch (e) {
      // Page not ready yet
    }

    // Also try alternative detection
    try {
      const url = page.url();
      if (url.includes('/jira/') && !url.includes('login') && !url.includes('auth')) {
        authenticated = true;
        console.log('[AUTH] ✓ Authenticated (URL-based detection)!');
        console.log('[AUTH] Saving authentication state...');
        break;
      }
    } catch (e) {
      // Ignore
    }

    // Wait 1 second before retrying
    await page.waitForTimeout(1000);
  }

  if (!authenticated) {
    console.error('[AUTH] ✗ Authentication failed or timed out after 5 minutes');
    await browser.close();
    process.exit(1);
  }

  // Save storageState (cookies + tokens)
  const storageState = await context.storageState();
  writeFileSync(storageStatePath, JSON.stringify(storageState, null, 2));
  
  console.log(`[AUTH] ✓ storageState saved to: ${storageStatePath}`);
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  AUTHENTICATION COMPLETE                                      ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('Next steps:');
  console.log('  1. Set required environment variables:');
  console.log(`       export JIRA_SITE="${jiravSite}"`);
  console.log(`       export DASHBOARD_URL="${jiravSite}/jira/dashboards/10102"`);
  console.log(`       export GADGET_TITLE_CONTAINS="Firsttry: Audit Evidence for Jira"`);
  console.log('');
  console.log('  2. Run the E2E test:');
  console.log('       npx playwright test');
  console.log('');
  console.log('  3. View results:');
  console.log('       npx playwright show-report');
  console.log('');

  await browser.close();
}

authenticate().catch(error => {
  console.error('[AUTH] Fatal error:', error);
  process.exit(1);
});
