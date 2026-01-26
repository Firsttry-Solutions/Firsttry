#!/usr/bin/env node
/**
 * ft_dashboard_smoke_proof.mjs
 * Deterministic Playwright script to prove UI status is NOT undefined.
 * Fail-closed: hard gates block success.
 * No secrets printed.
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const TIMEOUT_MS = 240000; // 4 minutes for page load
const MARKER_TIMEOUT_MS = 120000; // 2 minutes for marker appearance
const RUN_DIR = process.env.RUN_DIR;
const JIRA_DASHBOARD_URL = process.env.JIRA_DASHBOARD_URL;
const STORAGE_STATE = process.env.STORAGE_STATE;

// Validate env vars
if (!RUN_DIR) {
  console.error('ERROR: RUN_DIR env var not set');
  process.exit(2);
}
if (!JIRA_DASHBOARD_URL) {
  console.error('ERROR: JIRA_DASHBOARD_URL env var not set');
  process.exit(2);
}
if (!STORAGE_STATE) {
  console.error('ERROR: STORAGE_STATE env var not set');
  process.exit(2);
}
if (!fs.existsSync(STORAGE_STATE)) {
  console.error('[FAIL] No authenticated storageState. Run: npm run jira:auth:capture');
  process.exit(2);
}

const storageState = JSON.parse(fs.readFileSync(STORAGE_STATE, 'utf-8'));

// Validate that storageState has cookies (proof of authentication)
if (!storageState.cookies || storageState.cookies.length === 0) {
  console.error('[FAIL] StorageState is empty - not authenticated. Run: npm run jira:auth:capture');
  process.exit(2);
}
const consoleLogs = [];
let browserContext;
let browser;

/**
 * Main execution
 */
(async () => {
  try {
    // Launch chromium
    browser = await chromium.launch({ headless: true });
    
    // Create context with storage state (auth)
    browserContext = await browser.newContext({ storageState });
    const page = await browserContext.newPage();
    
    // Detect auth failures
    page.on('response', response => {
      if (response.status() === 401 || response.status() === 403) {
        console.log(`[ERROR] Auth failed: ${response.status()} from ${response.url()}`);
      }
    });
    
    // Capture ALL console output
    page.on('console', msg => {
      const logEntry = `[${msg.type()}] ${msg.text()}`;
      consoleLogs.push(logEntry);
      // Also print to stdout for debugging
      console.log(logEntry);
    });
    
    // Navigate to dashboard
    console.log(`[INFO] Navigating to ${JIRA_DASHBOARD_URL}`);
    await page.goto(JIRA_DASHBOARD_URL, {
      timeout: TIMEOUT_MS,
      waitUntil: 'domcontentloaded'
    });
    
    // Check if redirected to login (auth failure)
    const finalUrl = page.url();
    if (finalUrl.includes('id.atlassian.com/login') || finalUrl.includes('id.atlassian.com/logout')) {
      throw new Error(
        'HARD GATE FAILED: Redirected to login. StorageState auth is invalid or expired. ' +
        'Run: npm run jira:auth:capture'
      );
    }
    
    // Wait for our entry marker
    console.log('[INFO] Waiting for UI entry proof marker...');
    const entryMarkerRegex = /\[UI_ENTRY_RUNTIME_PROOF\]|\[UI_SERVE_OK\]|\[UI_BOOT_PROOF\]/;
    let entryMarkerFound = false;
    const entryMarkerStartTime = Date.now();
    while (!entryMarkerFound && (Date.now() - entryMarkerStartTime) < MARKER_TIMEOUT_MS) {
      const match = consoleLogs.some(log => entryMarkerRegex.test(log));
      if (match) {
        entryMarkerFound = true;
        console.log('[INFO] Entry marker detected');
      } else {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    if (!entryMarkerFound) {
      throw new Error(
        'HARD GATE FAILED: Entry marker not found within timeout. ' +
        'Expected one of: [UI_ENTRY_RUNTIME_PROOF], [UI_SERVE_OK], [UI_BOOT_PROOF]'
      );
    }
    
    // Wait for our success marker (the one with status)
    console.log('[INFO] Waiting for UI_FT_GETDASHBOARDSTATE_SUCCESS marker...');
    let successMarkerFound = false;
    const successMarkerStartTime = Date.now();
    while (!successMarkerFound && (Date.now() - successMarkerStartTime) < MARKER_TIMEOUT_MS) {
      const match = consoleLogs.some(log => /\[UI_FT_GETDASHBOARDSTATE_SUCCESS\]/.test(log));
      if (match) {
        successMarkerFound = true;
        console.log('[INFO] Success marker detected');
      } else {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    if (!successMarkerFound) {
      throw new Error(
        'HARD GATE FAILED: [UI_FT_GETDASHBOARDSTATE_SUCCESS] marker not found within timeout'
      );
    }
    
    // Extract proof lines for summary
    const respKeysLine = consoleLogs.find(log => /\[UI_RESP_KEYS\]/.test(log)) || '(not found)';
    const gitShaLine = consoleLogs.find(log => /UI_GIT_SHA=|UI_IDENTITY_RESOLVED/.test(log)) || '(not found)';
    const successLine = consoleLogs.find(log => /\[UI_FT_GETDASHBOARDSTATE_SUCCESS\]/.test(log)) || '(not found)';
    
    // Hard gate: status must not be undefined
    if (/status=undefined/.test(successLine)) {
      throw new Error(
        'HARD GATE FAILED: status=undefined detected in [UI_FT_GETDASHBOARDSTATE_SUCCESS]'
      );
    }
    
    // Hard gate: status field must be present
    if (!/status=/.test(successLine)) {
      throw new Error(
        'HARD GATE FAILED: status= field missing from [UI_FT_GETDASHBOARDSTATE_SUCCESS]'
      );
    }
    
    // Print proof summary to stdout
    console.log('\n============================================================================');
    console.log('PROOF SUMMARY');
    console.log('============================================================================');
    console.log(`[UI_RESP_KEYS]: ${respKeysLine}`);
    console.log(`[UI_GIT_SHA]:   ${gitShaLine}`);
    console.log(`[SUCCESS]:      ${successLine}`);
    console.log('============================================================================');
    console.log('✅ ALL HARD GATES PASSED: Status is NOT undefined\n');
    
    // Write full console log to file
    const consoleLogFile = path.join(RUN_DIR, '41_browser_console_full.txt');
    fs.writeFileSync(consoleLogFile, consoleLogs.join('\n'), 'utf-8');
    console.log(`[INFO] Full console log written to: ${consoleLogFile}`);
    
    // Clean exit
    await browserContext.close();
    await browser.close();
    process.exit(0);
  } catch (error) {
    console.error(`\n❌ SMOKE PROOF FAILED: ${error.message}\n`);
    
    // Write partial console log before exit
    try {
      const consoleLogFile = path.join(RUN_DIR, '41_browser_console_full.txt');
      fs.writeFileSync(consoleLogFile, consoleLogs.join('\n'), 'utf-8');
    } catch (writeError) {
      console.error(`Could not write console log: ${writeError.message}`);
    }
    
    if (browserContext) await browserContext.close();
    if (browser) await browser.close();
    process.exit(1);
  }
})();
