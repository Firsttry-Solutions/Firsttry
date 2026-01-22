#!/usr/bin/env node
/**
 * auth_smoke_strict.mjs
 * 
 * Test if saved storageState allows authenticated access to dashboard.
 * Uses SAFE, domain-allowlisted Authorization header injection for REST API calls only.
 * 
 * Requirements: 
 * - No redirects to auth domain
 * - /myself returns 200 (via REST-only header injection)
 * - Screenshot captured
 */

import { chromium } from 'playwright';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { createAuthRouteHandler } from './_auth_headers.mjs';

const __dirname = resolve(fileURLToPath(import.meta.url), '..');
const STORAGE_STATE = resolve(__dirname, '../.auth/storageState.json');
const DASHBOARD_URL = 'https://firsttry.atlassian.net/jira/dashboards/10102';
const API_MYSELF = 'https://firsttry.atlassian.net/rest/api/3/myself';

async function main() {
  // Check if storageState exists
  if (!existsSync(STORAGE_STATE)) {
    console.error(`[SMOKE] ✗ StorageState not found: ${STORAGE_STATE}`);
    process.exit(1);
  }

  console.log('[SMOKE] Loading browser with saved storage state...');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    storageState: STORAGE_STATE,
  });

  try {
    const page = await context.newPage();

    // Set up safe, domain-allowlisted Authorization header injection via route interception
    console.log('[SMOKE] Attaching safe Authorization header injection (REST endpoints only)...');
    await page.route('**/*', createAuthRouteHandler);
    
    // IMPORTANT: context.request bypasses page routes, so we attach to context too
    await context.route('**/*', createAuthRouteHandler);

    console.log(`[SMOKE] Navigating to ${DASHBOARD_URL}`);
    const response = await page.goto(DASHBOARD_URL, {
      waitUntil: 'load',
      timeout: 30000,
    });

    const status = response?.status() || 0;
    const url = page.url();

    console.log(`[SMOKE] Response status: ${status}`);
    console.log(`[SMOKE] Final URL: ${url}`);

    // Check for redirect to login
    if (url.includes('id.atlassian.com/login') || url.includes('id.atlassian.com/join')) {
      console.error(`[SMOKE] ✗ Redirected to auth domain: ${url}`);
      process.exit(2);
    }

    // Check if on dashboard
    if (!url.includes('jira/dashboards')) {
      console.error(`[SMOKE] ✗ Not on dashboard URL: ${url}`);
      process.exit(2);
    }

    // Wait for page to settle
    await page.waitForTimeout(2000);

    // Test API
    console.log(`[SMOKE] Probing API ${API_MYSELF}...`);
    
    // For context.request API calls, we need to explicitly set Authorization header
    const { shouldAttachAuth, buildAuthHeaderValue } = await import('./_auth_headers.mjs');
    const apiHeaders = {};
    if (shouldAttachAuth(API_MYSELF)) {
      const authValue = buildAuthHeaderValue();
      if (authValue) {
        apiHeaders['Authorization'] = authValue;
      }
    }
    
    const apiResponse = await context.request.get(API_MYSELF, {
      timeout: 15000,
      headers: apiHeaders,
    });
    const apiStatus = apiResponse.status();

    console.log(`[SMOKE] API /myself status: ${apiStatus}`);

    if (apiStatus !== 200) {
      console.error(`[SMOKE] ✗ API returned ${apiStatus}, expected 200`);
      
      // Try to capture screenshot for debugging
      try {
        await page.screenshot({ path: '/tmp/ft_e2e_auth_real/smoke_fail.png' });
        console.log('[SMOKE] Screenshot saved to /tmp/ft_e2e_auth_real/smoke_fail.png');
      } catch (e) {
        console.log('[SMOKE] Could not save screenshot');
      }
      
      process.exit(2);
    }

    // Save screenshot on success
    try {
      await page.screenshot({ path: '/tmp/ft_e2e_auth_real/smoke_success.png' });
      console.log('[SMOKE] Screenshot saved to /tmp/ft_e2e_auth_real/smoke_success.png');
    } catch (e) {
      console.log('[SMOKE] Could not save screenshot');
    }

    // Output stats
    const storageState = await context.storageState();
    const cookies = storageState.cookies || [];
    const origins = storageState.origins || [];
    const domains = new Set(cookies.map(c => c.domain));

    console.log('[SMOKE] ');
    console.log('[SMOKE] ✓ SUCCESS');
    console.log(`[SMOKE]   Status: ${status}`);
    console.log(`[SMOKE]   URL: ${url}`);
    console.log(`[SMOKE]   /myself: ${apiStatus}`);
    console.log(`[SMOKE]   Cookies: ${cookies.length}`);
    console.log(`[SMOKE]   Domains: ${domains.size}`);
    console.log(`[SMOKE]   Origins: ${origins.length}`);
    console.log('[SMOKE] ');

    process.exit(0);
  } catch (error) {
    console.error(`[SMOKE] ✗ Error: ${error.message}`);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
