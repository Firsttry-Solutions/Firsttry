#!/usr/bin/env node
// Capture Jira authentication state for use in headless browser tests
// Runs in HEADED mode so user can log in interactively

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const runDir = process.env.RUN_DIR || '/tmp/jira_auth_capture';
const dashboardUrl = process.env.JIRA_DASHBOARD_URL;
const storagePath = process.env.STORAGE_STATE || 'e2e/.auth/storageState.persistent.json';

// Validate env vars
if (!dashboardUrl) {
  console.error('[FAIL] JIRA_DASHBOARD_URL env var not set');
  process.exit(2);
}

// Ensure output directory exists
const stateDir = path.dirname(storagePath);
fs.mkdirSync(stateDir, { recursive: true });
fs.mkdirSync(runDir, { recursive: true });

(async () => {
  let browser;
  try {
    console.log(`[INFO] Starting Playwright chromium in HEADED mode`);
    console.log(`[INFO] Target dashboard: ${dashboardUrl}`);
    console.log(`[INFO] Storage state will be saved to: ${storagePath}`);

    browser = await chromium.launch({
      headless: false,  // HEADED MODE - user can log in
      timeout: 120000,
    });

    const context = await browser.createBrowserContext();
    const page = await context.newPage();

    // Set up console handler to log important messages
    page.on('console', (msg) => {
      if (msg.type() === 'error' || msg.type() === 'warning') {
        console.log(`[${msg.type().toUpperCase()}] ${msg.text()}`);
      }
    });

    // Handle authentication redirects
    page.on('response', (response) => {
      if (response.status() === 401 || response.status() === 403) {
        console.log(`[INFO] Got ${response.status()} from ${response.url()}`);
      }
    });

    console.log(`[INFO] Navigating to ${dashboardUrl}...`);
    await page.goto(dashboardUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });

    // Check if on login page
    const url = page.url();
    const title = await page.title();
    console.log(`[INFO] Current URL: ${url}`);
    console.log(`[INFO] Page title: ${title}`);

    // Wait for successful login (URL should not be on id.atlassian.com/login and title should not be "Log in")
    console.log(`[INFO] Waiting for successful authentication...`);
    let isLoggedIn = false;
    let attempts = 0;
    const maxAttempts = 120; // 2 minutes at 1-second intervals

    while (!isLoggedIn && attempts < maxAttempts) {
      await page.waitForTimeout(1000);

      const currentUrl = page.url();
      const currentTitle = await page.title();

      // Check if logged in
      const onLoginPage = currentUrl.includes('id.atlassian.com/login') || currentUrl.includes('id.atlassian.com/logout');
      const isLoginTitle = currentTitle.toLowerCase().includes('log in') || 
                          currentTitle.toLowerCase().includes('sign in') ||
                          currentTitle.toLowerCase().includes('login');

      if (!onLoginPage && !isLoginTitle && currentUrl !== dashboardUrl) {
        // Additional check: if we're on a different Atlassian page (not login), we're likely logged in
        isLoggedIn = true;
        console.log(`[INFO] Authentication detected - no longer on login page`);
        console.log(`[INFO] URL: ${currentUrl}`);
        console.log(`[INFO] Title: ${currentTitle}`);
      } else if (!onLoginPage && !isLoginTitle && currentUrl === dashboardUrl) {
        // On dashboard but still may need time to fully load
        isLoggedIn = true;
        console.log(`[INFO] Dashboard loaded successfully`);
      }

      attempts++;
      if (attempts % 10 === 0) {
        console.log(`[INFO] Still waiting for login... (${attempts}s)`);
      }
    }

    if (!isLoggedIn) {
      console.error(`[FAIL] Did not detect successful login within ${maxAttempts} seconds`);
      console.error(`[FAIL] Final URL: ${page.url()}`);
      console.error(`[FAIL] Final title: ${await page.title()}`);
      process.exit(1);
    }

    // Save storage state
    console.log(`[INFO] Saving storage state...`);
    const state = await context.storageState();

    // Validate we have cookies
    if (!state.cookies || state.cookies.length === 0) {
      console.warn(`[WARN] No cookies captured - auth may not have succeeded`);
    }

    fs.writeFileSync(storagePath, JSON.stringify(state, null, 2));
    console.log(`[INFO] Saved storageState to ${storagePath}`);

    // Also save to evidence directory
    if (runDir && runDir !== '/tmp/jira_auth_capture') {
      fs.writeFileSync(path.join(runDir, 'storageState.json'), JSON.stringify(state, null, 2));
    }

    // Log summary (no secrets printed)
    console.log(`[INFO] Auth capture complete:`);
    console.log(`[INFO]   - Cookies: ${state.cookies.length}`);
    console.log(`[INFO]   - Local storage items: ${state.origins?.reduce((sum, o) => sum + (o.localStorage?.length || 0), 0) || 0}`);
    console.log(`[SUCCESS] Storage state ready for headless smoke proof`);

    await context.close();
    await browser.close();
    process.exit(0);

  } catch (error) {
    console.error(`[ERROR] ${error.message}`);
    if (browser) {
      await browser.close();
    }
    process.exit(1);
  }
})();
