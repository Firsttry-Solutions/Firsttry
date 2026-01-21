#!/usr/bin/env node
/**
 * prove_storage_state.mjs
 * 
 * Validates a Playwright storageState.json file and reports cookie evidence.
 * Uses canonical path resolution from storage_state_paths.mjs
 * 
 * Usage:
 *   node e2e/scripts/prove_storage_state.mjs
 *   STORAGE_STATE=".auth/storageState.json" node e2e/scripts/prove_storage_state.mjs
 *   STORAGE_STATE="/workspaces/Firsttry/.auth/storageState.json" node e2e/scripts/prove_storage_state.mjs
 * 
 * Exit codes:
 *   0 - Success
 *   2 - STORAGE_STATE missing or invalid
 *   3 - Playwright launch failure
 */

import { chromium } from 'playwright';
import * as fs from 'fs';
import { resolveStorageStatePath, describeResolution, CANONICAL_STORAGE_STATE } from './storage_state_paths.mjs';

const STORAGE_STATE = process.env.STORAGE_STATE;
const PROVE_URL = process.env.PROVE_URL || 'https://firsttry.atlassian.net/jira/dashboards/10102';
const OUT = process.env.OUT || '/tmp/storage_state_proof.json';

// Helper: format ISO timestamp
function isoNow() {
  return new Date().toISOString();
}

// Helper: get file stats
function getFileStat(filePath) {
  try {
    const stat = fs.statSync(filePath);
    return {
      sizeBytes: stat.size,
      mtimeIso: new Date(stat.mtimeMs).toISOString(),
    };
  } catch {
    return null;
  }
}

// Helper: process cookies by domain
function processCookies(cookies) {
  const domains = {
    firsttry_atlassian_net: [],
    id_atlassian_com: [],
    auth_atlassian_com: [],
    atlassian_net_root: [],
  };

  cookies.forEach((cookie) => {
    const domain = (cookie.domain || '').toLowerCase();
    if (domain.includes('firsttry.atlassian.net') || domain === 'firsttry.atlassian.net') {
      domains.firsttry_atlassian_net.push(cookie);
    } else if (domain.includes('id.atlassian.com') || domain === 'id.atlassian.com') {
      domains.id_atlassian_com.push(cookie);
    } else if (domain.includes('auth.atlassian.com') || domain === 'auth.atlassian.com') {
      domains.auth_atlassian_com.push(cookie);
    } else if (domain.includes('atlassian.net')) {
      domains.atlassian_net_root.push(cookie);
    }
  });

  return domains;
}

// Helper: summarize cookies (no values)
function summarizeDomainCookies(cookies) {
  const now = Math.floor(Date.now() / 1000);
  const names = [...new Set(cookies.map((c) => c.name))].slice(0, 50);
  const hasExpired = cookies.some((c) => c.expires && c.expires > 0 && c.expires < now);
  const expires = cookies
    .map((c) => c.expires)
    .filter((e) => e && e > 0)
    .sort((a, b) => a - b);

  return {
    count: cookies.length,
    names,
    hasExpired,
    minExpires: expires.length > 0 ? expires[0] : null,
    maxExpires: expires.length > 0 ? expires[expires.length - 1] : null,
  };
}

async function main() {
  // Step 1: Resolve STORAGE_STATE path using shared module
  let resolved;
  let resolution;
  
  try {
    resolved = resolveStorageStatePath(STORAGE_STATE);
    resolution = describeResolution(STORAGE_STATE);
  } catch (err) {
    console.error(`[PROVE_STORAGE] ERROR: ${err.message}`);
    process.exit(2);
  }

  console.log(`[PROVE_STORAGE] STORAGE_STATE resolved: ${resolved}`);

  if (!fs.existsSync(resolved)) {
    console.error(`[PROVE_STORAGE] ERROR: STORAGE_STATE file not found: ${resolved}`);
    process.exit(2);
  }

  // Step 2: Launch Playwright
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (err) {
    console.error(`[PROVE_STORAGE] ERROR: Failed to launch Playwright: ${err.message}`);
    process.exit(3);
  }

  try {
    // Step 3: Create context with storage state
    const context = await browser.newContext({ storageState: resolved });

    // Step 4: Collect cookies from multiple domains
    const allCookies = await context.cookies();
    console.log(`[PROVE_STORAGE] Total cookies from storageState: ${allCookies.length}`);

    // Step 5: Navigate to PROVE_URL to get domain-specific cookies
    const page = await context.newPage();
    try {
      await page.goto(PROVE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
    } catch (e) {
      console.log(`[PROVE_STORAGE] Navigate to ${PROVE_URL} failed (expected if auth required): ${e.message}`);
    }

    // Collect cookies again after navigation
    const cookiesAfterNav = await context.cookies();
    console.log(`[PROVE_STORAGE] Cookies after navigation: ${cookiesAfterNav.length}`);

    // Step 6: Process cookies by domain
    const domainCookies = processCookies(cookiesAfterNav);

    // Step 7: Summarize
    const now = Math.floor(Date.now() / 1000);
    const proof = {
      ts: isoNow(),
      envStorageState: STORAGE_STATE,
      resolvedStorageStatePath: resolved,
      resolution,
      canonical: CANONICAL_STORAGE_STATE,
      fileStat: getFileStat(resolved),
      proveUrl: PROVE_URL,
      cookieSummary: {
        firsttry_atlassian_net: summarizeDomainCookies(domainCookies.firsttry_atlassian_net),
        id_atlassian_com: summarizeDomainCookies(domainCookies.id_atlassian_com),
        auth_atlassian_com: summarizeDomainCookies(domainCookies.auth_atlassian_com),
        atlassian_net_root: summarizeDomainCookies(domainCookies.atlassian_net_root),
      },
      totalCookies: cookiesAfterNav.length,
    };

    // Step 8: Write JSON output
    fs.writeFileSync(OUT, JSON.stringify(proof, null, 2));
    console.log(`[PROVE_STORAGE] Proof written to: ${OUT}`);

    // Step 9: Print human summary
    console.log('\n' + '='.repeat(80));
    console.log('COOKIE SUMMARY (ANONYMIZED)');
    console.log('='.repeat(80));
    console.log(`Timestamp: ${proof.ts}`);
    console.log(`StorageState: ${STORAGE_STATE} (${proof.fileStat?.sizeBytes || 0} bytes)`);
    console.log(`Total cookies: ${proof.totalCookies}`);
    console.log('');
    console.log('Domain Breakdown:');
    Object.entries(proof.cookieSummary).forEach(([domain, summary]) => {
      const expiredStr = summary.hasExpired ? ' [HAS EXPIRED]' : '';
      console.log(`  ${domain}: ${summary.count} cookies${expiredStr}`);
      if (summary.names.length > 0) {
        console.log(`    Names: ${summary.names.join(', ')}`);
      }
    });
    console.log('='.repeat(80));

    await context.close();
    process.exit(0);
  } catch (err) {
    console.error(`[PROVE_STORAGE] ERROR: ${err.message}`);
    process.exit(3);
  } finally {
    await browser.close();
  }
}

main();
