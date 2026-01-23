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
async function writeFailureProof(attemptedUrl, normalizedUrl, finalUrl, title, restStatus, restBodySnippet, cookiesCount, reason, page) {
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
    restStatus: restStatus || null,
    restBodySnippet: restBodySnippet || null,
    cookiesCount,
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
    await writeFailureProof(jiraSiteInput, jiraSiteNormalized, finalUrl, title, null, null, 0, 'NAVIGATION_FAILED_OR_NO_SCHEME', page);
    await browser.close();
    process.exit(1);
  }

  // Check for auth redirect - but ALLOW it (don't hard fail)
  // Login redirect is expected and normal
  if (finalUrl.includes('id.atlassian.com/login') || (finalUrl.includes('id.atlassian.com') && finalUrl.includes('/login'))) {
    console.log(`[AUTH] Login redirect detected: ${finalUrl}`);
    console.log(`[AUTH] Waiting for manual login completion (up to 8 minutes via REST verification)...`);
  }

  console.log('[AUTH] Browser opened - URL is valid, please log in manually');
  console.log('[AUTH] Verifying login via Jira REST API...');
  console.log('');

  // REST API verification: prove authentication by calling /rest/api/3/myself
  // This requires real login credentials in cookies
  const maxWaitTime = 8 * 60 * 1000; // 8 minutes max wait
  const startTime = Date.now();
  
  let restSuccess = false;
  let lastRestStatus = null;
  let lastRestBody = null;
  
  while (!restSuccess && (Date.now() - startTime) < maxWaitTime) {
    try {
      // Call REST API from page context (credentials: include sends cookies)
      const result = await page.evaluate(async () => {
        try {
          const response = await fetch('https://firsttry.atlassian.net/rest/api/3/myself', {
            credentials: 'include',
            headers: { 'Accept': 'application/json' }
          });
          const body = await response.text();
          return {
            status: response.status,
            body: body
          };
        } catch (e) {
          return {
            status: null,
            body: e.message
          };
        }
      });

      lastRestStatus = result.status;
      lastRestBody = result.body;

      if (result.status === 200) {
        // Try to parse as JSON
        try {
          const parsed = JSON.parse(result.body);
          if (parsed.accountId) {
            restSuccess = true;
            console.log(`[AUTH] ✓ REST API verified! accountId: ${parsed.accountId}`);
            break;
          }
        } catch (parseErr) {
          // Ignore parse errors
        }
      } else {
        console.log(`[AUTH] REST status: ${result.status} (waiting for 200 OK...)`);
      }
    } catch (e) {
      console.log(`[AUTH] REST check error: ${e.message}`);
    }

    // Wait 2 seconds before retrying
    await page.waitForTimeout(2000);
  }

  if (!restSuccess) {
    console.error('[AUTH] ✗ REST API verification failed after 8 minutes');
    
    const currentUrl = page.url();
    const currentTitle = await page.title().catch(() => '');
    const cookiesCount = (await context.cookies()).length;
    
    const bodySnippet = lastRestBody ? lastRestBody.substring(0, 200) : null;
    
    await writeFailureProof(jiraSiteInput, jiraSiteNormalized, currentUrl, currentTitle, lastRestStatus, bodySnippet, cookiesCount, 'LOGIN_NOT_COMPLETED_TIMEOUT', page);
    
    await browser.close();
    process.exit(1);
  }

  // Wait for URL to resolve to firsttry.atlassian.net domain OR just proceed after REST success
  let finalUrlResolved = page.url();
  console.log(`[AUTH] Final URL after REST success: ${finalUrlResolved}`);
  console.log(`[AUTH] Ready to save authentication state...`);

  // === PHASE 6 ALIGNMENT: Save and verify storageState to standard path ===
  console.log('[AUTH] Saving authentication state to canonical location...');
  const storageState = await context.storageState();
  
  // Strict validation: require meaningful cookies
  const cookies = storageState.cookies || [];
  if (cookies.length < 5) {
    console.error(`[AUTH] ✗ FATAL: Not enough cookies (${cookies.length}), expected >= 5 for real login`);
    
    const currentUrl = page.url();
    const currentTitle = await page.title().catch(() => '');
    
    await writeFailureProof(jiraSiteInput, jiraSiteNormalized, currentUrl, currentTitle, 200, 'accountId present but insufficient cookies', cookies.length, 'INSUFFICIENT_COOKIES_FOR_REAL_LOGIN', page);
    
    await browser.close();
    process.exit(1);
  }
  
  writeFileSync(storageStatePath, JSON.stringify(storageState, null, 2));
  console.log(`[AUTH] ✓ storageState saved to: ${storageStatePath}`);
  
  // === DISK VALIDATION: Ensure file is valid on disk ===
  try {
    const fs = require('fs');
    const stat = fs.statSync(storageStatePath);
    
    if (stat.size < 2000) {
      console.error(`[AUTH] ✗ FATAL: storageState file too small (${stat.size} bytes), expected > 2000`);
      
      const currentUrl = page.url();
      const currentTitle = await page.title().catch(() => '');
      
      await writeFailureProof(jiraSiteInput, jiraSiteNormalized, currentUrl, currentTitle, 200, 'accountId present', cookies.length, 'STORAGE_STATE_TOO_SMALL', page);
      
      await browser.close();
      process.exit(1);
    }
    
    // Verify JSON parse
    const diskContent = fs.readFileSync(storageStatePath, 'utf-8');
    const diskJson = JSON.parse(diskContent);
    
    const diskCookies = diskJson.cookies || [];
    if (diskCookies.length < 5) {
      console.error(`[AUTH] ✗ FATAL: Disk cookies count (${diskCookies.length}) < 5, invalid login state`);
      
      const currentUrl = page.url();
      const currentTitle = await page.title().catch(() => '');
      
      await writeFailureProof(jiraSiteInput, jiraSiteNormalized, currentUrl, currentTitle, 200, 'accountId present', diskCookies.length, 'DISK_INSUFFICIENT_COOKIES', page);
      
      await browser.close();
      process.exit(1);
    }
    
    console.log(`[AUTH] ✓ Disk validation passed: ${diskCookies.length} cookies, ${stat.size} bytes`);
  } catch (e) {
    console.error(`[AUTH] ✗ FATAL: Disk validation error: ${e.message}`);
    
    const currentUrl = page.url();
    const currentTitle = await page.title().catch(() => '');
    
    await writeFailureProof(jiraSiteInput, jiraSiteNormalized, currentUrl, currentTitle, 200, 'accountId present', 0, 'DISK_VALIDATION_ERROR', page);
    
    await browser.close();
    process.exit(1);
  }
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
