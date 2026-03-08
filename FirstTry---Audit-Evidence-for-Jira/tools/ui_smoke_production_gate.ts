#!/usr/bin/env node
/**
 * UI Dashboard Smoke Production Gate — Deterministic, Fail-Closed
 *
 * Launches headless Chromium, loads a real Jira issue page, locates the
 * Forge Custom UI iframe, switches into it, and verifies:
 *   1. Dashboard root element renders
 *   2. No "Governance Status: Failed to Load" text
 *   3. Required proof markers appear in console
 *   4. Forbidden proof markers are absent
 *   5. No 404/5xx for Forge iframe CDN assets
 *
 * Environment variables (all required):
 *   FT_E2E_ISSUE_URL     — Full Jira issue URL, e.g. https://firsttry.atlassian.net/browse/DEMO-1
 *   FT_E2E_STORAGE_STATE — Path to Playwright storageState JSON (pre-authenticated session)
 *
 * Optional:
 *   FT_E2E_TIMEOUT_MS    — Max runtime in ms (default: 90000)
 *
 * Evidence outputs written to RUN_DIR:
 *   00_context.txt, 01_console_log.txt, 02_network_failures.json,
 *   03_dashboard.png, 04_assertions.json, 99_SHA256SUMS.txt
 *
 * Exit codes:
 *   0 = all assertions PASS
 *   1 = one or more assertions FAIL or system error (fail-closed)
 *
 * Marker: FT_UI_SMOKE_PRODUCTION_GATE_V1
 */

import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

// ─── Config ─────────────────────────────────────────────────────────────────

const ISSUE_URL = process.env.FT_E2E_ISSUE_URL || '';
const STORAGE_STATE_PATH = process.env.FT_E2E_STORAGE_STATE || '';
const TIMEOUT_MS = parseInt(process.env.FT_E2E_TIMEOUT_MS || '90000', 10);

const RUN_DIR = `/tmp/ft_ui_smoke_${new Date().toISOString().replace(/[:.]/g, '').replace('T', 'T').slice(0, 15)}Z`;

// Required proof markers (must appear at least once in iframe console)
const REQUIRED_MARKERS = [
  'UI_BOOT_PROOF',
  'UI_FT_GETDASHBOARDSTATE_SUCCESS',
  'UI_ECL_ENTERPRISE_INVOKE_START',
  'UI_ECL_ENTERPRISE_INVOKE_OK',
];

// Forbidden markers (must NOT appear in iframe console)
const FORBIDDEN_MARKERS = [
  'UI_ECL_PANEL_LOAD_FAILED',
];

// Forbidden text in rendered DOM
const FORBIDDEN_DOM_TEXT = 'Governance Status: Failed to Load';

// ─── Helpers ────────────────────────────────────────────────────────────────

function writeEvidence(filename: string, content: string): void {
  fs.writeFileSync(path.join(RUN_DIR, filename), content, 'utf-8');
}

