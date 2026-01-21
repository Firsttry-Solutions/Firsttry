#!/usr/bin/env node
/**
 * auth_preflight_check.mjs
 * 
 * Pre-flight authentication verification before running prod tests.
 * Ensures storageState actually loads a real Jira session (not a redirect).
 * Uses canonical path resolution from storage_state_paths.mjs
 * 
 * Usage:
 *   node e2e/scripts/auth_preflight_check.mjs
 *   STORAGE_STATE=".auth/storageState.json" node e2e/scripts/auth_preflight_check.mjs
 *   STORAGE_STATE="/workspaces/Firsttry/.auth/storageState.json" node e2e/scripts/auth_preflight_check.mjs
 * 
 * Exit codes:
 *   0 - OK: Storage state is valid and Jira shell loaded
 *   10 - REDIRECT: Redirected to auth domain (id.atlassian.com / auth.atlassian.com)
 *   11 - NO_SHELL: Jira shell selectors not found
 *   12 - MISSING: Storage state file missing
 */

import { chromium } from 'playwright';
import * as fs from 'fs';
import { resolveStorageStatePath, describeResolution, CANONICAL_STORAGE_STATE } from './storage_state_paths.mjs';

const PROVE_URL = 'https://firsttry.atlassian.net/jira/dashboards/10102';

async function main() {
  // Resolve STORAGE_STATE path using shared module
  let storageStatePath;
  let resolution;

  try {
    storageStatePath = resolveStorageStatePath(process.env.STORAGE_STATE);
    resolution = describeResolution(process.env.STORAGE_STATE);
  } catch (err) {
    console.error(`[AUTH_PREFLIGHT] ERROR: ${err.message}`);
    process.exit(12);
  }

  console.log(`[AUTH_PREFLIGHT] Storage state: ${storageStatePath}`);

  // Check file exists
  if (!fs.existsSync(storageStatePath)) {
    console.error(`[AUTH_PREFLIGHT] ✗ Storage state file missing: ${storageStatePath}`);
    
    const failedProof = {
      ts: new Date().toISOString(),
      storageStateResolvedPath: storageStatePath,
      ok: false,
      reason: 'file_missing',
      shellCounts: {},
    };

    try {
      fs.writeFileSync('/tmp/auth_preflight_result.json', JSON.stringify(failedProof, null, 2));
    } catch (e) {
      // Ignore
    }

    process.exit(12);
  }

  // Verify file has content
  const stat = fs.statSync(storageStatePath);
  if (stat.size === 0) {
    console.error(`[AUTH_PREFLIGHT] ✗ Storage state file is empty`);
    
    const failedProof = {
      ts: new Date().toISOString(),
      storageStateResolvedPath: storageStatePath,
      ok: false,
      reason: 'file_empty',
      shellCounts: {},
    };

    try {
      fs.writeFileSync('/tmp/auth_preflight_result.json', JSON.stringify(failedProof, null, 2));
    } catch (e) {
      // Ignore
    }

    process.exit(12);
  }

  // Launch browser with storage state
  console.log(`[AUTH_PREFLIGHT] Launching browser with storage state...`);

  let browser;
  try {
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  } catch (e) {
    console.error(`[AUTH_PREFLIGHT] ✗ Browser launch failed: ${e.message}`);
    process.exit(1);
  }

  let context, page;
  try {
    context = await browser.newContext({ storageState: storageStatePath });
    page = await context.newPage();

    console.log(`[AUTH_PREFLIGHT] Navigating to: ${PROVE_URL}`);
    try {
      await page.goto(PROVE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    } catch (e) {
      console.log(`[AUTH_PREFLIGHT] Navigate timeout (may be due to auth redirect): ${e.message}`);
    }

    // Wait up to 20s for shell to appear or redirect to be detected
    const maxWaitTime = 20000;
    const startTime = Date.now();
    let shellFound = false;
    let redirectedToAuth = false;

    while ((Date.now() - startTime) < maxWaitTime && !shellFound && !redirectedToAuth) {
      try {
        const url = page.url();
        console.log(`[AUTH_PREFLIGHT] Current URL: ${url.substring(0, 80)}...`);

        // Check for auth redirect
        if (url.includes('id.atlassian.com') || url.includes('auth.atlassian.com')) {
          redirectedToAuth = true;
          console.error(`[AUTH_PREFLIGHT] ✗ Redirected to auth domain!`);
          break;
        }

        // Check for Jira shell
        const shellCounts = await page.evaluate(() => {
          const selectors = {
            ak_main_content: document.querySelectorAll('#ak-main-content').length,
            ak_main_content_testid: document.querySelectorAll('[data-testid="ak-main-content"]').length,
            dashboard_content: document.querySelectorAll('[data-testid="dashboard-content"]').length,
            role_main: document.querySelectorAll('[role="main"]').length,
            main_tag: document.querySelectorAll('main').length,
          };
          return selectors;
        });

        const anyShell = Object.values(shellCounts).some(count => count > 0);
        if (anyShell) {
          shellFound = true;
          console.log(`[AUTH_PREFLIGHT] ✓ Jira shell found! Selectors: ${JSON.stringify(shellCounts)}`);
        }
      } catch (e) {
        console.log(`[AUTH_PREFLIGHT] Check failed: ${e.message}`);
      }

      if (!shellFound && !redirectedToAuth) {
        await page.waitForTimeout(1000);
      }
    }

    // Get shell counts for proof
    let finalShellCounts = {};
    try {
      finalShellCounts = await page.evaluate(() => {
        const selectors = {
          ak_main_content: document.querySelectorAll('#ak-main-content').length,
          ak_main_content_testid: document.querySelectorAll('[data-testid="ak-main-content"]').length,
          dashboard_content: document.querySelectorAll('[data-testid="dashboard-content"]').length,
          role_main: document.querySelectorAll('[role="main"]').length,
          main_tag: document.querySelectorAll('main').length,
        };
        return selectors;
      });
    } catch (e) {
      // Ignore
    }

    // Determine result
    let exitCode = 0;
    let reason = '';

    if (redirectedToAuth) {
      exitCode = 10;
      reason = 'redirected_to_auth_domain';
    } else if (!shellFound) {
      exitCode = 11;
      reason = 'no_jira_shell';
    } else {
      exitCode = 0;
      reason = 'ok';
      console.log(`[AUTH_PREFLIGHT] ✓ Pre-flight check PASSED! Storage state is valid.`);
    }

    // Write result artifact
    const result = {
      ts: new Date().toISOString(),
      storageStateResolvedPath: storageStatePath,
      resolution,
      canonical: CANONICAL_STORAGE_STATE,
      finalUrl: page.url(),
      ok: exitCode === 0,
      reason,
      shellCounts: finalShellCounts,
      anyRedirectToAuthDomain: redirectedToAuth,
    };

    try {
      fs.writeFileSync('/tmp/auth_preflight_result.json', JSON.stringify(result, null, 2));
      console.log(`[AUTH_PREFLIGHT] Result written to: /tmp/auth_preflight_result.json`);
    } catch (e) {
      // Ignore
    }

    await browser.close();
    process.exit(exitCode);
  } catch (e) {
    console.error(`[AUTH_PREFLIGHT] ✗ Fatal error: ${e.message}`);
    if (browser) {
      await browser.close();
    }
    process.exit(1);
  }
}

main();
