#!/usr/bin/env node
/**
 * validate_storage_state_ui.mjs
 * 
 * PROOF THAT STORAGE STATE IS USABLE IN PLAYWRIGHT
 * 
 * This script validates that the persistent storageState actually works
 * for UI navigation (not just REST API calls).
 * 
 * It:
 * 1. Loads storageState from file
 * 2. Creates a NEW (non-persistent) browser context with that storageState
 * 3. Navigates to the dashboard URL
 * 4. HARD FAILS if redirected to id.atlassian.com (auth domain)
 * 5. Saves screenshot (success or failure)
 * 6. Prints [STORAGESTATE_UI_OK] finalUrl=<...> or [STORAGESTATE_UI_FAIL]
 */

import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const DASHBOARD_URL = 'https://firsttry.atlassian.net/jira/dashboards/10102';
const STORAGE_STATE_FILE = '/workspaces/Firsttry/e2e/.auth/storageState.persistent.json';
const VALIDATE_OK_PNG = '/workspaces/Firsttry/e2e/.auth/validate_ok.png';
const VALIDATE_FAIL_PNG = '/workspaces/Firsttry/e2e/.auth/validate_fail.png';

const TIMEOUT_MS = 120_000; // 120 seconds
const URL_CHECK_INTERVAL_MS = 2_000;

async function main() {
  try {
    // Load storageState
    if (!fs.existsSync(STORAGE_STATE_FILE)) {
      console.error(`[VALIDATE] StorageState file not found: ${STORAGE_STATE_FILE}`);
      console.log('[STORAGESTATE_UI_FAIL]');
      process.exit(1);
    }

    const storageStateJson = fs.readFileSync(STORAGE_STATE_FILE, 'utf-8');
    const storageState = JSON.parse(storageStateJson);
    console.log(`[VALIDATE] Loaded storageState: ${STORAGE_STATE_FILE}`);

    // Launch browser (not persistent, just for validation)
    const browser = await chromium.launch({ headless: true });
    
    // Create context WITH the storageState
    const context = await browser.newContext({
      storageState,
      ignoreHTTPSErrors: true,
    });

    const page = await context.newPage();
    page.setDefaultNavigationTimeout(TIMEOUT_MS);

    try {
      await page.goto(DASHBOARD_URL, { waitUntil: 'domcontentloaded', timeout: TIMEOUT_MS });
    } catch (e) {
      console.log(`[VALIDATE] Initial page.goto() threw: ${e.message}`);
    }

    // Poll URL for up to 120 seconds to detect auth redirects
    const pollDeadline = Date.now() + TIMEOUT_MS;
    let lastUrl = page.url();
    let hasRedirected = false;

    console.log(`[VALIDATE] Checking URL stabilization (max 120s)...`);

    while (Date.now() < pollDeadline) {
      const currentUrl = page.url();

      // HARD FAIL on auth domain
      if (currentUrl.includes('id.atlassian.com') || currentUrl.includes('auth.atlassian.com')) {
        console.error(`[VALIDATE] FAILURE: Redirected to auth domain: ${currentUrl}`);
        console.log('[STORAGESTATE_UI_FAIL]');
        await page.screenshot({ path: VALIDATE_FAIL_PNG });
        console.log(`[VALIDATE] Screenshot saved to ${VALIDATE_FAIL_PNG}`);
        await browser.close();
        process.exit(1);
      }

      // Check for success
      const urlObj = new URL(currentUrl);
      const isAtlassianNet = urlObj.hostname.endsWith('atlassian.net');
      const isJiraPath = urlObj.pathname.includes('/jira/');

      if (isAtlassianNet && isJiraPath && !hasRedirected) {
        console.log(`[VALIDATE] ✓ SUCCESS: Loaded on ${currentUrl}`);
        hasRedirected = true;
        // Wait a bit more to be sure it's stable
        await new Promise(r => setTimeout(r, 3000));
        const finalUrl = page.url();
        if (finalUrl.includes('id.atlassian.com') || finalUrl.includes('auth.atlassian.com')) {
          console.error(`[VALIDATE] FAILURE: Redirected after brief success: ${finalUrl}`);
          console.log('[STORAGESTATE_UI_FAIL]');
          await page.screenshot({ path: VALIDATE_FAIL_PNG });
          console.log(`[VALIDATE] Screenshot saved to ${VALIDATE_FAIL_PNG}`);
          await browser.close();
          process.exit(1);
        }
        break;
      }

      if (currentUrl !== lastUrl) {
        console.log(`[VALIDATE] URL: ${currentUrl}`);
        lastUrl = currentUrl;
      }

      await new Promise(r => setTimeout(r, URL_CHECK_INTERVAL_MS));
    }

    // Final check
    const finalUrl = page.url();
    const finalUrlObj = new URL(finalUrl);
    const isFinalAtlassianNet = finalUrlObj.hostname.endsWith('atlassian.net');
    const isFinalJiraPath = finalUrlObj.pathname.includes('/jira/');

    if (!isFinalAtlassianNet || !isFinalJiraPath) {
      console.error(`[VALIDATE] FAILURE: Final URL is not Jira dashboard: ${finalUrl}`);
      console.log('[STORAGESTATE_UI_FAIL]');
      await page.screenshot({ path: VALIDATE_FAIL_PNG });
      console.log(`[VALIDATE] Screenshot saved to ${VALIDATE_FAIL_PNG}`);
      await browser.close();
      process.exit(1);
    }

    // SUCCESS
    console.log(`[VALIDATE] ✓ StorageState is valid for UI navigation`);
    console.log(`[STORAGESTATE_UI_OK] finalUrl=${finalUrl}`);
    await page.screenshot({ path: VALIDATE_OK_PNG });
    console.log(`[VALIDATE] Screenshot saved to ${VALIDATE_OK_PNG}`);

    await browser.close();
    process.exit(0);

  } catch (err) {
    console.error(`[VALIDATE] ERROR: ${err.message}`);
    console.log('[STORAGESTATE_UI_FAIL]');
    process.exit(1);
  }
}

main();
