#!/usr/bin/env node
/**
 * PHASE 3: ONE-TIME AUTHENTICATION SCRIPT
 * 
 * Purpose: Establish user authentication with Jira and save credentials to storageState.json
 * ONLY saves storage state after verifying Jira shell loads (not a redirect).
 * 
 * Usage:
 *   export JIRA_SITE="https://firsttry.atlassian.net"
 *   node e2e/scripts/auth_login.mjs
 * 
 * Output:
 *   - /workspaces/Firsttry/.auth/storageState.json (gitignored - contains cookies + tokens)
 * 
 * Mechanism:
 *   1. Launch browser in HEADED mode (not headless)
 *   2. Navigate to Jira site
 *   3. Wait for user to authenticate manually
 *   4. Detect successful login (look for Atlassian navigation header)
 *   5. Verify Jira shell is present (not redirected to id.atlassian.com)
 *   6. ONLY then save storageState to canonical location
 *   7. Exit
 * 
 * Hard Rules:
 *   - NEVER print credentials to console
 *   - NEVER save credentials in repo (only to .auth/storageState.json which is gitignored)
 *   - REQUIRE user to manually login (headed browser)
 *   - ONLY save after Jira shell verified to prevent invalid auth states
 */

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync, writeFile } from 'fs';
import { join } from 'path';

const jiravSite = process.env.JIRA_SITE || 'https://firsttry.atlassian.net';
const REPO_ROOT = '/workspaces/Firsttry';
const authDir = join(REPO_ROOT, '.auth');
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
console.log('  3. Wait for the script to detect successful login AND Jira shell');
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

  const context = await browser.newContext();
  const page = await context.newPage();

  console.log(`[${new Date().toISOString()}] Navigating to: ${jiravSite}`);
  
  try {
    await page.goto(jiravSite, { waitUntil: 'load' });
  } catch (e) {
    console.log(`Navigation load timeout (expected for some Jira instances), continuing...`);
  }

  console.log('[AUTH] Browser opened - please log in manually');
  console.log('[AUTH] Waiting for Jira shell + verified authentication...');
  console.log('');

  // Wait for successful authentication by looking for Atlassian nav header
  // AND verify Jira shell selectors exist
  // This ensures we're not just at a redirect page
  const maxWaitTime = 5 * 60 * 1000; // 5 minutes max wait
  const startTime = Date.now();
  
  let authenticated = false;
  let jiraShellVerified = false;
  
  while ((!authenticated || !jiraShellVerified) && (Date.now() - startTime) < maxWaitTime) {
    try {
      // Check current URL for auth redirects
      const url = page.url();
      if (url.includes('id.atlassian.com') || url.includes('auth.atlassian.com')) {
        console.log(`[AUTH] Still on auth domain: ${url.substring(0, 80)}...`);
      } else {
        // Look for Atlassian header (appears when user logs in)
        const headerVisible = await page.evaluate(() => {
          const header = document.querySelector('[data-testid="atlassian-navigation--header"]');
          return header && header.offsetHeight > 0;
        });

        if (headerVisible && !authenticated) {
          authenticated = true;
          console.log('[AUTH] ✓ Authenticated successfully!');
        }

        // Verify Jira shell (ensures we're in a real Jira page, not a redirect)
        if (authenticated && !jiraShellVerified) {
          const shellFound = await page.evaluate(() => {
            // Multiple selector checks for different Jira versions
            const selectors = [
              '#ak-main-content',
              '[data-testid="ak-main-content"]',
              '[data-testid="dashboard-content"]',
              '[role="main"]',
              'main',
            ];
            return selectors.some(sel => {
              const elem = document.querySelector(sel);
              return elem && elem.offsetHeight > 0;
            });
          });

          if (shellFound) {
            jiraShellVerified = true;
            console.log('[AUTH] ✓ Jira shell verified!');
            console.log('[AUTH] Ready to save authentication state...');
            break;
          }
        }
      }
    } catch (e) {
      // Page not ready yet
    }

    // Wait 1 second before retrying
    await page.waitForTimeout(1000);
  }

  if (!authenticated || !jiraShellVerified) {
    console.error('[AUTH] ✗ Authentication or Jira shell verification failed after 5 minutes');
    
    // Write failed proof artifact
    const failedProof = {
      ts: new Date().toISOString(),
      finalUrl: page.url(),
      title: await page.title().catch(() => ''),
      authenticated,
      jiraShellVerified,
      reason: !authenticated ? 'header not detected' : 'jira shell selectors not found',
    };
    
    try {
      writeFileSync('/tmp/auth_login_failed_proof.json', JSON.stringify(failedProof, null, 2));
      console.error('[AUTH] Proof written to: /tmp/auth_login_failed_proof.json');
    } catch (e) {
      // Ignore
    }
    
    await browser.close();
    process.exit(6); // Auth failed exit code
  }

  // ONLY save storageState after BOTH authenticated AND jira shell verified
  console.log('[AUTH] Saving authentication state to canonical location...');
  const storageState = await context.storageState();
  writeFileSync(storageStatePath, JSON.stringify(storageState, null, 2));
  
  console.log(`[AUTH] ✓ storageState saved to: ${storageStatePath}`);
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  AUTHENTICATION COMPLETE & VERIFIED                           ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('Next steps:');
  console.log('  1. Run the E2E test:');
  console.log(`       STORAGE_STATE="${storageStatePath}" npx playwright test`);
  console.log('');
  console.log('  2. View results:');
  console.log('       npx playwright show-report');
  console.log('');

  await browser.close();
}

authenticate().catch(error => {
  console.error('[AUTH] Fatal error:', error);
  process.exit(1);
});
