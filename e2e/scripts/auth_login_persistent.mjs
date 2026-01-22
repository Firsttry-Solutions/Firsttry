#!/usr/bin/env node
/**
 * auth_login_persistent.mjs
 * 
 * Creates a REAL Jira UI session using chromium.launchPersistentContext().
 * 
 * CRITICAL: This is NOT REST token "auth". It's a full browser-based login.
 * 
 * Flow:
 * 1. launchPersistentContext() with headless=false (visible window)
 * 2. Navigate to Jira dashboard URL
 * 3. Wait up to 240 seconds for user to complete login (SSO/MFA/consent)
 * 4. Detect success: final URL on atlassian.net, path contains /jira/
 * 5. Detect failure: any URL containing id.atlassian.com or auth.atlassian.com
 * 6. Save storageState and screenshot on success
 * 7. Print [PERSISTENT_AUTH_OK] or [PERSISTENT_AUTH_FAIL]
 */

import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const DASHBOARD_URL = 'https://firsttry.atlassian.net/jira/dashboards/10102';
const PROFILE_DIR = '/workspaces/Firsttry/e2e/.auth/pw_profile';
const AUTH_DIR = '/workspaces/Firsttry/e2e/.auth';
const STORAGE_STATE_FILE = path.join(AUTH_DIR, 'storageState.persistent.json');
const AUTH_SUCCESS_PNG = path.join(AUTH_DIR, 'auth_success.png');
const AUTH_FAIL_PNG = path.join(AUTH_DIR, 'auth_fail.png');

const TIMEOUT_MS = 240_000; // 240 seconds
const URL_CHECK_INTERVAL_MS = 2_000; // Check every 2 seconds

async function main() {
  try {
    // Ensure directories exist
    if (!fs.existsSync(AUTH_DIR)) {
      fs.mkdirSync(AUTH_DIR, { recursive: true });
    }
    if (!fs.existsSync(PROFILE_DIR)) {
      fs.mkdirSync(PROFILE_DIR, { recursive: true });
    }

    console.log(`[AUTH] Starting persistent context at ${PROFILE_DIR}`);
    console.log(`[AUTH] Navigating to: ${DASHBOARD_URL}`);

    // Launch persistent context (visible, not headless)
    const context = await chromium.launchPersistentContext(PROFILE_DIR, {
      headless: false,
      args: [
        '--disable-blink-features=AutomationControlled',
      ],
    });

    const page = await context.newPage();
    page.setDefaultNavigationTimeout(TIMEOUT_MS);

    try {
      // Navigate to dashboard
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle', timeout: TIMEOUT_MS });
    } catch (e) {
      console.log(`[AUTH] Initial navigation threw: ${e.message}`);
      // Navigation may timeout if Jira redirects to auth domain; we'll catch it below
    }

    // Poll URL every 2 seconds for up to 240 seconds
    let finalUrl = page.url();
    const pollDeadline = Date.now() + TIMEOUT_MS;
    let lastUrl = finalUrl;

    console.log(`[AUTH] Waiting for user to complete login (max 240s)...`);

    while (Date.now() < pollDeadline) {
      const currentUrl = page.url();

      // Check for auth redirects (FAILURE)
      if (currentUrl.includes('id.atlassian.com') || currentUrl.includes('auth.atlassian.com')) {
        console.log(`[AUTH] DETECTED AUTH DOMAIN REDIRECT: ${currentUrl}`);
        console.log(`[PERSISTENT_AUTH_FAIL]`);
        await page.screenshot({ path: AUTH_FAIL_PNG });
        console.log(`[AUTH] Screenshot saved to ${AUTH_FAIL_PNG}`);
        await context.close();
        process.exit(1);
      }

      // Check for success: atlassian.net + /jira/ in path
      const urlObj = new URL(currentUrl);
      const isAtlassianNet = urlObj.hostname.endsWith('atlassian.net');
      const isJiraPath = urlObj.pathname.includes('/jira/');

      if (isAtlassianNet && isJiraPath) {
        console.log(`[AUTH] ✓ SUCCESS: Loaded on ${currentUrl}`);
        finalUrl = currentUrl;
        break;
      }

      if (currentUrl !== lastUrl) {
        console.log(`[AUTH] URL changed: ${currentUrl}`);
        lastUrl = currentUrl;
      }

      await new Promise(r => setTimeout(r, URL_CHECK_INTERVAL_MS));
    }

    // Final validation
    const finalUrlObj = new URL(page.url());
    const isFinalAtlassianNet = finalUrlObj.hostname.endsWith('atlassian.net');
    const isFinalJiraPath = finalUrlObj.pathname.includes('/jira/');

    if (!isFinalAtlassianNet || !isFinalJiraPath) {
      console.log(`[AUTH] TIMEOUT or WRONG URL: ${page.url()}`);
      console.log(`[PERSISTENT_AUTH_FAIL]`);
      await page.screenshot({ path: AUTH_FAIL_PNG });
      console.log(`[AUTH] Screenshot saved to ${AUTH_FAIL_PNG}`);
      await context.close();
      process.exit(1);
    }

    // SUCCESS: Save storageState and screenshot
    console.log(`[AUTH] Saving storageState to ${STORAGE_STATE_FILE}`);
    const storageState = await context.storageState();
    fs.writeFileSync(STORAGE_STATE_FILE, JSON.stringify(storageState, null, 2));

    await page.screenshot({ path: AUTH_SUCCESS_PNG });
    console.log(`[AUTH] Screenshot saved to ${AUTH_SUCCESS_PNG}`);

    console.log(`[PERSISTENT_AUTH_OK]`);
    await context.close();
    process.exit(0);

  } catch (err) {
    console.error(`[AUTH] ERROR: ${err.message}`);
    console.log(`[PERSISTENT_AUTH_FAIL]`);
    process.exit(1);
  }
}

main();
