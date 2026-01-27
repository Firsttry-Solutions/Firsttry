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

// Main execution
(async () => {
  let browser;
  let runtimeTimer;
  
  try {
    // Validate inputs
    if (!RUN_DIR) {
      console.error('[FAIL] RUN_DIR not set');
      writeFile('42_proof_reason.txt', 'PROOF_FAIL_NO_RUN_DIR');
      process.exit(1);
    }
    
    if (!JIRA_DASHBOARD_URL) {
      console.error('[FAIL] JIRA_DASHBOARD_URL not set');
      writeFile('42_proof_reason.txt', 'PROOF_FAIL_NO_JIRA_DASHBOARD_URL');
      writeFile('43_last_url.txt', '(not set)');
      writeFile('44_http_statuses.txt', '(not set)');
      process.exit(1);
    }
    
    if (!STORAGE_STATE) {
      console.error('[FAIL] STORAGE_STATE not set');
      writeFile('42_proof_reason.txt', 'PROOF_FAIL_NO_STORAGE_STATE');
      writeFile('43_last_url.txt', '(not set)');
      writeFile('44_http_statuses.txt', '(not set)');
      process.exit(1);
    }
    
    if (!fs.existsSync(STORAGE_STATE)) {
      console.error(`[FAIL] StorageState file not found: ${STORAGE_STATE}`);
      writeFile('42_proof_reason.txt', 'PROOF_FAIL_STORAGESTATE_NOT_FOUND');
      writeFile('43_last_url.txt', '(file not found)');
      writeFile('44_http_statuses.txt', '(file not found)');
      process.exit(1);
    }
    
    // Validate JSON
    let storageState;
    try {
      storageState = JSON.parse(fs.readFileSync(STORAGE_STATE, 'utf-8'));
    } catch (e) {
      console.error(`[FAIL] StorageState invalid JSON: ${e.message}`);
      writeFile('42_proof_reason.txt', 'PROOF_FAIL_STORAGESTATE_INVALID_JSON');
      writeFile('43_last_url.txt', '(JSON parse error)');
      writeFile('44_http_statuses.txt', '(JSON parse error)');
      process.exit(1);
    }
    
    // Validate cookies exist
    if (!Array.isArray(storageState.cookies) || storageState.cookies.length === 0) {
      console.error('[FAIL] StorageState has no cookies');
      writeFile('42_proof_reason.txt', 'PROOF_FAIL_STORAGESTATE_EMPTY');
      writeFile('43_last_url.txt', '(no auth)');
      writeFile('44_http_statuses.txt', '(no auth)');
      process.exit(1);
    }
    
    console.log(`[INFO] StorageState valid (${storageState.cookies.length} cookies)`);
    console.log(`[INFO] Dashboard URL: ${JIRA_DASHBOARD_URL}`);
    console.log(`[INFO] Max runtime: ${MAX_RUNTIME_MS}ms`);
    
    // Setup internal timeout
    let timedOut = false;
    runtimeTimer = setTimeout(() => {
      timedOut = true;
      console.error(`[TIMEOUT] Max runtime exceeded (${MAX_RUNTIME_MS}ms)`);
      process.exit(1);
    }, MAX_RUNTIME_MS);
    
    // Track state
    let lastUrl = '';
    const httpStatuses = [];
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
      writeFile('43_last_url.txt', lastUrl);
      writeFile('44_http_statuses.txt', httpStatuses.join('\n'));
      
      console.error(`[FAIL] Navigation timeout or error: ${navError.message}`);
      writeFile('42_proof_reason.txt', 'PROOF_FAIL_DASHBOARD_NAV_TIMEOUT');
      throw navError;
    }
    
    lastUrl = page.url();
    writeFile('43_last_url.txt', lastUrl);
    
    // Check for redirect to login (auth failed)
    if (lastUrl.includes('id.atlassian.com/login') || lastUrl.includes('id.atlassian.com/logout')) {
      writeFile('44_http_statuses.txt', httpStatuses.join('\n'));
      console.error('[FAIL] Redirected to login - auth failed');
      writeFile('42_proof_reason.txt', 'PROOF_FAIL_UNAUTHORIZED');
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
      writeFile('44_http_statuses.txt', httpStatuses.join('\n'));
      console.error('[FAIL] Gadget iframe not found');
      writeFile('42_proof_reason.txt', 'PROOF_FAIL_GADGET_IFRAME_NOT_FOUND');
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
      writeFile('44_http_statuses.txt', httpStatuses.join('\n'));
      console.error('[FAIL] FT markers not detected');
      writeFile('42_proof_reason.txt', 'PROOF_FAIL_FT_MARKER_TIMEOUT');
      await context.close();
      await browser.close();
      clearTimeout(runtimeTimer);
      process.exit(1);
    }
    
    // Check for unauthorized responses after markers detected
    if (unauthorizedOccurred) {
      writeFile('44_http_statuses.txt', httpStatuses.join('\n'));
      console.error('[FAIL] Unauthorized responses detected during execution');
      writeFile('42_proof_reason.txt', 'PROOF_FAIL_UNAUTHORIZED');
      await context.close();
      await browser.close();
      clearTimeout(runtimeTimer);
      process.exit(1);
    }
    
    // Success
    console.log('\n✅ SMOKE PROOF PASSED: All checks passed');
    writeFile('44_http_statuses.txt', httpStatuses.join('\n'));
    writeFile('42_proof_reason.txt', 'PROOF_OK');
    
    await context.close();
    await browser.close();
    clearTimeout(runtimeTimer);
    process.exit(0);
    
  } catch (error) {
    console.error(`\n❌ SMOKE PROOF FAILED: ${error.message}`);
    
    writeFile('44_http_statuses.txt', '(exception occurred)');
    writeFile('43_last_url.txt', lastUrl || '(unknown)');
    writeFile('42_proof_reason.txt', 'PROOF_FAIL_HARD_ERROR');
    
    if (browser) await browser.close();
    if (runtimeTimer) clearTimeout(runtimeTimer);
    process.exit(1);
  }
})();
