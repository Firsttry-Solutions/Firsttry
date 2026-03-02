#!/usr/bin/env node
/**
 * Jira Auth Capture Script - Two deterministic modes
 * 
 * MODE A (interactive capture):
 *   - Launches headed Playwright browser
 *   - Requires DISPLAY environment variable set
 *   - User must manually log in
 *   - Saves authenticated storageState
 *   - Then probes /rest/api/3/myself to validate the session
 * 
 * MODE B (verify-only):
 *   - Triggered when VERIFY_ONLY=1
 *   - No browser launched
 *   - Reads existing storageState file
 *   - Validates JSON, cookies, expiry
 *   - Probes /rest/api/3/myself to validate active session
 *   - Must derive base URL from JIRA_DASHBOARD_URL or JIRA_SITE
 * 
 * RULE: NO API token/password used to create UI session cookies.
 *       Only interactive Playwright auth (MODE A) or verification (MODE B).
 *       Session validity proven by successful /rest/api/3/myself probe.
 */

import { chromium, request } from 'playwright';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// Generate default RUN_DIR if not provided
let RUN_DIR = process.env.RUN_DIR;
if (!RUN_DIR || RUN_DIR.trim() === '') {
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, 'Z');
  const pid = process.pid;
  RUN_DIR = `/tmp/ft_jira_auth_capture_${timestamp}_${pid}`;
  console.log(`[INFO] RUN_DIR not set, using default: ${RUN_DIR}`);
}

const VERIFY_ONLY = process.env.VERIFY_ONLY === '1';
const JIRA_DASHBOARD_URL = process.env.JIRA_DASHBOARD_URL;
const JIRA_SITE = process.env.JIRA_SITE;

// Determine STORAGE_STATE path - default to RUN_DIR/storageState.json
const STORAGE_STATE = process.env.STORAGE_STATE || path.join(RUN_DIR, 'storageState.json');

// Helper: derive base URL from JIRA_DASHBOARD_URL or JIRA_SITE
function getBaseUrl() {
  if (JIRA_DASHBOARD_URL) {
    try {
      const url = new URL(JIRA_DASHBOARD_URL);
      return `${url.protocol}//${url.host}`;
    } catch (e) {
      throw new Error(`Invalid JIRA_DASHBOARD_URL format: ${JIRA_DASHBOARD_URL}`);
    }
  }
  if (JIRA_SITE) {
    // JIRA_SITE expected to be like "firsttry.atlassian.net" or "https://firsttry.atlassian.net"
    let site = JIRA_SITE;
    if (!site.startsWith('http')) {
      site = `https://${site}`;
    }
    try {
      const url = new URL(site);
      return `${url.protocol}//${url.host}`;
    } catch (e) {
      throw new Error(`Invalid JIRA_SITE format: ${JIRA_SITE}`);
    }
  }
  throw new Error('Neither JIRA_DASHBOARD_URL nor JIRA_SITE env var set');
}

// Helper: write reason code to files
function writeReason(code) {
  if (!RUN_DIR) return; // Silent if no RUN_DIR
  try {
    fs.mkdirSync(RUN_DIR, { recursive: true });
    fs.writeFileSync(path.join(RUN_DIR, '41_auth_reason.txt'), code, 'utf-8');
  } catch (e) {
    console.error(`[WARN] Could not write reason file: ${e.message}`);
  }
}

function writeStoragePath(p) {
  if (!RUN_DIR) return;
  try {
    fs.mkdirSync(RUN_DIR, { recursive: true });
    fs.writeFileSync(path.join(RUN_DIR, '43_auth_storage_path.txt'), p, 'utf-8');
  } catch (e) {
    console.error(`[WARN] Could not write storage path file: ${e.message}`);
  }
}