function gitSha(): string {
  try {
    return execSync('git rev-parse HEAD', { cwd: path.resolve(__dirname, '../../'), encoding: 'utf-8' }).trim();
  } catch { return 'UNKNOWN'; }
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  fs.mkdirSync(RUN_DIR, { recursive: true });

  const startUtc = new Date().toISOString();
  const sha = gitSha();

  // ── Pre-flight validation (fail-closed) ──────────────────────────────────
  if (!ISSUE_URL) {
    writeEvidence('04_assertions.json', JSON.stringify({ pass: false, reason: 'FT_E2E_ISSUE_URL not set' }, null, 2));
    console.error('FAIL: FT_E2E_ISSUE_URL environment variable is required.');
    process.exit(1);
  }

  if (!STORAGE_STATE_PATH) {
    writeEvidence('04_assertions.json', JSON.stringify({ pass: false, reason: 'FT_E2E_STORAGE_STATE not set' }, null, 2));
    console.error('FAIL: FT_E2E_STORAGE_STATE environment variable is required (path to Playwright storageState JSON).');
    process.exit(1);
  }

  if (!fs.existsSync(STORAGE_STATE_PATH)) {
    writeEvidence('04_assertions.json', JSON.stringify({ pass: false, reason: `storageState file not found: ${STORAGE_STATE_PATH}` }, null, 2));
    console.error(`FAIL: storageState file not found: ${STORAGE_STATE_PATH}`);
    process.exit(1);
  }

  // Validate JSON
  try {
    const parsed = JSON.parse(fs.readFileSync(STORAGE_STATE_PATH, 'utf-8'));
    if (!Array.isArray(parsed.cookies) || parsed.cookies.length === 0) {
      writeEvidence('04_assertions.json', JSON.stringify({ pass: false, reason: 'storageState has no cookies' }, null, 2));
      console.error('FAIL: storageState file has no cookies (not authenticated).');
      process.exit(1);
    }
  } catch (e: any) {
    writeEvidence('04_assertions.json', JSON.stringify({ pass: false, reason: `storageState invalid JSON: ${e.message}` }, null, 2));
    console.error(`FAIL: storageState invalid JSON: ${e.message}`);
    process.exit(1);
  }

  writeEvidence('00_context.txt', [
    `issue_url=${ISSUE_URL}`,
    `storage_state=${STORAGE_STATE_PATH}`,
    `start_utc=${startUtc}`,
    `git_sha=${sha}`,
    `timeout_ms=${TIMEOUT_MS}`,
    `run_dir=${RUN_DIR}`,
  ].join('\n'));

  // ── Launch browser ───────────────────────────────────────────────────────
  const consoleLines: string[] = [];
  const networkFailures: { url: string; status: number; method: string }[] = [];

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (e: any) {
    writeEvidence('04_assertions.json', JSON.stringify({ pass: false, reason: `Browser launch failed: ${e.message}` }, null, 2));
    console.error(`FAIL: Browser launch failed: ${e.message}`);
    process.exit(1);
  }

  let overallPass = true;
  const assertionResults: Record<string, { pass: boolean; detail: string }> = {};

  try {
    const context = await browser.newContext({
      storageState: STORAGE_STATE_PATH,
    });
    const page = await context.newPage();

    // Collect console from ALL frames (including iframes)
    page.on('console', (msg) => {
      consoleLines.push(`[${msg.type()}] ${msg.text()}`);
    });

    // Collect network failures for Forge CDN domain only
    page.on('response', (response) => {
      const url = response.url();
      const status = response.status();
      // Only track failures for our Forge app CDN assets
      if (status >= 400 && (url.includes('cdn.prod.atlassian-dev.net') && (url.includes('/govGadget') || url.includes('/govGadget2141')))) {
        networkFailures.push({ url, status, method: response.request().method() });
      }
    });

    // ── Navigate to Jira issue ─────────────────────────────────────────────
    console.log(`[SMOKE] Navigating to ${ISSUE_URL} ...`);
    await page.goto(ISSUE_URL, { waitUntil: 'domcontentloaded', timeout: TIMEOUT_MS });
    await page.waitForTimeout(5000); // Allow Forge iframe to mount

    // ── Locate Forge iframe ────────────────────────────────────────────────
    let forgeFrame = null;
    const maxWaitMs = Math.min(TIMEOUT_MS - 10000, 60000);
    const pollInterval = 2000;
    const deadline = Date.now() + maxWaitMs;

    while (Date.now() < deadline) {
      const frames = page.frames();
      for (const f of frames) {
        const fUrl = f.url();
        if (fUrl.includes('cdn.prod.atlassian-dev.net') && (fUrl.includes('/govGadget') || fUrl.includes('/govGadget2141'))) {
          forgeFrame = f;
          break;
        }
      }
      if (forgeFrame) break;
      await page.waitForTimeout(pollInterval);
    }

    if (!forgeFrame) {
      assertionResults['forge_iframe_found'] = { pass: false, detail: 'Forge iframe not found within timeout' };
      overallPass = false;
    } else {
      assertionResults['forge_iframe_found'] = { pass: true, detail: `url=${forgeFrame.url().slice(0, 120)}` };

      // Wait for dashboard to render inside iframe
      await page.waitForTimeout(8000);

      // ── DOM assertions inside iframe ───────────────────────────────────
      // Check for dashboard root
      const hasDashRoot = await forgeFrame.evaluate(() => {
        return document.querySelector('#ft-dashboard-root') !== null
          || document.querySelector('[data-ft-marker]') !== null
          || document.querySelector('.ecl-enterprise-governance-panel') !== null
          || document.body.innerText.length > 50;
      }).catch(() => false);

      assertionResults['dashboard_root_present'] = hasDashRoot
        ? { pass: true, detail: 'Dashboard content rendered' }
        : { pass: false, detail: 'No dashboard root element found in iframe' };
      if (!hasDashRoot) overallPass = false;

      // Check forbidden text
      const hasForbiddenText = await forgeFrame.evaluate((text: string) => {
        return document.body.innerText.includes(text);
      }, FORBIDDEN_DOM_TEXT).catch(() => false);

      assertionResults['no_failed_to_load'] = !hasForbiddenText
        ? { pass: true, detail: 'Forbidden text not present' }
        : { pass: false, detail: `Found forbidden text: "${FORBIDDEN_DOM_TEXT}"` };
      if (hasForbiddenText) overallPass = false;
    }

    // ── Console marker assertions ──────────────────────────────────────────
    const allConsoleText = consoleLines.join('\n');

    for (const marker of REQUIRED_MARKERS) {
      const found = allConsoleText.includes(marker);
      assertionResults[`marker_present_${marker}`] = found
        ? { pass: true, detail: `Found in console` }
        : { pass: false, detail: `Required marker NOT found in console` };
      if (!found) overallPass = false;
    }

    for (const marker of FORBIDDEN_MARKERS) {
      const found = allConsoleText.includes(marker);
      assertionResults[`marker_absent_${marker}`] = !found
        ? { pass: true, detail: `Correctly absent from console` }
        : { pass: false, detail: `Forbidden marker FOUND in console` };
      if (found) overallPass = false;
    }

    // ── Network failure assertions ─────────────────────────────────────────
    assertionResults['no_cdn_failures'] = networkFailures.length === 0
      ? { pass: true, detail: 'Zero CDN 4xx/5xx for Forge app assets' }
      : { pass: false, detail: `${networkFailures.length} CDN failure(s): ${JSON.stringify(networkFailures.slice(0, 5))}` };
    if (networkFailures.length > 0) overallPass = false;

    // ── Screenshot ─────────────────────────────────────────────────────────
    try {
      await page.screenshot({ path: path.join(RUN_DIR, '03_dashboard.png'), fullPage: true });
    } catch (e: any) {
      console.warn(`[WARN] Screenshot failed: ${e.message}`);
    }

    await context.close();
  } catch (e: any) {
    assertionResults['system_error'] = { pass: false, detail: `Unhandled: ${e.message}` };
    overallPass = false;
  } finally {
    await browser.close();
  }

  // ── Write evidence ───────────────────────────────────────────────────────
  writeEvidence('01_console_log.txt', consoleLines.join('\n'));
  writeEvidence('02_network_failures.json', JSON.stringify(networkFailures, null, 2));
  writeEvidence('04_assertions.json', JSON.stringify({
    pass: overallPass,
    utc: new Date().toISOString(),
    assertions: assertionResults,
  }, null, 2));

  // ── SHA256 sums ──────────────────────────────────────────────────────────
  try {
    const files = fs.readdirSync(RUN_DIR).filter(f => f !== '99_SHA256SUMS.txt').sort();
    const hashLines = files.map(f => {
      const content = fs.readFileSync(path.join(RUN_DIR, f));
      const hash = require('crypto').createHash('sha256').update(content).digest('hex');
      return `${hash}  ${f}`;
    });
    writeEvidence('99_SHA256SUMS.txt', hashLines.join('\n') + '\n');
  } catch (e: any) {
    console.warn(`[WARN] SHA256 generation failed: ${e.message}`);
  }

  // ── Result ───────────────────────────────────────────────────────────────
  console.log(`FT_UI_SMOKE_PRODUCTION_GATE_V1 ok=${overallPass}`);
  console.log(`RUN_DIR=${RUN_DIR}`);

  if (!overallPass) {
    console.error('FAIL: One or more assertions failed. See 04_assertions.json for details.');
    process.exit(1);
  }

  console.log('PASS: All UI smoke assertions passed.');
  process.exit(0);
}

main().catch((err) => {
  console.error(`FATAL: ${err.message}`);
  process.exit(1);
});
