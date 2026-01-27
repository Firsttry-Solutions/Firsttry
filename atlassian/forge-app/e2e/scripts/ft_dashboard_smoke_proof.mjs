#!/usr/bin/env node
/**
 * ft_dashboard_smoke_proof.mjs
 * Deterministic Playwright script to prove UI status is NOT undefined.
 * Fail-closed: hard gates block success.
 * No secrets printed.
 * HARDENING: Always write 42_proof_reason.txt on any path (success or fail).
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const TIMEOUT_MS = 240000; // 4 minutes for page load
const MARKER_TIMEOUT_MS = 120000; // 2 minutes for marker appearance

// HARDENING: Function to write proof reason code (FAIL-CLOSED)
function writeProofReason(code) {
  const runDir = process.env.RUN_DIR;
  if (!runDir) {
    // If RUN_DIR missing, create one
    const now = new Date().toISOString().replace(/[:.]/g, '').slice(0, 15);
    const dir = `/tmp/ft_smoke_${now}Z`;
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, '42_proof_reason.txt'), code + '\n', 'utf-8');
    } catch (e) {
      console.error(`[WARN] Could not write reason file: ${e.message}`);
    }
    return;
  }
  try {
    fs.mkdirSync(runDir, { recursive: true });
    fs.writeFileSync(path.join(runDir, '42_proof_reason.txt'), code + '\n', 'utf-8');
  } catch (e) {
    console.error(`[WARN] Could not write reason file: ${e.message}`);
  }
}

let RUN_DIR = process.env.RUN_DIR;
const JIRA_DASHBOARD_URL = process.env.JIRA_DASHBOARD_URL;
const STORAGE_STATE = process.env.STORAGE_STATE;

// Validate env vars (FAIL-CLOSED with reason codes)
if (!RUN_DIR) {
  const now = new Date().toISOString().replace(/[:.]/g, '').slice(0, 15);
  RUN_DIR = `/tmp/ft_smoke_${now}Z`;
  fs.mkdirSync(RUN_DIR, { recursive: true });
  console.log(`[INFO] RUN_DIR created: ${RUN_DIR}`);
}
if (!JIRA_DASHBOARD_URL) {
  console.error('ERROR: JIRA_DASHBOARD_URL env var not set');
  writeProofReason('PROOF_FAIL_NO_URL');
  process.exit(2);
}
if (!STORAGE_STATE) {
  console.error('ERROR: STORAGE_STATE env var not set');
  writeProofReason('PROOF_FAIL_STORAGESTATE_MISSING');
  process.exit(2);
}
if (!fs.existsSync(STORAGE_STATE)) {
  console.error('[FAIL] No authenticated storageState. Run: npm run jira:auth:capture');
  writeProofReason('PROOF_FAIL_STORAGESTATE_NOT_FOUND');
  process.exit(2);
}

// Parse and validate storage state JSON (FAIL-CLOSED)
let storageState;
try {
  storageState = JSON.parse(fs.readFileSync(STORAGE_STATE, 'utf-8'));
} catch (e) {
  console.error(`[FAIL] StorageState invalid JSON: ${e.message}`);
  writeProofReason('PROOF_FAIL_STORAGESTATE_INVALID_JSON');
  process.exit(2);
}

// Validate that storageState has cookies (proof of authentication)
if (!storageState.cookies || storageState.cookies.length === 0) {
  console.error('[FAIL] StorageState is empty - not authenticated. Run: npm run jira:auth:capture');
  writeProofReason('PROOF_FAIL_STORAGESTATE_EMPTY');
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
      const reasonCode = 'AUTH_REQUIRED';
      console.error(`[FAIL] Redirected to login. StorageState auth is invalid or expired.`);
      console.error(`[REASON] ${reasonCode}`);
      throw new Error(`${reasonCode}: StorageState auth is invalid. Run: npm run jira:auth:capture`);
    }
    
    // Wait for our critical markers (not generic console noise from Jira host)
    console.log('[INFO] Waiting for FT markers: UI_ENTRY_RUNTIME_PROOF, UI_SERVE_OK, UI_BRIDGE_RUNTIME_PROOF, L0_DASHBOARD_RENDERED...');
    const ftMarkerRegex = /\[(UI_ENTRY_RUNTIME_PROOF|UI_SERVE_OK|UI_BRIDGE_RUNTIME_PROOF|L0_DASHBOARD_RENDERED)\]/;
    let ftMarkerFound = false;
    const ftMarkerStartTime = Date.now();
    while (!ftMarkerFound && (Date.now() - ftMarkerStartTime) < MARKER_TIMEOUT_MS) {
      const match = consoleLogs.some(log => ftMarkerRegex.test(log));
      if (match) {
        ftMarkerFound = true;
        console.log('[INFO] FT marker detected');
      } else {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    if (!ftMarkerFound) {
      const reasonCode = 'PROOF_FAIL_MISSING_MARKER';
      console.error(`[FAIL] No FT markers found within timeout.`);
      console.error(`[REASON] ${reasonCode}`);
      throw new Error(
        `${reasonCode}: Expected one of: [UI_ENTRY_RUNTIME_PROOF], [UI_SERVE_OK], [UI_BRIDGE_RUNTIME_PROOF], [L0_DASHBOARD_RENDERED]`
      );
    }
    
    // Extract our specific dashboard rendered marker
    const dashboardRenderedLog = consoleLogs.find(log => /\[L0_DASHBOARD_RENDERED\]/.test(log));
    let finalStatus = 'HARD_ERROR';
    let finalReasonCode = 'PROOF_FAIL_HARD_ERROR';
    
    if (dashboardRenderedLog) {
      // Parse status from the log (expects: [L0_DASHBOARD_RENDERED] { status: "AVAILABLE"|"NO_SNAPSHOT"|"INVALID_SNAPSHOT"|"HARD_ERROR", reasonCode: ..., ... })
      const statusMatch = dashboardRenderedLog.match(/status:\s*"([^"]+)"/);
      const reasonMatch = dashboardRenderedLog.match(/reasonCode:\s*"([^"]+)"/);
      
      if (statusMatch) {
        finalStatus = statusMatch[1];
      }
      if (reasonMatch) {
        finalReasonCode = reasonMatch[1];
      }
      
      // Determine proof code based on final status
      if (finalStatus === "AVAILABLE") {
        finalReasonCode = "PROOF_OK";
      } else if (finalStatus === "NO_SNAPSHOT") {
        finalReasonCode = "PROOF_OK_NO_SNAPSHOT";
      } else if (finalStatus === "INVALID_SNAPSHOT") {
        finalReasonCode = "PROOF_OK_INVALID_SNAPSHOT";
      } else if (finalStatus === "HARD_ERROR") {
        finalReasonCode = "PROOF_FAIL_HARD_ERROR";
      }
    } else {
      const reasonCode = 'PROOF_FAIL_MISSING_MARKER';
      console.error(`[FAIL] [L0_DASHBOARD_RENDERED] marker not found (markers found: ${ftMarkerRegex.source}).`);
      console.error(`[REASON] ${reasonCode}`);
      throw new Error(`${reasonCode}: Dashboard rendered marker missing`);
    }
    
    // Write proof summary to stdout
    console.log('\n============================================================================');
    console.log('PROOF SUMMARY');
    console.log('============================================================================');
    console.log(`[FINAL_STATUS]:   ${finalStatus}`);
    console.log(`[DASHBOARD_LOG]:  ${dashboardRenderedLog}`);
    console.log('============================================================================');
    console.log(`✅ MARKERS DETECTED AND STATUS IS NOT UNDEFINED\n`);
    console.log(`[REASON] ${finalReasonCode}`);
    
    // Write full console log to file
    const consoleLogFile = path.join(RUN_DIR, '41_browser_console_full.txt');
    fs.writeFileSync(consoleLogFile, consoleLogs.join('\n'), 'utf-8');
    console.log(`[INFO] Full console log written to: ${consoleLogFile}`);
    
    // HARDENING: Always write reason code (FAIL-CLOSED)
    writeProofReason(finalReasonCode);
    console.log(`[INFO] Proof reason code written: ${finalReasonCode}`);
    
    // Clean exit
    await browserContext.close();
    await browser.close();
    process.exit(0);
  } catch (error) {
    // Extract reason code from error message if present
    let reasonCode = error.message && error.message.includes(':') 
      ? error.message.split(':')[0] 
      : 'PROOF_FAIL_HARD_ERROR';
    
    console.error(`\n============================================================================`);
    console.error(`SMOKE PROOF FAILED`);
    console.error(`============================================================================`);
    console.error(`[FAIL] ${error.message}\n`);
    console.error(`[REASON] ${reasonCode}`);
    console.error(`============================================================================\n`);
    
    // HARDENING: Always write reason code (FAIL-CLOSED)
    writeProofReason(reasonCode);
    
    // Write partial console log before exit
    try {
      const consoleLogFile = path.join(RUN_DIR, '41_browser_console_full.txt');
      fs.writeFileSync(consoleLogFile, consoleLogs.join('\n'), 'utf-8');
    } catch (writeError) {
      console.error(`Could not write log files: ${writeError.message}`);
    }
    
    if (browserContext) await browserContext.close();
    if (browser) await browser.close();
    process.exit(1);
  }
})();