// Helper: probe session validity via /rest/api/3/myself
async function probeAuthValid(baseUrl, storageState) {
  try {
    console.log(`[AUTH_PROBE] Testing session with GET ${baseUrl}/rest/api/3/myself`);
    const requestContext = await request.newContext({ storageState });
    const response = await requestContext.get(`${baseUrl}/rest/api/3/myself`);
    const status = response.status();
    
    if (status === 200) {
      console.log(`[AUTH_PROBE] ✅ Session valid (200 OK)`);
      await requestContext.dispose();
      return true;
    } else if (status === 401 || status === 403) {
      console.error(`[AUTH_PROBE] ❌ Session invalid (${status} Unauthorized)`);
      await requestContext.dispose();
      return false;
    } else {
      console.error(`[AUTH_PROBE] ⚠️  Unexpected HTTP status: ${status}`);
      await requestContext.dispose();
      writeReason(`AUTH_FAIL_SESSION_PROBE_HTTP_${status}`);
      process.exit(1);
    }
  } catch (e) {
    console.error(`[AUTH_PROBE] Exception: ${e.message}`);
    writeReason('AUTH_FAIL_SESSION_PROBE_ERROR');
    process.exit(1);
  }
}

// Create RUN_DIR and write ENV.txt
try {
  fs.mkdirSync(RUN_DIR, { recursive: true });
  const envInfo = [
    `timestamp=${new Date().toISOString()}`,
    `cwd=${process.cwd()}`,
    `node_version=${process.version}`,
    `base_url=${JIRA_DASHBOARD_URL || JIRA_SITE || 'not_set'}`,
  ].join('\n');
  fs.writeFileSync(path.join(RUN_DIR, 'ENV.txt'), envInfo, 'utf-8');
} catch (e) {
  console.error(`[FAIL] Could not create RUN_DIR: ${e.message}`);
  process.exit(1);
}

if (!STORAGE_STATE) {
  console.error('[FAIL] STORAGE_STATE path could not be determined');
  writeReason('AUTH_FAIL_NO_STORAGE_STATE_PATH');
  process.exit(1);
}

const resolvedStoragePath = path.resolve(STORAGE_STATE);
writeStoragePath(resolvedStoragePath);

/**
 * MODE B: Verify-only (no browser)
 */
async function verifyOnly() {
  console.log('[INFO] VERIFY_ONLY mode: validating existing storageState...');
  
  if (!fs.existsSync(resolvedStoragePath)) {
    console.error(`[FAIL] storageState file not found: ${resolvedStoragePath}`);
    writeReason('AUTH_FAIL_STORAGESTATE_NOT_FOUND');
    process.exit(1);
  }
  
  let storageState;
  try {
    const content = fs.readFileSync(resolvedStoragePath, 'utf-8');
    storageState = JSON.parse(content);
  } catch (e) {
    console.error(`[FAIL] Invalid JSON in storageState: ${e.message}`);
    writeReason('AUTH_FAIL_STORAGESTATE_INVALID_JSON');
    process.exit(1);
  }
  
  if (!Array.isArray(storageState.cookies) || storageState.cookies.length === 0) {
    console.error('[FAIL] storageState has no cookies');
    writeReason('AUTH_FAIL_STORAGESTATE_EMPTY');
    process.exit(1);
  }
  
  // Check for valid Atlassian cookies
  const now = Math.floor(Date.now() / 1000);
  const atlassianCookies = storageState.cookies.filter(c => 
    c.domain && c.domain.includes('atlassian')
  );
  
  if (atlassianCookies.length === 0) {
    console.error('[FAIL] No Atlassian cookies found in storageState');
    writeReason('AUTH_FAIL_NO_VALID_ATLASSIAN_COOKIE');
    process.exit(1);
  }
  
  // Check if any are expired
  // VALID session cookie if: expires is -1, null, undefined, OR expires > now
  // INVALID only if: expires is positive number AND expires <= now
  const nonExpired = atlassianCookies.filter(c => {
    const expiresVal = c.expires;
    if (expiresVal === -1 || expiresVal === null || expiresVal === undefined) {
      return true; // VALID
    }
    if (typeof expiresVal === 'number' && expiresVal > now) {
      return true; // VALID
    }
    return false; // EXPIRED
  });
  
  if (nonExpired.length === 0) {
    console.error('[FAIL] All Atlassian cookies are expired');
    writeReason('AUTH_FAIL_NO_VALID_ATLASSIAN_COOKIE');
    process.exit(1);
  }
  
  console.log(`[INFO] StorageState has ${nonExpired.length} non-expired Atlassian cookie(s)`);
  
  // Derive base URL for probe
  let baseUrl;
  try {
    baseUrl = getBaseUrl();
  } catch (e) {
    console.error(`[FAIL] Could not determine base URL: ${e.message}`);
    writeReason('AUTH_FAIL_NO_BASE_URL');
    process.exit(1);
  }
  
  // Probe session validity with HTTP request
  const isValid = await probeAuthValid(baseUrl, storageState);
  
  if (!isValid) {
    writeReason('AUTH_FAIL_SESSION_INVALID');
    process.exit(1);
  }
  
  console.log(`[INFO] ✅ Session authenticated and valid`);
  writeReason('AUTH_OK_VERIFY_ONLY');
  process.exit(0);
}

