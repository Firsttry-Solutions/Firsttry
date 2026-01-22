#!/usr/bin/env node
/**
 * auth_via_api_token.mjs
 * 
 * Generate storageState.json using FORGE_API_TOKEN for Jira API authentication.
 * 
 * The FORGE_API_TOKEN is a Jira API token that can be used to authenticate
 * directly without browser interaction.
 * 
 * This creates a synthetic storageState that should work for dashboard access.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const AUTH_DIR = path.join(REPO_ROOT, '.auth');
const STORAGE_STATE_PATH = path.join(AUTH_DIR, 'storageState.json');

const FORGE_TOKEN = process.env.FORGE_API_TOKEN;
const JIRA_SITE = process.env.JIRA_SITE || 'firsttry.atlassian.net';

if (!FORGE_TOKEN) {
  console.error('[AUTH_TOKEN] ERROR: FORGE_API_TOKEN env var not set');
  process.exit(1);
}

console.log('[AUTH_TOKEN] Using FORGE_API_TOKEN for Jira authentication');
console.log(`[AUTH_TOKEN] Jira site: ${JIRA_SITE}`);

// Create a synthetic storageState with cookies derived from API token
// For Jira Forge apps, we need to establish a session that the dashboard can use.

// The key insight: Jira Cloud uses cookie-based sessions. Even though we have an API token,
// we need to convert it to a session cookie by making an authenticated request.

// We'll use Playwright to:
// 1. Create a context with the API token in Authorization header
// 2. Make a request to /myself to verify auth
// 3. Extract and save the resulting cookies as storageState

import { chromium } from 'playwright';

async function generateStorageState() {
  // Ensure auth dir exists
  if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
    console.log(`[AUTH_TOKEN] Created: ${AUTH_DIR}`);
  }

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

  try {
    // Create context WITHOUT storageState (fresh start)
    // Try Basic auth: base64(user:token)
    const auth = Buffer.from(`${JIRA_SITE}:${FORGE_TOKEN}`).toString('base64');
    const context = await browser.newContext({
      extraHTTPHeaders: {
        'Authorization': `Basic ${auth}`,
      },
    });

    const page = await context.newPage();

    // Make authenticated request to /myself to establish session
    console.log(`[AUTH_TOKEN] Probing /rest/api/3/myself to establish session...`);
    const url = `https://${JIRA_SITE}/rest/api/3/myself`;
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });

    if (!response || response.status() !== 200) {
      console.error(`[AUTH_TOKEN] ERROR: /myself returned status ${response?.status()}`);
      process.exit(1);
    }

    console.log(`[AUTH_TOKEN] ✅ /myself returned 200 - API token is valid`);

    // Now extract cookies from this context
    const cookies = await context.cookies();
    console.log(`[AUTH_TOKEN] Extracted ${cookies.length} cookies from context`);

    // Create storageState
    const storageState = {
      cookies: cookies,
      origins: [
        {
          origin: `https://${JIRA_SITE}`,
          localStorage: [],
          sessionStorage: [],
        },
      ],
    };

    // Save storageState
    fs.writeFileSync(STORAGE_STATE_PATH, JSON.stringify(storageState, null, 2));
    console.log(`[AUTH_TOKEN] ✅ StorageState saved: ${STORAGE_STATE_PATH}`);
    console.log(`[AUTH_TOKEN] Size: ${fs.statSync(STORAGE_STATE_PATH).size} bytes`);

    await context.close();

    // Verify it can be loaded
    console.log(`[AUTH_TOKEN] Verifying storageState can be loaded...`);
    const context2 = await browser.newContext({ storageState: STORAGE_STATE_PATH });
    const page2 = await context2.newPage();

    console.log(`[AUTH_TOKEN] Navigating to dashboard with new storageState...`);
    const dashResponse = await page2.goto(`https://${JIRA_SITE}/jira/dashboards/10102`, {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    });

    if (!dashResponse) {
      console.error(`[AUTH_TOKEN] ERROR: Dashboard navigation failed`);
      process.exit(1);
    }

    const finalURL = page2.url();
    console.log(`[AUTH_TOKEN] Final URL: ${finalURL.substring(0, 100)}`);

    if (finalURL.includes('id.atlassian.com/login')) {
      console.error(`[AUTH_TOKEN] ERROR: Redirected to login - storageState not valid`);
      process.exit(1);
    }

    console.log(`[AUTH_TOKEN] ✅ StorageState verified - dashboard is reachable`);
    await context2.close();

    process.exit(0);

  } catch (err) {
    console.error(`[AUTH_TOKEN] FATAL: ${err.message}`);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

generateStorageState();
