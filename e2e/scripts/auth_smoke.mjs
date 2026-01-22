#!/usr/bin/env node
/**
 * auth_smoke.mjs
 * 
 * Minimal diagnostic to prove whether storageState auth is working.
 * 
 * Usage:
 *   STORAGE_STATE="/path/to/storageState.json" node auth_smoke.mjs
 *   OR
 *   STORAGE_STATE="__NONE__" node auth_smoke.mjs (unauthenticated)
 * 
 * Output:
 *   - final URL (is it login page?)
 *   - cookie count and domains
 *   - /rest/api/3/myself response status
 *   - trace + screenshot
 */

import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const ARTIFACTS_DIR = path.join(REPO_ROOT, '.playwright-smoke-artifacts');

// Ensure artifact dir exists
if (!fs.existsSync(ARTIFACTS_DIR)) {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
}

async function run() {
  const storageStateInput = process.env.STORAGE_STATE || './.auth/storageState.json';
  let storageStatePath = storageStateInput;

  // Resolve relative paths
  if (!storageStatePath.startsWith('/') && storageStatePath !== '__NONE__') {
    storageStatePath = path.resolve(REPO_ROOT, 'e2e', storageStatePath);
  }

  console.log(`[AUTH_SMOKE] Using STORAGE_STATE: ${storageStateInput}`);
  console.log(`[AUTH_SMOKE] Resolved path: ${storageStatePath}`);

  const useAuth = storageStatePath !== '__NONE__';
  
  if (useAuth && !fs.existsSync(storageStatePath)) {
    console.error(`[AUTH_SMOKE] ERROR: storageState file not found: ${storageStatePath}`);
    process.exit(1);
  }

  let storageState = undefined;
  if (useAuth) {
    try {
      storageState = JSON.parse(fs.readFileSync(storageStatePath, 'utf8'));
      console.log(`[AUTH_SMOKE] Loaded storageState (${fs.statSync(storageStatePath).size} bytes)`);
    } catch (e) {
      console.error(`[AUTH_SMOKE] ERROR: Failed to parse storageState: ${e.message}`);
      process.exit(1);
    }
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    storageState: useAuth ? storageState : undefined,
  });

  try {
    // Start tracing
    await context.tracing.start({ screenshots: true, snapshots: true });

    const page = await context.newPage();
    const startURL = 'https://firsttry.atlassian.net/jira/dashboards/10102';

    console.log(`[AUTH_SMOKE] Navigating to: ${startURL}`);
    
    // Go to dashboard
    const response = await page.goto(startURL, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => null);
    const finalURL = page.url();

    console.log(`[AUTH_SMOKE] Final URL: ${finalURL}`);
    if (response) {
      console.log(`[AUTH_SMOKE] Response status: ${response.status()}`);
    }

    // Check if redirected to login
    const isRedirectedToLogin = finalURL.includes('id.atlassian.com/login') || finalURL.includes('id.atlassian.com/join');
    console.log(`[AUTH_SMOKE] Redirected to login: ${isRedirectedToLogin}`);

    // Count cookies
    const allCookies = await context.cookies();
    console.log(`[AUTH_SMOKE] Cookies in context: ${allCookies.length}`);

    // Extract unique domains
    const domains = new Set(allCookies.map(c => c.domain || 'unknown'));
    console.log(`[AUTH_SMOKE] Cookie domains: ${Array.from(domains).sort().join(', ')}`);

    // Check for atlassian domains
    const hasAtlassianNet = allCookies.some(c => c.domain?.includes('atlassian.net'));
    const hasAtlassianCom = allCookies.some(c => c.domain?.includes('atlassian.com'));
    console.log(`[AUTH_SMOKE] Has atlassian.net cookies: ${hasAtlassianNet}`);
    console.log(`[AUTH_SMOKE] Has atlassian.com cookies: ${hasAtlassianCom}`);

    // Try /rest/api/3/myself
    console.log(`[AUTH_SMOKE] Probing /rest/api/3/myself...`);
    const myselfResponse = await page.goto('https://firsttry.atlassian.net/rest/api/3/myself', { 
      waitUntil: 'domcontentloaded',
      timeout: 10000 
    }).catch(() => null);

    if (myselfResponse) {
      console.log(`[AUTH_SMOKE] /rest/api/3/myself status: ${myselfResponse.status()}`);
    } else {
      console.log(`[AUTH_SMOKE] /rest/api/3/myself: TIMEOUT or ERROR`);
    }

    // Take screenshot
    const screenshotPath = path.join(ARTIFACTS_DIR, 'smoke_screenshot.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`[AUTH_SMOKE] Screenshot: ${screenshotPath}`);

    // Save trace
    const tracePath = path.join(ARTIFACTS_DIR, 'smoke_trace.zip');
    await context.tracing.stop({ path: tracePath });
    console.log(`[AUTH_SMOKE] Trace: ${tracePath}`);

    // Final status
    if (isRedirectedToLogin) {
      console.log(`[AUTH_SMOKE] ❌ BLOCKER: Redirected to login page`);
      process.exit(2);
    } else if (finalURL.includes('firsttry.atlassian.net/jira/dashboards/10102')) {
      console.log(`[AUTH_SMOKE] ✅ SUCCESS: Reached dashboard`);
      process.exit(0);
    } else {
      console.log(`[AUTH_SMOKE] ⚠️  UNEXPECTED: Final URL is ${finalURL}`);
      process.exit(3);
    }

  } finally {
    await context.tracing.start({ screenshots: true, snapshots: true });
    await browser.close();
  }
}

run().catch(err => {
  console.error(`[AUTH_SMOKE] FATAL: ${err.message}`);
  process.exit(1);
});
