#!/usr/bin/env node
/**
 * force_valid_session.mjs
 * 
 * Attempt to force a valid session by:
 * 1. Loading dashboard homepage without gadget (just public view)
 * 2. Checking if /rest/api/3/myself works
 * 3. If both work, extract cookies and save as fresh storageState
 */

import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const AUTH_DIR = path.join(REPO_ROOT, '.auth');
const STORAGE_STATE_PATH = path.join(AUTH_DIR, 'storageState.json');
const JIRA_SITE = 'firsttry.atlassian.net';

async function run() {
  console.log('[FORCE_SESSION] Attempting to extract valid session cookies...');

  // Ensure auth dir exists
  if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

  try {
    // Start with fresh context (no old storageState)
    console.log('[FORCE_SESSION] Creating fresh browser context...');
    const context = await browser.newContext();
    const page = await context.newPage();

    // Step 1: Try to reach Jira homepage
    console.log('[FORCE_SESSION] Step 1: Loading homepage...');
    let response = await page.goto(`https://${JIRA_SITE}/`, {
      waitUntil: 'domcontentloaded',
      timeout: 20000,
    }).catch(err => {
      console.log(`[FORCE_SESSION] Homepage load error: ${err.message}`);
      return null;
    });

    const homeURL = page.url();
    console.log(`[FORCE_SESSION] Homepage URL: ${homeURL.substring(0, 100)}`);

    // Step 2: Check if we're redirected to login
    if (homeURL.includes('id.atlassian.com') || homeURL.includes('auth.atlassian.com')) {
      console.log('[FORCE_SESSION] ❌ Redirected to login on homepage - no valid session available');
      process.exit(1);
    }

    // Step 3: Try /rest/api/3/myself without auth header
    console.log('[FORCE_SESSION] Step 2: Testing /rest/api/3/myself...');
    response = await page.goto(`https://${JIRA_SITE}/rest/api/3/myself`, {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    }).catch(err => {
      console.log(`[FORCE_SESSION] /myself load error: ${err.message}`);
      return null;
    });

    if (response) {
      console.log(`[FORCE_SESSION] /myself status: ${response.status()}`);
      if (response.status() === 401 || response.status() === 403) {
        console.log('[FORCE_SESSION] ❌ /myself returned auth error - session invalid');
        process.exit(1);
      }
    }

    // Step 4: Extract ALL cookies
    const allCookies = await context.cookies();
    console.log(`[FORCE_SESSION] Extracted ${allCookies.length} cookies`);

    // Step 5: Try to use these cookies on the dashboard
    console.log('[FORCE_SESSION] Step 3: Creating new context with extracted cookies...');
    const storageState = {
      cookies: allCookies,
      origins: [
        {
          origin: `https://${JIRA_SITE}`,
          localStorage: [],
          sessionStorage: [],
        },
      ],
    };

    // Save to temp file first to test
    const tempPath = path.join(AUTH_DIR, 'storageState_test.json');
    fs.writeFileSync(tempPath, JSON.stringify(storageState, null, 2));

    const context2 = await browser.newContext({ storageState });
    const page2 = await context2.newPage();

    console.log('[FORCE_SESSION] Testing extracted cookies on dashboard...');
    const dashResponse = await page2.goto(`https://${JIRA_SITE}/jira/dashboards/10102`, {
      waitUntil: 'domcontentloaded',
      timeout: 20000,
    }).catch(err => {
      console.log(`[FORCE_SESSION] Dashboard load error: ${err.message}`);
      return null;
    });

    const finalURL = page2.url();
    console.log(`[FORCE_SESSION] Final dashboard URL: ${finalURL.substring(0, 100)}`);

    if (finalURL.includes('id.atlassian.com') || finalURL.includes('auth.atlassian.com')) {
      console.log('[FORCE_SESSION] ❌ Cookies do not work - still redirects to login');
      fs.unlinkSync(tempPath);
      process.exit(1);
    }

    // SUCCESS: Move temp file to real location
    fs.renameSync(tempPath, STORAGE_STATE_PATH);
    console.log(`[FORCE_SESSION] ✅ SUCCESS: Valid session extracted and saved`);
    console.log(`[FORCE_SESSION] StorageState: ${STORAGE_STATE_PATH} (${fs.statSync(STORAGE_STATE_PATH).size} bytes)`);

    await context.close();
    await context2.close();
    process.exit(0);

  } catch (err) {
    console.error(`[FORCE_SESSION] FATAL: ${err.message}`);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

run();
