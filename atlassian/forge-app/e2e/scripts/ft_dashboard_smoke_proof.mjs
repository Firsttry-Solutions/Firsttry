#!/usr/bin/env node
/**
 * Dashboard Smoke Proof - Deterministic, non-ambiguous
 * 
 * REQUIREMENTS:
 * - Internal MAX_RUNTIME_MS (no external timeout command needed)
 * - ALWAYS write 42_proof_reason.txt, 43_last_url.txt, 44_http_statuses.txt
 * - Deterministic reason codes for every failure path
 * - Listen to 401/403 responses and set unauthorized flag
 * - Detect gadget iframe existence (forge/govGadget)
 * - Detect FT markers with timeout distinct from auth/iframe issues
 * 
 * Reason codes:
 *   Success: PROOF_OK, PROOF_OK_NO_SNAPSHOT, PROOF_OK_INVALID_SNAPSHOT
 *   Failure: PROOF_FAIL_STORAGESTATE_EMPTY, INVALID_JSON, UNAUTHORIZED,
 *            DASHBOARD_NAV_TIMEOUT, GADGET_IFRAME_NOT_FOUND, FT_MARKER_TIMEOUT, HARD_ERROR
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const RUN_DIR = process.env.RUN_DIR;
const JIRA_DASHBOARD_URL = process.env.JIRA_DASHBOARD_URL;
const STORAGE_STATE = process.env.STORAGE_STATE;
const MAX_RUNTIME_MS = parseInt(process.env.MAX_RUNTIME_MS || '120000', 10);

// Helpers
function writeFile(name, content) {
  if (!RUN_DIR) return;
  try {
    fs.mkdirSync(RUN_DIR, { recursive: true });
    fs.writeFileSync(path.join(RUN_DIR, name), content, 'utf-8');
  } catch (e) {
    console.error(`[WARN] Could not write ${name}: ${e.message}`);
  }
}

// Finalization - synchronous signal-safe write of all three files
function finalizeEvidence(reasonCode, lastUrl = '', httpStatusesStr = '') {
  // Must be synchronous and idempotent
  writeFile('42_proof_reason.txt', reasonCode + '\n');
  writeFile('43_last_url.txt', lastUrl + '\n');
  writeFile('44_http_statuses.txt', httpStatusesStr);
}

// Main execution
(async () => {
  let browser;
  let runtimeTimer;
  let lastUrl = '';
  let httpStatuses = [];
  
  // Install signal handlers BEFORE any async work
  process.on('SIGTERM', () => {
    console.error('[SIGNAL] Received SIGTERM');
    finalizeEvidence('PROOF_FAIL_SIGTERM', lastUrl, httpStatuses.join('\n'));
    if (runtimeTimer) clearTimeout(runtimeTimer);
    if (browser) browser.close().catch(() => {});
    process.exit(1);
  });
  
  process.on('SIGINT', () => {
    console.error('[SIGNAL] Received SIGINT');
    finalizeEvidence('PROOF_FAIL_SIGINT', lastUrl, httpStatuses.join('\n'));
    if (runtimeTimer) clearTimeout(runtimeTimer);
    if (browser) browser.close().catch(() => {});
    process.exit(1);
  });
  
  process.on('uncaughtException', (err) => {
    console.error('[EXCEPTION] Uncaught: ' + err.message);
    finalizeEvidence('PROOF_FAIL_HARD_ERROR', lastUrl, httpStatuses.join('\n'));
    if (runtimeTimer) clearTimeout(runtimeTimer);
    if (browser) browser.close().catch(() => {});
    process.exit(1);
  });
  
  process.on('unhandledRejection', (reason) => {
    console.error('[REJECTION] Unhandled: ' + reason);
    finalizeEvidence('PROOF_FAIL_HARD_ERROR', lastUrl, httpStatuses.join('\n'));
    if (runtimeTimer) clearTimeout(runtimeTimer);
    if (browser) browser.close().catch(() => {});
    process.exit(1);
  });
  
  try {
    // Validate inputs
    if (!RUN_DIR) {
      console.error('[FAIL] RUN_DIR not set');
      finalizeEvidence('PROOF_FAIL_NO_RUN_DIR', '', '');
      process.exit(1);
    }
    
    // Create evidence files IMMEDIATELY at startup
    finalizeEvidence('PROOF_RUNNING', '', '');
    
    if (!JIRA_DASHBOARD_URL) {
      console.error('[FAIL] JIRA_DASHBOARD_URL not set');
      finalizeEvidence('PROOF_FAIL_NO_JIRA_DASHBOARD_URL', '(not set)', '');
      process.exit(1);
    }
    
    if (!STORAGE_STATE) {
      console.error('[FAIL] STORAGE_STATE not set');
      finalizeEvidence('PROOF_FAIL_NO_STORAGE_STATE', '(not set)', '');
      process.exit(1);
    }
    
    if (!fs.existsSync(STORAGE_STATE)) {
      console.error(`[FAIL] StorageState file not found: ${STORAGE_STATE}`);
      finalizeEvidence('PROOF_FAIL_STORAGESTATE_NOT_FOUND', '(file not found)', '');
      process.exit(1);
    }
    
    // Validate JSON
    let storageState;
    try {
      storageState = JSON.parse(fs.readFileSync(STORAGE_STATE, 'utf-8'));
    } catch (e) {
      console.error(`[FAIL] StorageState invalid JSON: ${e.message}`);
      finalizeEvidence('PROOF_FAIL_STORAGESTATE_INVALID_JSON', '(JSON parse error)', '');
      process.exit(1);
    }
    
    // Validate cookies exist
    if (!Array.isArray(storageState.cookies) || storageState.cookies.length === 0) {
      console.error('[FAIL] StorageState has no cookies');
      finalizeEvidence('PROOF_FAIL_STORAGESTATE_EMPTY', '(no auth)', '');
      process.exit(1);
    }
    
    console.log(`[INFO] StorageState valid (${storageState.cookies.length} cookies)`);
    console.log(`[INFO] Dashboard URL: ${JIRA_DASHBOARD_URL}`);
    console.log(`[INFO] Max runtime: ${MAX_RUNTIME_MS}ms`);
    
    // Setup internal timeout with precedence logic
    let timedOut = false;
    runtimeTimer = setTimeout(() => {
      timedOut = true;
      console.error(`[TIMEOUT] Max runtime exceeded (${MAX_RUNTIME_MS}ms)`);
      
      // Reason precedence (UNAUTHORIZED > GADGET > MARKER > TIMEOUT):
      let timeoutReason = 'PROOF_FAIL_TIMEOUT_INTERNAL';
      if (unauthorizedOccurred) {
        timeoutReason = 'PROOF_FAIL_UNAUTHORIZED';
      } else if (!gadgetIframeFound) {
        timeoutReason = 'PROOF_FAIL_GADGET_IFRAME_NOT_FOUND';
      } else if (!ftMarkerDetected) {
        timeoutReason = 'PROOF_FAIL_FT_MARKER_TIMEOUT';
      }
      
      finalizeEvidence(timeoutReason, lastUrl, httpStatuses.join('\n'));
      process.exit(1);
    }, MAX_RUNTIME_MS);
    
    // Track state (already declared above for signal handlers)
    let unauthorizedOccurred = false;
    let gadgetIframeFound = false;
    let ftMarkerDetected = false;
    
    // Launch browser
    console.log('[INFO] Launching Playwright chromium...');
    browser = await chromium.launch({ headless: true });
    
    const context = await browser.newContext({ storageState });
    const page = await context.newPage();
    
    // Monitor responses for auth errors
    page.on('response', response => {
      const url = response.url();
      const status = response.status();
      
      if (url.includes('atlassian.net') || url.includes('id.atlassian.com')) {
        httpStatuses.push(`${status} ${url.split('?')[0]}`);
        
        if (status === 401 || status === 403) {
          unauthorizedOccurred = true;
          console.log(`[ERROR] Auth failed: ${status} from ${url}`);
        }
      }
    });
    
    // Monitor console for markers
    page.on('console', msg => {
      const text = msg.text();
      console.log(`[console] ${text}`);
      
      // Check for FT markers
      if (text.includes('[L0_DASHBOARD_RENDERED]') ||
          text.includes('[UI_ENTRY_RUNTIME_PROOF]') ||
          text.includes('[UI_SERVE_OK]') ||
          text.includes('[UI_BRIDGE_RUNTIME_PROOF]')) {
        ftMarkerDetected = true;
      }
    });
    
    // Check frames for gadget iframe
    page.on('frameattached', frame => {
      const frameUrl = frame.url();
      if (frameUrl.includes('govGadget') || frameUrl.includes('forge')) {
        gadgetIframeFound = true;
        console.log(`[INFO] Gadget iframe detected: ${frameUrl}`);
      }
    });
    
    // Navigate
    console.log(`[INFO] Navigating to ${JIRA_DASHBOARD_URL}...`);
    try {
      await page.goto(JIRA_DASHBOARD_URL, {
        timeout: 60000,
        waitUntil: 'domcontentloaded'
      });
    } catch (navError) {
      lastUrl = page.url();
      console.error(`[FAIL] Navigation timeout or error: ${navError.message}`);
      finalizeEvidence('PROOF_FAIL_DASHBOARD_NAV_TIMEOUT', lastUrl, httpStatuses.join('\n'));
      throw navError;
    }
    
    lastUrl = page.url();
    
    // Check for redirect to login (auth failed)
    if (lastUrl.includes('id.atlassian.com/login') || lastUrl.includes('id.atlassian.com/logout')) {
      console.error('[FAIL] Redirected to login - auth failed');
      finalizeEvidence('PROOF_FAIL_UNAUTHORIZED', lastUrl, httpStatuses.join('\n'));
      await context.close();
      await browser.close();
      clearTimeout(runtimeTimer);
      process.exit(1);
    }
    
    // Wait for gadget iframe
    console.log('[INFO] Waiting for gadget iframe...');
    const gadgetTimeout = 30000;
    const gadgetStart = Date.now();
    while (!gadgetIframeFound && (Date.now() - gadgetStart) < gadgetTimeout) {
      const frames = page.frames();
      const hasGadgetFrame = frames.some(f => {
        const url = f.url();
        return url.includes('govGadget') || url.includes('forge');
      });
      
      if (hasGadgetFrame) {
        gadgetIframeFound = true;
        console.log('[INFO] Gadget iframe found');
      } else {
        await page.waitForTimeout(500);
      }
    }
    
    if (!gadgetIframeFound) {
      console.error('[FAIL] Gadget iframe not found');
      finalizeEvidence('PROOF_FAIL_GADGET_IFRAME_NOT_FOUND', lastUrl, httpStatuses.join('\n'));
      await context.close();
      await browser.close();
      clearTimeout(runtimeTimer);
      process.exit(1);
    }
    
    // Wait for FT markers
    console.log('[INFO] Waiting for FT markers...');
    const markerTimeout = 30000;
    const markerStart = Date.now();
    while (!ftMarkerDetected && (Date.now() - markerStart) < markerTimeout) {
      await page.waitForTimeout(500);
    }
    
    if (!ftMarkerDetected) {
      console.error('[FAIL] FT markers not detected');
      finalizeEvidence('PROOF_FAIL_FT_MARKER_TIMEOUT', lastUrl, httpStatuses.join('\n'));
      await context.close();
      await browser.close();
      clearTimeout(runtimeTimer);
      process.exit(1);
    }
    
    // Check for unauthorized responses after markers detected
    if (unauthorizedOccurred) {
      console.error('[FAIL] Unauthorized responses detected during execution');
      finalizeEvidence('PROOF_FAIL_UNAUTHORIZED', lastUrl, httpStatuses.join('\n'));
      await context.close();
      await browser.close();
      clearTimeout(runtimeTimer);
      process.exit(1);
    }
    
    // Success
    console.log('\n✅ SMOKE PROOF PASSED: All checks passed');
    finalizeEvidence('PROOF_OK', lastUrl, httpStatuses.join('\n'));
    
    await context.close();
    await browser.close();
    clearTimeout(runtimeTimer);
    process.exit(0);
    
  } catch (error) {
    console.error(`\n❌ SMOKE PROOF FAILED: ${error.message}`);
    
    finalizeEvidence('PROOF_FAIL_HARD_ERROR', lastUrl || '(unknown)', '(exception occurred)');
    
    if (browser) await browser.close();
    if (runtimeTimer) clearTimeout(runtimeTimer);
    process.exit(1);
  }
})();
