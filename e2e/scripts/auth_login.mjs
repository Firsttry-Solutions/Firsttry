#!/usr/bin/env node
/**
 * PHASE 3: ONE-TIME AUTHENTICATION SCRIPT
 * BACKBONE FIX: URL normalization + Phase 6 storageState path alignment
 * 
 * Purpose: Establish user authentication with Jira and save credentials to storageState.json
 * ONLY saves storage state after verifying Jira shell loads (not a redirect).
 * 
 * Usage:
 *   export JIRA_SITE="firsttry.atlassian.net"  (or "https://firsttry.atlassian.net")
 *   node e2e/scripts/auth_login.mjs
 * 
 * Output:
 *   - /workspaces/Firsttry/e2e/.auth/storageState.json (Phase 6 compatible path)
 * 
 * Mechanism:
 *   1. Launch browser in HEADED mode (not headless)
 *   2. Normalize Jira URL (add https:// if missing)
 *   3. Navigate to Jira site - verify not about:blank
 *   4. Wait for user to authenticate manually
 *   5. Detect successful login (look for Atlassian navigation header)
 *   6. Verify Jira shell is present (not redirected to id.atlassian.com)
 *   7. ONLY then save storageState to canonical location (Phase 6 path)
 *   8. Exit
 * 
 * Hard Rules:
 *   - NEVER print credentials to console
 *   - NEVER save credentials in repo (only to .auth/storageState.json which is gitignored)
 *   - REQUIRE user to manually login (headed browser)
 *   - ONLY save after Jira shell verified to prevent invalid auth states
 *   - Final URL must never be about:blank - validate after goto()
 *   - Path MUST be /workspaces/Firsttry/e2e/.auth/storageState.json (Phase 6 alignment)
 */

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const REPO_ROOT = '/workspaces/Firsttry';
const AUTH_DIR = join(REPO_ROOT, 'e2e', '.auth');
const STORAGE_STATE_PATH = join(AUTH_DIR, 'storageState.json');

/**
 * Normalize Jira base URL: add https:// if missing, remove trailing slash
 * @param {string} input - Input URL or domain (e.g., "firsttry.atlassian.net" or "https://firsttry.atlassian.net")
 * @returns {string} Normalized URL starting with https:// (e.g., "https://firsttry.atlassian.net")
 */
function normalizeJiraBase(input) {
  if (!input) return 'https://firsttry.atlassian.net';
  
  // Trim whitespace
  let normalized = input.trim();
  
  // Add https:// if no scheme
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = 'https://' + normalized;
  }
  
  // Remove trailing slash
  normalized = normalized.replace(/\/$/, '');
  
  return normalized;
}

/**
 * Write proof of authentication failure for diagnostics
 */
async function writeFailureProof(attemptedUrl, normalizedUrl, finalUrl, title, authenticated, jiraShellVerified, reason, page) {
  let htmlLen = 0;
  try {
    if (page) {
      htmlLen = (await page.content()).length;
    }
  } catch (e) {
    // Ignore
  }
  
  const failedProof = {
    ts: new Date().toISOString(),
    attemptedUrl,
    normalizedUrl,
    finalUrl,
    title,
    authenticated,
    jiraShellVerified,
    reason,
    htmlLen,
  };
  
  try {
    writeFileSync('/tmp/auth_login_failed_proof.json', JSON.stringify(failedProof, null, 2));
    console.error('[AUTH] Proof written to: /tmp/auth_login_failed_proof.json');
  } catch (e) {
    console.error('[AUTH] Could not write proof:', e.message);
  }
}

const jiraSiteInput = process.env.JIRA_SITE || 'firsttry.atlassian.net';
const jiraSiteNormalized = normalizeJiraBase(jiraSiteInput);
const storageStateOverride = process.env.STORAGE_STATE;
const storageStatePath = storageStateOverride || STORAGE_STATE_PATH;

console.log('');
console.log('╔═══════════════════════════════════════════════════════════════╗');
console.log('║  PHASE 3: ONE-TIME JIRA AUTHENTICATION (URL NORMALIZED)       ║');
console.log('╚═══════════════════════════════════════════════════════════════╝');
console.log('');
console.log(`Input Site: ${jiraSiteInput}`);
console.log(`Normalized Site: ${jiraSiteNormalized}`);
console.log(`Auth Dir: ${AUTH_DIR}`);
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
mkdirSync(AUTH_DIR, { recursive: true });

async function authenticate() {
  const browser = await chromium.launch({
    headless: false, // HEADED MODE - user sees browser
    args: ['--disable-blink-features=AutomationControlled'],
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  console.log(`[${new Date().toISOString()}] Navigating to: ${jiraSiteNormalized}`);
  
  try {
    await page.goto(jiraSiteNormalized, { waitUntil: 'load', timeout: 30000 });
  } catch (e) {
    console.log(`Navigation load timeout (expected for some Jira instances), continuing...`);
  }

  // === VALIDATION: URL must not be about:blank ===
  const finalUrl = page.url();
  const title = await page.title().catch(() => '');
  
  console.log(`[${new Date().toISOString()}] Final URL: ${finalUrl}`);
  console.log(`[${new Date().toISOString()}] Page Title: ${title}`);
  
  // HARD FAIL: If URL is about:blank or doesn't have proper scheme
  if (!finalUrl || finalUrl === 'about:blank' || (!finalUrl.startsWith('https://') && !finalUrl.startsWith('http://'))) {
    console.error(`[AUTH] ✗ FATAL: Navigation resulted in invalid URL: ${finalUrl}`);
    await writeFailureProof(jiraSiteInput, jiraSiteNormalized, finalUrl, title, false, false, 'NAVIGATION_FAILED_OR_NO_SCHEME', page);
    await browser.close();
    process.exit(1);
  }

  // Check for auth redirect
  if (finalUrl.includes('id.atlassian.com/login') || finalUrl.includes('id.atlassian.com') && finalUrl.includes('/login')) {
    console.error(`[AUTH] ✗ FATAL: Redirected to auth page: ${finalUrl}`);
    await writeFailureProof(jiraSiteInput, jiraSiteNormalized, finalUrl, title, false, false, 'AUTH_REDIRECT', page);
    await browser.close();
    process.exit(1);
  }

  console.log('[AUTH] Browser opened - URL is valid, please log in manually');
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
      const currentUrl = page.url();
      if (currentUrl.includes('id.atlassian.com') || currentUrl.includes('auth.atlassian.com')) {
        console.log(`[AUTH] Still on auth domain: ${currentUrl.substring(0, 80)}...`);
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
    
    const failureReason = !authenticated ? 'header not detected' : 'jira shell selectors not found';
    await writeFailureProof(jiraSiteInput, jiraSiteNormalized, page.url(), await page.title().catch(() => ''), authenticated, jiraShellVerified, failureReason, page);
    
    await browser.close();
    process.exit(6); // Auth failed exit code
  }

  // === PHASE 6 ALIGNMENT: Save storageState to standard path ===
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