/**
 * MODE A: Interactive capture (with browser)
 */
async function interactiveCapture() {
  const DASHBOARD_URL = process.env.JIRA_DASHBOARD_URL;
  if (!DASHBOARD_URL) {
    console.error('[FAIL] JIRA_DASHBOARD_URL env var not set');
    writeReason('AUTH_FAIL_NO_JIRA_DASHBOARD_URL');
    process.exit(1);
  }
  
  // Check DISPLAY for headed browser
  const hasDisplay = !!process.env.DISPLAY;
  if (!hasDisplay) {
    console.error('[FAIL] DISPLAY not set - cannot run headed browser for interactive login');
    writeReason('AUTH_FAIL_NO_DISPLAY_INTERACTIVE_REQUIRED');
    process.exit(1);
  }
  
  console.log(`[INFO] MODE A: Interactive Playwright capture`);
  console.log(`[INFO] Dashboard URL: ${DASHBOARD_URL}`);
  console.log(`[INFO] Storage path: ${resolvedStoragePath}`);
  
  let browser;
  try {
    // Ensure storage directory exists
    const stateDir = path.dirname(resolvedStoragePath);
    fs.mkdirSync(stateDir, { recursive: true });
    
    console.log('[INFO] Launching Playwright chromium (HEADED mode)...');
    browser = await chromium.launch({ headless: false, timeout: 120000 });
    
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    
    console.log(`[INFO] Navigating to ${DASHBOARD_URL}...`);
    await page.goto(DASHBOARD_URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
    
    // Wait for successful authentication (user will log in manually)
    console.log('[INFO] Waiting for user to authenticate (max 120 seconds)...');
    let isLoggedIn = false;
    let attempts = 0;
    
    while (!isLoggedIn && attempts < 120) {
      await page.waitForTimeout(1000);
      
      const url = page.url();
      const title = await page.title();
      
      // Heuristic: not on login page anymore = logged in
      const onLoginPage = url.includes('id.atlassian.com/login') || 
                         title.toLowerCase().includes('log in');
      
      if (!onLoginPage && url !== DASHBOARD_URL) {
        // Different Atlassian page, likely logged in
        isLoggedIn = true;
      } else if (!onLoginPage && url === DASHBOARD_URL) {
        // On dashboard, probably logged in
        isLoggedIn = true;
      }
      
      attempts++;
      if (attempts % 10 === 0) {
        console.log(`[INFO] Still waiting... (${attempts}s)`);
      }
    }
    
    if (!isLoggedIn) {
      console.error(`[FAIL] Timeout waiting for login (120s)`);
      writeReason('AUTH_FAIL_PLAYWRIGHT_FATAL');
      await context.close();
      await browser.close();
      process.exit(1);
    }
    
    console.log('[INFO] Authentication detected, saving storage state...');
    const state = await context.storageState();
    
    // Validate captured state
    if (!state.cookies || state.cookies.length === 0) {
      console.error('[FAIL] No cookies captured');
      writeReason('AUTH_FAIL_STORAGESTATE_EMPTY');
      await context.close();
      await browser.close();
      process.exit(1);
    }
    
    const atlasCount = state.cookies.filter(c => c.domain && c.domain.includes('atlassian')).length;
    console.log(`[INFO] Captured ${state.cookies.length} cookies (${atlasCount} Atlassian)`);
    
    // Save to file
    fs.writeFileSync(resolvedStoragePath, JSON.stringify(state, null, 2), 'utf-8');
    console.log(`[INFO] Saved storageState to ${resolvedStoragePath}`);
    
    // Validate the written file
    const stats = fs.statSync(resolvedStoragePath);
    if (stats.size < 50) {
      console.error(`[FAIL] storageState file too small: ${stats.size} bytes`);
      writeReason('AUTH_FAIL_STORAGESTATE_INVALID');
      await context.close();
      await browser.close();
      process.exit(1);
    }
    
    // Re-parse to ensure valid JSON
    let savedState;
    try {
      const content = fs.readFileSync(resolvedStoragePath, 'utf-8');
      savedState = JSON.parse(content);
    } catch (e) {
      console.error(`[FAIL] Saved storageState is not valid JSON: ${e.message}`);
      writeReason('AUTH_FAIL_STORAGESTATE_INVALID_JSON');
      await context.close();
      await browser.close();
      process.exit(1);
    }
    
    // Verify has cookies or origins
    const hasCookies = Array.isArray(savedState.cookies) && savedState.cookies.length > 0;
    const hasOrigins = Array.isArray(savedState.origins) && savedState.origins.length > 0;
    if (!hasCookies && !hasOrigins) {
      console.error('[FAIL] storageState has no cookies or origins');
      writeReason('AUTH_FAIL_STORAGESTATE_EMPTY');
      await context.close();
      await browser.close();
      process.exit(1);
    }
    
    // Probe captured session validity
    const isValid = await probeAuthValid(DASHBOARD_URL.split('/jira')[0] || DASHBOARD_URL.split('/rest')[0], state);
    
    if (!isValid) {
      console.error('[FAIL] Captured session is not valid according to /rest/api/3/myself probe');
      writeReason('AUTH_FAIL_SESSION_INVALID');
      await context.close();
      await browser.close();
      process.exit(1);
    }
    
    // Create symlink to latest
    try {
      execSync(`ln -sfn "${RUN_DIR}" /tmp/ft_jira_auth_capture_latest`);
    } catch (e) {
      console.warn(`[WARN] Could not create symlink: ${e.message}`);
    }
    
    writeReason('AUTH_OK');
    await context.close();
    await browser.close();
    
    // Print final success lines
    console.log('[PASS] storageState: ' + resolvedStoragePath);
    console.log('[PASS] run_dir: ' + RUN_DIR);
    console.log('[PASS] latest: /tmp/ft_jira_auth_capture_latest');
    process.exit(0);
    
  } catch (error) {
    console.error(`[FAIL] ${error.message}`);
    writeReason('AUTH_FAIL_PLAYWRIGHT_FATAL');
    if (browser) await browser.close();
    process.exit(1);
  }
}

// Main entrypoint
if (VERIFY_ONLY) {
  verifyOnly().catch(e => {
    console.error(`[ERROR] Verify failed: ${e.message}`);
    writeReason('AUTH_FAIL_PLAYWRIGHT_FATAL');
    process.exit(1);
  });
} else {
  interactiveCapture().catch(e => {
    console.error(`[ERROR] Capture failed: ${e.message}`);
    writeReason('AUTH_FAIL_PLAYWRIGHT_FATAL');
    process.exit(1);
  });
}
